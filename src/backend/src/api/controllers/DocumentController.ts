import { injectable } from 'inversify';
import { controller, httpPost, httpGet, httpDelete } from 'inversify-express-utils';
import { Request, Response } from 'express';
import multer from 'multer';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { DocumentService } from '../../services/DocumentService';
import { Logger } from '../../utils/logger';
import { MetricsCollector } from '../../utils/metrics';
import { Cache } from 'node-cache';

// Constants for document handling
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Enhanced controller for secure document management operations with comprehensive
 * security, monitoring, and performance features.
 */
@injectable()
@controller('/api/v1/documents')
@rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later'
})
export class DocumentController {
  private upload: multer.Multer;

  constructor(
    private readonly documentService: DocumentService,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
    private readonly cache: Cache
  ) {
    // Configure multer for secure file uploads
    this.upload = multer({
      limits: {
        fileSize: MAX_FILE_SIZE
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      }
    });

    // Apply compression middleware
    this.applyCompression();
  }

  /**
   * Handles secure document upload with comprehensive validation and monitoring
   */
  @httpPost('/upload')
  @body('documentType').isString().notEmpty()
  @body('policyId').optional().isUUID()
  @body('claimId').optional().isUUID()
  async uploadDocument(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Handle file upload
      const uploadResult = await new Promise<any>((resolve, reject) => {
        this.upload.single('file')(req, res, (err) => {
          if (err) reject(err);
          resolve(req.file);
        });
      });

      if (!uploadResult) {
        throw new Error('No file uploaded');
      }

      // Upload document with service
      const document = await this.documentService.uploadDocument(
        uploadResult.buffer,
        {
          fileName: uploadResult.originalname,
          fileType: uploadResult.mimetype,
          documentType: req.body.documentType,
          uploadedBy: req.user?.id,
          policyId: req.body.policyId,
          claimId: req.body.claimId,
          customMetadata: req.body.metadata
        },
        {
          encryption: true,
          retentionPeriod: parseInt(req.body.retentionPeriod) || undefined
        }
      );

      // Record metrics
      this.metrics.recordAPIMetrics({
        method: 'POST',
        path: '/api/v1/documents/upload',
        statusCode: 201,
        responseTime: Date.now() - startTime,
        requestSize: uploadResult.size,
        responseSize: JSON.stringify(document).length,
        clientId: req.user?.id
      });

      return res.status(201).json({
        success: true,
        data: document,
        correlationId
      });
    } catch (error) {
      this.logger.error('Document upload failed', error, { correlationId });
      
      this.metrics.recordAPIMetrics({
        method: 'POST',
        path: '/api/v1/documents/upload',
        statusCode: 500,
        responseTime: Date.now() - startTime,
        requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to upload document',
        correlationId
      });
    }
  }

  /**
   * Retrieves document with caching and streaming support
   */
  @httpGet('/:id')
  async getDocument(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const documentId = req.params.id;
      const useCache = req.query.cache !== 'false';
      const withSignedUrl = req.query.signedUrl === 'true';

      // Get document
      const document = await this.documentService.getDocument(
        documentId,
        withSignedUrl,
        {
          useCache,
          decryptContent: req.query.decrypt === 'true'
        }
      );

      // Record metrics
      this.metrics.recordAPIMetrics({
        method: 'GET',
        path: '/api/v1/documents/:id',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: JSON.stringify(document).length,
        clientId: req.user?.id
      });

      return res.status(200).json({
        success: true,
        data: document,
        correlationId
      });
    } catch (error) {
      this.logger.error('Document retrieval failed', error, { correlationId });

      this.metrics.recordAPIMetrics({
        method: 'GET',
        path: '/api/v1/documents/:id',
        statusCode: 500,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve document',
        correlationId
      });
    }
  }

  /**
   * Handles document deletion with audit trail
   */
  @httpDelete('/:id')
  async deleteDocument(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const documentId = req.params.id;
      
      await this.documentService.deleteDocument(
        documentId,
        req.query.permanent === 'true',
        {
          deletedBy: req.user?.id,
          reason: req.body.reason
        }
      );

      // Record metrics
      this.metrics.recordAPIMetrics({
        method: 'DELETE',
        path: '/api/v1/documents/:id',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
        correlationId
      });
    } catch (error) {
      this.logger.error('Document deletion failed', error, { correlationId });

      this.metrics.recordAPIMetrics({
        method: 'DELETE',
        path: '/api/v1/documents/:id',
        statusCode: 500,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to delete document',
        correlationId
      });
    }
  }

  /**
   * Retrieves all documents for a policy
   */
  @httpGet('/policy/:policyId')
  async getPolicyDocuments(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const documents = await this.documentService.getPolicyDocuments(
        req.params.policyId,
        {
          documentTypes: req.query.types ? (req.query.types as string).split(',') : undefined,
          includeDeleted: req.query.includeDeleted === 'true',
          withSignedUrls: req.query.signedUrls === 'true'
        }
      );

      // Record metrics
      this.metrics.recordAPIMetrics({
        method: 'GET',
        path: '/api/v1/documents/policy/:policyId',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: JSON.stringify(documents).length,
        clientId: req.user?.id
      });

      return res.status(200).json({
        success: true,
        data: documents,
        correlationId
      });
    } catch (error) {
      this.logger.error('Policy documents retrieval failed', error, { correlationId });

      this.metrics.recordAPIMetrics({
        method: 'GET',
        path: '/api/v1/documents/policy/:policyId',
        statusCode: 500,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve policy documents',
        correlationId
      });
    }
  }

  /**
   * Applies compression middleware for response optimization
   */
  private applyCompression(): void {
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    });
  }
}