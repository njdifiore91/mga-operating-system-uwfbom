/**
 * @fileoverview Express router configuration for compliance-related endpoints
 * Implements secure routes for regulatory checks, reporting, and audit functionality
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import CircuitBreaker from 'opossum'; // v6.4.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import winston from 'winston'; // v3.8.2
import { ComplianceController } from '../controllers/ComplianceController';
import { authenticateToken, validateMFA } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { complianceCheckSchema, complianceReportSchema } from '../validators/compliance.validator';
import { ERROR_CODES, HTTP_STATUS_CODES } from '../../constants/errorCodes';

// Initialize router with strict routing
const router = Router({ strict: true });

// Circuit breaker configuration for external system calls
const circuitBreakerOptions = {
    timeout: 10000, // 10 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 30000, // 30 seconds
};

// Rate limiting configurations
const checkRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        code: ERROR_CODES.RATE_LIMIT_ERROR,
        message: 'Too many compliance check requests'
    }
});

const reportRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: {
        code: ERROR_CODES.RATE_LIMIT_ERROR,
        message: 'Too many compliance report submissions'
    }
});

const scheduleRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: {
        code: ERROR_CODES.RATE_LIMIT_ERROR,
        message: 'Too many compliance schedule requests'
    }
});

// Create circuit breakers for external calls
const checkBreaker = new CircuitBreaker(
    async (req, res, next) => {
        await ComplianceController.prototype.performComplianceCheck(req, res, next);
    },
    circuitBreakerOptions
);

const reportBreaker = new CircuitBreaker(
    async (req, res, next) => {
        await ComplianceController.prototype.submitComplianceReport(req, res, next);
    },
    circuitBreakerOptions
);

// Configure routes with security middleware stack
router.use(authenticateToken);

// POST /api/v1/compliance/check - Perform compliance check
router.post('/check',
    validateMFA,
    checkRateLimit,
    validateBody(complianceCheckSchema),
    async (req, res, next) => {
        try {
            await checkBreaker.fire(req, res, next);
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/v1/compliance/report - Submit compliance report
router.post('/report',
    validateMFA,
    reportRateLimit,
    validateBody(complianceReportSchema),
    async (req, res, next) => {
        try {
            await reportBreaker.fire(req, res, next);
        } catch (error) {
            next(error);
        }
    }
);

// POST /api/v1/compliance/schedule - Schedule compliance check
router.post('/schedule',
    validateMFA,
    scheduleRateLimit,
    validateBody(complianceCheckSchema),
    async (req, res, next) => {
        try {
            await ComplianceController.prototype.scheduleComplianceCheck(req, res, next);
        } catch (error) {
            next(error);
        }
    }
);

// Error handling middleware
router.use((error: any, req: any, res: any, next: any) => {
    winston.error('Compliance route error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        correlationId: req.headers['x-correlation-id']
    });

    res.status(error.status || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        code: error.code || ERROR_CODES.SYSTEM_ERROR,
        message: error.message || 'Internal server error',
        correlationId: req.headers['x-correlation-id']
    });
});

// Circuit breaker event handlers
[checkBreaker, reportBreaker].forEach(breaker => {
    breaker.on('open', () => {
        winston.warn('Circuit breaker opened', {
            service: 'compliance',
            timestamp: new Date().toISOString()
        });
    });

    breaker.on('halfOpen', () => {
        winston.info('Circuit breaker half-open', {
            service: 'compliance',
            timestamp: new Date().toISOString()
        });
    });

    breaker.on('close', () => {
        winston.info('Circuit breaker closed', {
            service: 'compliance',
            timestamp: new Date().toISOString()
        });
    });
});

export { router as complianceRoutes };