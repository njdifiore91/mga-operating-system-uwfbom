/**
 * @file Underwriting routes configuration for MGA Operating System
 * @version 1.0.0
 * @description Implements secure, performant API routes for automated underwriting
 * with comprehensive validation, caching, and OneShield integration
 */

import { Router } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import performanceMonitor from 'express-performance-monitor'; // ^1.0.0
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateBody, validateParams } from '../middlewares/validation.middleware';
import { UnderwritingController } from '../controllers/UnderwritingController';
import { riskAssessmentSchema, underwritingDecisionSchema } from '../validators/underwriting.validator';
import { logger } from '../../utils/logger';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../constants/errorCodes';

// Initialize router
const router = Router();

// Configure rate limiting
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Max 1000 requests per minute
  message: {
    code: ERROR_CODES.RATE_LIMIT_ERROR,
    message: 'Too many requests, please try again later'
  }
});

// Configure performance monitoring
const performanceOptions = {
  path: '/metrics',
  spans: [
    { interval: 1, retention: 60 },    // 1 second spans for last minute
    { interval: 5, retention: 60 * 12 } // 5 second spans for last hour
  ],
  thresholds: {
    http: 2000  // 2 seconds max response time
  }
};

// Apply global middleware
router.use(rateLimiter);
router.use(performanceMonitor(performanceOptions));

/**
 * POST /api/v1/underwriting/risk-assessment
 * Performs automated risk assessment for a policy
 */
router.post('/risk-assessment',
  authenticateToken,
  validateBody(riskAssessmentSchema),
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const assessment = await UnderwritingController.assessPolicyRisk(req.body);

      logger.info('Risk assessment completed', {
        policyId: req.body.policyId,
        duration: Date.now() - startTime,
        riskScore: assessment.riskScore
      });

      res.status(HTTP_STATUS_CODES.OK).json(assessment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/underwriting/decision
 * Makes automated underwriting decision with OneShield integration
 */
router.post('/decision',
  authenticateToken,
  validateBody(underwritingDecisionSchema),
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const decision = await UnderwritingController.makeDecision(req.body);

      logger.info('Underwriting decision completed', {
        policyId: req.body.policyId,
        duration: Date.now() - startTime,
        status: decision.status
      });

      res.status(HTTP_STATUS_CODES.OK).json(decision);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/underwriting/evaluate/:policyId
 * Evaluates complete policy with OneShield status check
 */
router.get('/evaluate/:policyId',
  authenticateToken,
  validateParams(riskAssessmentSchema.pick({ policyId: true })),
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const evaluation = await UnderwritingController.evaluatePolicy(req.params.policyId);

      logger.info('Policy evaluation completed', {
        policyId: req.params.policyId,
        duration: Date.now() - startTime
      });

      res.status(HTTP_STATUS_CODES.OK).json(evaluation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/underwriting/health
 * OneShield integration health check endpoint
 */
router.get('/health',
  authenticateToken,
  async (req, res, next) => {
    try {
      const startTime = Date.now();
      const status = await UnderwritingController.checkOneShieldStatus();

      logger.info('OneShield health check completed', {
        duration: Date.now() - startTime,
        status: status.available ? 'UP' : 'DOWN'
      });

      res.status(HTTP_STATUS_CODES.OK).json(status);
    } catch (error) {
      next(error);
    }
  }
);

// Error handling middleware
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Underwriting route error', {
    error: error.message,
    stack: error.stack,
    path: req.path
  });

  res.status(error.status || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
    code: error.code || ERROR_CODES.UNDERWRITING_ERROR,
    message: error.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

export default router;