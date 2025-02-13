import { Entity, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm'; // v0.3.17
import { createS3Client } from '../config/aws';
import { encrypt } from '../utils/encryption';
import { Claim } from './Claim';

/**
 * Enhanced Document entity for managing insurance-related documents with 
 * comprehensive security, encryption, and relationship management capabilities.
 */
@Entity('documents')
export class Document {
  @Column('uuid', { primary: true, generated: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  fileName!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  fileType!: string;

  @Column({ type: 'integer', nullable: false })
  fileSize!: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  s3Key!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  s3Bucket!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  documentType!: string;

  @Column({ type: 'uuid', nullable: true })
  policyId?: string;

  @Column({ type: 'uuid', nullable: true })
  claimId?: string;

  @ManyToOne(() => Claim, claim => claim.documents)
  claim?: Claim;

  @CreateDateColumn()
  uploadedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: false })
  uploadedBy!: string;

  @Column({ type: 'boolean', default: false })
  isEncrypted!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  encryptionKeyId?: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  contentHash!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  mimeType!: string;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column('jsonb', { nullable: true })
  metadata?: {
    classification?: string;
    retention?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
  };

  /**
   * Creates a new Document instance with enhanced validation and security checks
   */
  constructor(documentData: {
    fileName: string;
    fileType: string;
    fileSize: number;
    documentType: string;
    uploadedBy: string;
    mimeType: string;
    policyId?: string;
    claimId?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!documentData.fileName || !documentData.fileType || !documentData.documentType) {
      throw new Error('Required document fields missing');
    }

    this.fileName = documentData.fileName;
    this.fileType = documentData.fileType;
    this.fileSize = documentData.fileSize;
    this.documentType = documentData.documentType;
    this.uploadedBy = documentData.uploadedBy;
    this.mimeType = documentData.mimeType;
    this.policyId = documentData.policyId;
    this.claimId = documentData.claimId;
    this.version = 1;
    this.isEncrypted = false;
    
    // Set metadata with classification
    this.metadata = {
      classification: 'CONFIDENTIAL',
      retention: '7-YEARS',
      tags: [],
      ...documentData.metadata
    };

    // Generate S3 key with versioning
    this.s3Key = `${documentData.documentType}/${new Date().getFullYear()}/${this.id}/${this.version}`;
    this.s3Bucket = process.env.AWS_S3_BUCKET_NAME || 'mga-os-documents';
  }

  /**
   * Generates a secure pre-signed URL for document access with enhanced security controls
   */
  async getSignedUrl(
    expirationMinutes: number = 15,
    options: {
      responseContentType?: string;
      versionId?: string;
      checkPermissions?: boolean;
    } = {}
  ): Promise<string> {
    try {
      if (!this.s3Key || !this.s3Bucket) {
        throw new Error('Document storage information missing');
      }

      const s3Client = createS3Client();
      const command = {
        Bucket: this.s3Bucket,
        Key: this.s3Key,
        Expires: expirationMinutes * 60,
        ...(options.responseContentType && {
          ResponseContentType: options.responseContentType
        }),
        ...(options.versionId && {
          VersionId: options.versionId
        })
      };

      // Add encryption headers if document is encrypted
      if (this.isEncrypted) {
        command['ServerSideEncryption'] = 'aws:kms';
        command['SSEKMSKeyId'] = this.encryptionKeyId;
      }

      return await s3Client.getSignedUrl('getObject', command);
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Performs secure soft deletion with audit trail
   */
  async softDelete(
    deletedBy: string,
    options: {
      reason?: string;
      permanent?: boolean;
    } = {}
  ): Promise<void> {
    try {
      this.deletedAt = new Date();
      
      // Add deletion metadata
      this.metadata = {
        ...this.metadata,
        deletionInfo: {
          deletedBy,
          deletedAt: this.deletedAt,
          reason: options.reason || 'User requested deletion',
          permanent: options.permanent || false
        }
      };

      // If permanent deletion is requested, schedule S3 object deletion
      if (options.permanent) {
        const s3Client = createS3Client();
        await s3Client.deleteObject({
          Bucket: this.s3Bucket,
          Key: this.s3Key
        });
      }
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Encrypts document content using AWS KMS
   */
  async encrypt(): Promise<void> {
    try {
      if (this.isEncrypted) {
        throw new Error('Document is already encrypted');
      }

      const { encryptedData, encryptedKey } = await encrypt(Buffer.from(this.s3Key));
      
      // Update document with encryption details
      this.isEncrypted = true;
      this.encryptionKeyId = encryptedKey.toString('base64');
      this.s3Key = encryptedData.toString('base64');
      this.version += 1;

      // Update metadata
      this.metadata = {
        ...this.metadata,
        encryption: {
          method: 'AES-256-GCM',
          timestamp: new Date(),
          version: this.version
        }
      };
    } catch (error) {
      throw new Error(`Failed to encrypt document: ${error.message}`);
    }
  }
}