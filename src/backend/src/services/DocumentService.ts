import { injectable } from 'inversify';
import { Buffer } from 'buffer';
import { CircuitBreaker } from 'opossum';
import { Metrics } from 'prom-client';
import { Cache } from 'node-cache';
import { Document } from '../models/Document';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { Logger } from '../utils/logger';

/**
 * Enterprise-grade service class for secure document management with high availability,
 * performance optimization, and comprehensive audit capabilities.
 * 
 * @version 1.0.0
 */
@injectable()
export class DocumentService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly logger: Logger,
    private readonly cache: Cache,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly metrics: Metrics
  ) {
    this.initializeMetrics();
    this.logger.info('DocumentService initialized with enhanced security features');
  }

  /**
   * Uploads a document with enhanced security and performance features
   */
  public async uploadDocument(
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
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<Document> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting document upload process', {
        fileName: metadata.fileName,
        size: fileBuffer.length
      });

      // Validate input
      this.validateUploadInput(fileBuffer, metadata);

      // Wrap repository call in circuit breaker
      const document = await this.circuitBreaker.fire(
        () => this.documentRepository.uploadDocument(
          fileBuffer,
          metadata,
          {
            encryption: options.encryption !== false,
            retentionPeriod: options.retentionPeriod
          }
        )
      );

      // Update metrics
      this.metrics.uploadLatency.observe(Date.now() - startTime);
      this.metrics.uploadSize.observe(fileBuffer.length);
      this.metrics.uploadSuccess.inc();

      // Cache document metadata
      await this.cache.set(
        `document:${document.id}`,
        document,
        this.CACHE_TTL
      );

      this.logger.info('Document upload completed successfully', {
        documentId: document.id,
        duration: Date.now() - startTime
      });

      return document;
    } catch (error) {
      this.metrics.uploadFailure.inc();
      this.logger.error('Document upload failed', error);
      throw error;
    }
  }

  /**
   * Retrieves a document with caching and streaming support
   */
  public async getDocument(
    documentId: string,
    withSignedUrl: boolean = false,
    options: {
      useCache?: boolean;
      decryptContent?: boolean;
    } = {}
  ): Promise<Document> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (options.useCache !== false) {
        const cachedDocument = await this.cache.get<Document>(`document:${documentId}`);
        if (cachedDocument) {
          this.metrics.cacheHits.inc();
          return cachedDocument;
        }
        this.metrics.cacheMisses.inc();
      }

      // Retrieve document with circuit breaker
      const document = await this.circuitBreaker.fire(
        () => this.documentRepository.getDocument(documentId, {
          withSignedUrl,
          useCache: options.useCache,
          decryptContent: options.decryptContent
        })
      );

      // Update metrics
      this.metrics.retrievalLatency.observe(Date.now() - startTime);
      this.metrics.retrievalSuccess.inc();

      return document;
    } catch (error) {
      this.metrics.retrievalFailure.inc();
      this.logger.error('Document retrieval failed', error);
      throw error;
    }
  }

  /**
   * Handles document deletion with enhanced cleanup
   */
  public async deleteDocument(
    documentId: string,
    removeFromStorage: boolean = false,
    options: {
      deletedBy: string;
      reason?: string;
    }
  ): Promise<void> {
    try {
      this.logger.info('Starting document deletion process', {
        documentId,
        permanent: removeFromStorage
      });

      await this.circuitBreaker.fire(
        () => this.documentRepository.deleteDocument(documentId, {
          permanent: removeFromStorage,
          deletedBy: options.deletedBy,
          reason: options.reason
        })
      );

      // Clear cache
      await this.cache.del(`document:${documentId}`);

      this.metrics.deletionSuccess.inc();
      this.logger.info('Document deletion completed successfully', { documentId });
    } catch (error) {
      this.metrics.deletionFailure.inc();
      this.logger.error('Document deletion failed', error);
      throw error;
    }
  }

  /**
   * Retrieves policy documents with optimization
   */
  public async getPolicyDocuments(
    policyId: string,
    options: {
      documentTypes?: string[];
      includeDeleted?: boolean;
      withSignedUrls?: boolean;
    } = {}
  ): Promise<Document[]> {
    const startTime = Date.now();

    try {
      // Check cache for policy documents
      const cacheKey = `policy:${policyId}:documents`;
      if (options.includeDeleted !== true) {
        const cachedDocuments = await this.cache.get<Document[]>(cacheKey);
        if (cachedDocuments) {
          this.metrics.cacheHits.inc();
          return cachedDocuments;
        }
        this.metrics.cacheMisses.inc();
      }

      // Find documents with filtering
      const documents = await this.documentRepository.find({
        where: {
          policyId,
          ...(options.documentTypes && {
            documentType: { $in: options.documentTypes }
          }),
          ...(options.includeDeleted !== true && {
            deletedAt: null
          })
        }
      });

      // Generate signed URLs if requested
      if (options.withSignedUrls) {
        await Promise.all(
          documents.map(async (doc) => {
            doc.signedUrl = await doc.getSignedUrl(15);
          })
        );
      }

      // Cache results
      if (options.includeDeleted !== true) {
        await this.cache.set(cacheKey, documents, this.CACHE_TTL);
      }

      // Update metrics
      this.metrics.batchRetrievalLatency.observe(Date.now() - startTime);
      this.metrics.batchRetrievalSuccess.inc();

      return documents;
    } catch (error) {
      this.metrics.batchRetrievalFailure.inc();
      this.logger.error('Policy documents retrieval failed', error);
      throw error;
    }
  }

  /**
   * Initializes service metrics
   */
  private initializeMetrics(): void {
    this.metrics.uploadLatency = new this.metrics.Histogram({
      name: 'document_upload_duration_seconds',
      help: 'Document upload duration in seconds'
    });

    this.metrics.uploadSize = new this.metrics.Histogram({
      name: 'document_upload_size_bytes',
      help: 'Document upload size in bytes'
    });

    this.metrics.uploadSuccess = new this.metrics.Counter({
      name: 'document_upload_success_total',
      help: 'Total successful document uploads'
    });

    this.metrics.uploadFailure = new this.metrics.Counter({
      name: 'document_upload_failure_total',
      help: 'Total failed document uploads'
    });

    this.metrics.retrievalLatency = new this.metrics.Histogram({
      name: 'document_retrieval_duration_seconds',
      help: 'Document retrieval duration in seconds'
    });

    this.metrics.retrievalSuccess = new this.metrics.Counter({
      name: 'document_retrieval_success_total',
      help: 'Total successful document retrievals'
    });

    this.metrics.retrievalFailure = new this.metrics.Counter({
      name: 'document_retrieval_failure_total',
      help: 'Total failed document retrievals'
    });

    this.metrics.cacheHits = new this.metrics.Counter({
      name: 'document_cache_hits_total',
      help: 'Total document cache hits'
    });

    this.metrics.cacheMisses = new this.metrics.Counter({
      name: 'document_cache_misses_total',
      help: 'Total document cache misses'
    });
  }

  /**
   * Validates upload input parameters
   */
  private validateUploadInput(
    fileBuffer: Buffer,
    metadata: {
      fileName: string;
      fileType: string;
      documentType: string;
      uploadedBy: string;
    }
  ): void {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer is required');
    }

    if (!metadata.fileName || !metadata.fileType || !metadata.documentType) {
      throw new Error('Required metadata fields are missing');
    }

    if (!metadata.uploadedBy) {
      throw new Error('Upload user information is required');
    }
  }
}