/**
 * @file Policy routes configuration for MGA Operating System
 * @version 1.0.0
 * @description Express router configuration implementing high-performance, secure API routes
 * for policy management with comprehensive middleware chains and monitoring
 */

import { Router } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { z } from 'zod';

import { PolicyController } from '../controllers/PolicyController';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validation.middleware';
import { logger } from '../../utils/logger';
import { ERROR_CODES, ERROR_MESSAGES } from '../../constants/errorCodes';
import { oneshieldConfig } from '../../config/oneshield';

// Initialize router
const router = Router();

// Rate limiting configuration
const policyRateLimiter = rateLimit({
    windowMs: oneshieldConfig.policy.rateLimit.windowMs,
    max: oneshieldConfig.policy.rateLimit.maxRequests,
    message: {
        code: ERROR_CODES.RATE_LIMIT_ERROR,
        message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_ERROR]
    }
});

// Circuit breaker for OneShield integration
const circuitBreaker = new CircuitBreaker(async (req) => req, {
    timeout: 30000,
    errorThresholdPercentage: oneshieldConfig.monitoring.circuitBreaker.threshold * 100,
    resetTimeout: oneshieldConfig.monitoring.circuitBreaker.resetTimeout
});

// Validation schemas
const policyQuerySchema = z.object({
    page: z.string().optional().transform(Number).default('1'),
    limit: z.string().optional().transform(Number).default('10'),
    status: z.string().optional(),
    type: z.string().optional(),
    effectiveDate: z.string().optional().transform(date => new Date(date)),
    expirationDate: z.string().optional().transform(date => new Date(date))
});

const policyIdSchema = z.object({
    id: z.string().uuid()
});

// Configure routes with middleware chains
router.get('/policies',
    authenticateToken,
    validateQuery(policyQuerySchema),
    policyRateLimiter,
    async (req, res, next) => {
        try {
            const result = await circuitBreaker.fire(async () => {
                return await PolicyController.getPolicies(req, res, next);
            });
            return result;
        } catch (error) {
            logger.error('Failed to retrieve policies', { error });
            return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
                code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                message: ERROR_MESSAGES[ERROR_CODES.EXTERNAL_SERVICE_ERROR]
            });
        }
    }
);

router.get('/policies/:id',
    authenticateToken,
    validateParams(policyIdSchema),
    policyRateLimiter,
    async (req, res, next) => {
        try {
            const result = await circuitBreaker.fire(async () => {
                return await PolicyController.getPolicy(req, res, next);
            });
            return result;
        } catch (error) {
            logger.error('Failed to retrieve policy', { error, policyId: req.params.id });
            return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
                code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                message: ERROR_MESSAGES[ERROR_CODES.EXTERNAL_SERVICE_ERROR]
            });
        }
    }
);

router.post('/policies',
    authenticateToken,
    validateBody(z.object({
        type: z.string(),
        effectiveDate: z.string().transform(date => new Date(date)),
        expirationDate: z.string().transform(date => new Date(date)),
        coverages: z.array(z.object({
            type: z.string(),
            limits: z.object({
                perOccurrence: z.number(),
                aggregate: z.number()
            }),
            deductible: z.number()
        })).min(1)
    })),
    policyRateLimiter,
    async (req, res, next) => {
        try {
            const result = await circuitBreaker.fire(async () => {
                return await PolicyController.createPolicy(req, res, next);
            });
            return result;
        } catch (error) {
            logger.error('Failed to create policy', { error, requestBody: req.body });
            return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
                code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                message: ERROR_MESSAGES[ERROR_CODES.EXTERNAL_SERVICE_ERROR]
            });
        }
    }
);

router.put('/policies/:id',
    authenticateToken,
    validateParams(policyIdSchema),
    validateBody(z.object({
        status: z.string().optional(),
        premium: z.number().optional(),
        coverages: z.array(z.object({
            type: z.string(),
            limits: z.object({
                perOccurrence: z.number(),
                aggregate: z.number()
            }),
            deductible: z.number()
        })).optional()
    })),
    policyRateLimiter,
    async (req, res, next) => {
        try {
            const result = await circuitBreaker.fire(async () => {
                return await PolicyController.updatePolicy(req, res, next);
            });
            return result;
        } catch (error) {
            logger.error('Failed to update policy', { error, policyId: req.params.id, updates: req.body });
            return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
                code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                message: ERROR_MESSAGES[ERROR_CODES.EXTERNAL_SERVICE_ERROR]
            });
        }
    }
);

// Configure circuit breaker event handlers
circuitBreaker.on('open', () => {
    logger.warn('Circuit breaker opened for policy routes');
});

circuitBreaker.on('halfOpen', () => {
    logger.info('Circuit breaker half-opened for policy routes');
});

circuitBreaker.on('close', () => {
    logger.info('Circuit breaker closed for policy routes');
});

export default router;