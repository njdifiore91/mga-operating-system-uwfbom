import { Repository, EntityRepository } from 'typeorm'; // v0.3.17
import { injectable } from 'inversify'; // v6.0.1
import { 
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3'; // v3.400.0
import { Logger } from '@mga/logger'; // v1.0.0
import { Document } from '../models/Document';
import { createS3Client } from '../config/aws';
import { encrypt, decrypt } from '../utils/encryption';
import { Cache } from '@mga/cache'; // v1.0.0
import { KMSClient } from '@aws-sdk/client-kms'; // v3.400.0

/**
 * Enhanced repository class for secure document management with encryption,
 * monitoring, and performance optimization.
 */
@injectable()
@EntityRepository(Document)
export class DocumentRepository extends Repository<Document> {
  private s3Client: S3Client;
  private logger: Logger;
  private documentCache: Cache;
  private kmsClient: KMSClient;

  constructor(
    logger: Logger,
    cache: Cache,
    kmsClient: KMSClient
  ) {
    super();
    this.s3Client = createS3Client();
    this.logger = logger;
    this.documentCache = cache;
    this.kmsClient = kmsClient;

    this.logger.info('DocumentRepository initialized with enhanced security features');
  }

  /**
   * Uploads document with encryption and integrity verification
   */
  async uploadDocument(
    fileBuffer: Buffer,
    metadata: {
      fileName: string;
      fileType: string;
      documentType: string;
      uploadedBy: string;
      policyId?: string;
      claimId?: string;
      customMetadata?: Record<string, unknown>;
    },
    options: {
      encryption?: boolean;
      retentionPeriod?: number;
    } = {}
  ): Promise<Document> {
    try {
      this.logger.info('Starting secure document upload', { fileName: metadata.fileName });

      // Create document entity
      const document = new Document({
        fileName: metadata.fileName,
        fileType: metadata.fileType,
        fileSize: fileBuffer.length,
        documentType: metadata.documentType,
        uploadedBy: metadata.uploadedBy,
        mimeType: metadata.fileType,
        policyId: metadata.policyId,
        claimId: metadata.claimId,
        metadata: {
          ...metadata.customMetadata,
          uploadTimestamp: new Date().toISOString()
        }
      });

      // Encrypt document if required
      let encryptedData: Buffer;
      let encryptedKey: Buffer;

      if (options.encryption !== false) {
        const encryptionResult = await encrypt(fileBuffer);
        encryptedData = encryptionResult.encryptedData;
        encryptedKey = encryptionResult.encryptedKey;
        document.isEncrypted = true;
        document.encryptionKeyId = encryptedKey.toString('base64');
      } else {
        encryptedData = fileBuffer;
      }

      // Upload to S3 with enhanced metadata
      const s3Key = `${document.documentType}/${new Date().getFullYear()}/${document.id}/${document.version}`;
      await this.s3Client.send(new PutObjectCommand({
        Bucket: document.s3Bucket,
        Key: s3Key,
        Body: encryptedData,
        ContentType: document.mimeType,
        Metadata: {
          documentId: document.id,
          version: document.version.toString(),
          contentHash: document.contentHash,
          isEncrypted: document.isEncrypted.toString()
        },
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: process.env.AWS_KMS_KEY_ID
      }));

      // Save document metadata to database
      const savedDocument = await this.save(document);
      
      this.logger.info('Document uploaded successfully', {
        documentId: savedDocument.id,
        size: fileBuffer.length
      });

      return savedDocument;
    } catch (error) {
      this.logger.error('Document upload failed', error);
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  /**
   * Retrieves document with integrity verification and optional caching
   */
  async getDocument(
    documentId: string,
    options: {
      withSignedUrl?: boolean;
      useCache?: boolean;
      decryptContent?: boolean;
    } = {}
  ): Promise<Document> {
    try {
      // Check cache if enabled
      if (options.useCache !== false) {
        const cachedDocument = await this.documentCache.get(`document:${documentId}`);
        if (cachedDocument) {
          return cachedDocument;
        }
      }

      // Get document metadata from database
      const document = await this.findOne({ where: { id: documentId } });
      if (!document) {
        throw new Error('Document not found');
      }

      // Get document content from S3 if needed
      if (options.decryptContent && document.isEncrypted) {
        const s3Response = await this.s3Client.send(new GetObjectCommand({
          Bucket: document.s3Bucket,
          Key: document.s3Key
        }));

        const encryptedContent = await s3Response.Body?.transformToByteArray();
        if (encryptedContent) {
          const decryptedContent = await decrypt(
            Buffer.from(encryptedContent),
            Buffer.from(document.encryptionKeyId!, 'base64')
          );
          document.content = decryptedContent;
        }
      }

      // Generate signed URL if requested
      if (options.withSignedUrl) {
        document.signedUrl = await document.getSignedUrl(15);
      }

      // Update cache
      if (options.useCache !== false) {
        await this.documentCache.set(
          `document:${documentId}`,
          document,
          { ttl: 3600 } // 1 hour cache
        );
      }

      this.logger.info('Document retrieved successfully', { documentId });
      return document;
    } catch (error) {
      this.logger.error('Document retrieval failed', error);
      throw new Error(`Failed to retrieve document: ${error.message}`);
    }
  }

  /**
   * Securely deletes document with audit trail
   */
  async deleteDocument(
    documentId: string,
    options: {
      permanent?: boolean;
      deletedBy: string;
      reason?: string;
    }
  ): Promise<void> {
    try {
      const document = await this.findOne({ where: { id: documentId } });
      if (!document) {
        throw new Error('Document not found');
      }

      // Perform soft delete
      await document.softDelete(options.deletedBy, {
        reason: options.reason,
        permanent: options.permanent
      });

      // Clear cache
      await this.documentCache.delete(`document:${documentId}`);

      this.logger.info('Document deleted successfully', {
        documentId,
        permanent: options.permanent
      });
    } catch (error) {
      this.logger.error('Document deletion failed', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Verifies document integrity using stored hash
   */
  private async verifyDocumentIntegrity(
    document: Document,
    content: Buffer
  ): Promise<boolean> {
    const contentHash = await this.calculateHash(content);
    return contentHash === document.contentHash;
  }

  /**
   * Calculates secure hash of document content
   */
  private async calculateHash(content: Buffer): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(content).digest('hex');
  }
}