/**
 * @fileoverview Express router configuration for document management endpoints with
 * comprehensive security, validation, monitoring and performance optimization.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import multer from 'multer'; // v1.4.5-lts.1
import rateLimit from 'express-rate-limit'; // v6.9.0
import compression from 'compression'; // v1.7.4
import helmet from 'helmet'; // v7.0.0
import winston from 'winston'; // v3.10.0
import { DocumentController } from '../controllers/DocumentController';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { z } from 'zod';
import { ERROR_CODES, HTTP_STATUS_CODES } from '../../constants/errorCodes';
import { metricsManager } from '../../utils/metrics';
import { logger } from '../../utils/logger';

// Initialize router
const documentRouter = Router();

// Configure security middleware
documentRouter.use(helmet());
documentRouter.use(compression());

// Configure rate limiters
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    code: ERROR_CODES.RATE_LIMIT_ERROR,
    message: 'Too many document upload requests'
  }
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    code: ERROR_CODES.RATE_LIMIT_ERROR,
    message: 'Too many document download requests'
  }
});

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Validation schemas
const uploadSchema = z.object({
  documentType: z.string().min(1),
  policyId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  retentionPeriod: z.number().min(1).max(365).optional()
});

const deleteSchema = z.object({
  reason: z.string().min(1).optional(),
  permanent: z.boolean().optional()
});

// Document upload endpoint
documentRouter.post(
  '/upload',
  authenticateToken,
  uploadLimiter,
  validateBody(uploadSchema),
  async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const result = await DocumentController.uploadDocument(req, res);

      metricsManager.recordAPIMetrics({
        method: 'POST',
        path: '/api/documents/upload',
        statusCode: HTTP_STATUS_CODES.CREATED,
        responseTime: Date.now() - startTime,
        requestSize: parseInt(req.headers['content-length'] || '0'),
        responseSize: JSON.stringify(result).length,
        clientId: req.user?.id
      });

      return result;
    } catch (error) {
      logger.error('Document upload failed', error, { correlationId });
      
      metricsManager.recordAPIMetrics({
        method: 'POST',
        path: '/api/documents/upload',
        statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        responseTime: Date.now() - startTime,
        requestSize: parseInt(req.headers['content-length'] || '0'),
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        code: ERROR_CODES.DOCUMENT_ERROR,
        message: 'Document upload failed',
        correlationId
      });
    }
  }
);

// Document retrieval endpoint
documentRouter.get(
  '/:id',
  authenticateToken,
  downloadLimiter,
  async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const result = await DocumentController.getDocument(req, res);

      metricsManager.recordAPIMetrics({
        method: 'GET',
        path: '/api/documents/:id',
        statusCode: HTTP_STATUS_CODES.OK,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: JSON.stringify(result).length,
        clientId: req.user?.id
      });

      return result;
    } catch (error) {
      logger.error('Document retrieval failed', error, { correlationId });

      metricsManager.recordAPIMetrics({
        method: 'GET',
        path: '/api/documents/:id',
        statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        code: ERROR_CODES.DOCUMENT_ERROR,
        message: 'Document retrieval failed',
        correlationId
      });
    }
  }
);

// Document deletion endpoint
documentRouter.delete(
  '/:id',
  authenticateToken,
  validateBody(deleteSchema),
  async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const result = await DocumentController.deleteDocument(req, res);

      metricsManager.recordAPIMetrics({
        method: 'DELETE',
        path: '/api/documents/:id',
        statusCode: HTTP_STATUS_CODES.OK,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return result;
    } catch (error) {
      logger.error('Document deletion failed', error, { correlationId });

      metricsManager.recordAPIMetrics({
        method: 'DELETE',
        path: '/api/documents/:id',
        statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        code: ERROR_CODES.DOCUMENT_ERROR,
        message: 'Document deletion failed',
        correlationId
      });
    }
  }
);

// Policy documents retrieval endpoint
documentRouter.get(
  '/policy/:policyId',
  authenticateToken,
  downloadLimiter,
  async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      const result = await DocumentController.getPolicyDocuments(req, res);

      metricsManager.recordAPIMetrics({
        method: 'GET',
        path: '/api/documents/policy/:policyId',
        statusCode: HTTP_STATUS_CODES.OK,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: JSON.stringify(result).length,
        clientId: req.user?.id
      });

      return result;
    } catch (error) {
      logger.error('Policy documents retrieval failed', error, { correlationId });

      metricsManager.recordAPIMetrics({
        method: 'GET',
        path: '/api/documents/policy/:policyId',
        statusCode: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: 0,
        clientId: req.user?.id
      });

      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        code: ERROR_CODES.DOCUMENT_ERROR,
        message: 'Policy documents retrieval failed',
        correlationId
      });
    }
  }
);

export default documentRouter;