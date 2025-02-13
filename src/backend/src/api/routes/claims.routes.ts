/**
 * @fileoverview Claims management routes configuration for MGA OS platform
 * Implements comprehensive RESTful endpoints with robust middleware chains
 * for authentication, validation, rate limiting, and monitoring.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { rateLimit } from 'express-rate-limit'; // v6.7.0
import { monitor } from '@opentelemetry/api'; // v1.4.0
import { correlationId } from 'express-correlation-id'; // v2.0.1

import { authenticateToken } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { ClaimsController } from '../controllers/ClaimsController';
import { createClaimSchema, updateClaimStatusSchema } from '../validators/claims.validator';
import { logger } from '../../utils/logger';
import { metricsManager } from '../../utils/metrics';
import { ERROR_CODES } from '../../constants/errorCodes';

// Initialize router
const claimsRouter = Router();

// Configure rate limiting
const rateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: {
    code: ERROR_CODES.RATE_LIMIT_ERROR,
    message: 'Rate limit exceeded. Please try again later.'
  }
};

// Configure caching
const cacheConfig = {
  ttl: 300, // 5 minutes
  maxSize: 1000,
  updateAgeOnGet: true
};

// Apply global middleware
claimsRouter.use(correlationId());
claimsRouter.use(monitor.middleware());

/**
 * POST /api/v1/claims
 * Creates a new claim with comprehensive validation and monitoring
 */
claimsRouter.post('/',
  authenticateToken,
  rateLimit({
    ...rateLimitConfig,
    max: 100 // Stricter limit for creation
  }),
  validateBody(createClaimSchema),
  async (req, res) => {
    const startTime = Date.now();
    const controller = new ClaimsController();

    try {
      const claim = await controller.createClaim(req, res);

      // Record metrics
      metricsManager.recordAPIMetrics({
        method: 'POST',
        path: '/api/v1/claims',
        statusCode: 201,
        responseTime: Date.now() - startTime,
        requestSize: JSON.stringify(req.body).length,
        responseSize: JSON.stringify(claim).length
      });

      return claim;
    } catch (error) {
      logger.error('Failed to create claim', error, { body: req.body });
      throw error;
    }
  }
);

/**
 * GET /api/v1/claims/:id
 * Retrieves a claim by ID with caching and performance optimization
 */
claimsRouter.get('/:id',
  authenticateToken,
  rateLimit(rateLimitConfig),
  async (req, res) => {
    const startTime = Date.now();
    const controller = new ClaimsController();

    try {
      const claim = await controller.getClaim(req, res);

      // Record metrics
      metricsManager.recordAPIMetrics({
        method: 'GET',
        path: '/api/v1/claims/:id',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        requestSize: 0,
        responseSize: JSON.stringify(claim).length
      });

      return claim;
    } catch (error) {
      logger.error('Failed to retrieve claim', error, { claimId: req.params.id });
      throw error;
    }
  }
);

/**
 * PUT /api/v1/claims/:id/status
 * Updates claim status with validation and compliance checks
 */
claimsRouter.put('/:id/status',
  authenticateToken,
  rateLimit(rateLimitConfig),
  validateBody(updateClaimStatusSchema),
  async (req, res) => {
    const startTime = Date.now();
    const controller = new ClaimsController();

    try {
      const updatedClaim = await controller.updateClaimStatus(req, res);

      // Record metrics
      metricsManager.recordAPIMetrics({
        method: 'PUT',
        path: '/api/v1/claims/:id/status',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        requestSize: JSON.stringify(req.body).length,
        responseSize: JSON.stringify(updatedClaim).length
      });

      return updatedClaim;
    } catch (error) {
      logger.error('Failed to update claim status', error, {
        claimId: req.params.id,
        body: req.body
      });
      throw error;
    }
  }
);

/**
 * PUT /api/v1/claims/:id/reserves
 * Updates claim reserves with financial validation
 */
claimsRouter.put('/:id/reserves',
  authenticateToken,
  rateLimit(rateLimitConfig),
  async (req, res) => {
    const startTime = Date.now();
    const controller = new ClaimsController();

    try {
      const updatedClaim = await controller.updateReserves(req, res);

      // Record metrics
      metricsManager.recordAPIMetrics({
        method: 'PUT',
        path: '/api/v1/claims/:id/reserves',
        statusCode: 200,
        responseTime: Date.now() - startTime,
        requestSize: JSON.stringify(req.body).length,
        responseSize: JSON.stringify(updatedClaim).length
      });

      return updatedClaim;
    } catch (error) {
      logger.error('Failed to update claim reserves', error, {
        claimId: req.params.id,
        body: req.body
      });
      throw error;
    }
  }
);

// Error handling middleware
claimsRouter.use((error: any, req: any, res: any, next: any) => {
  logger.error('Claims route error', error, {
    path: req.path,
    method: req.method,
    body: req.body
  });

  res.status(error.status || 500).json({
    code: error.code || ERROR_CODES.SYSTEM_ERROR,
    message: error.message || 'Internal server error'
  });
});

export default claimsRouter;