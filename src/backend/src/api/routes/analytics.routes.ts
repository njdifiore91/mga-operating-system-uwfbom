/**
 * @file Analytics routes configuration for MGA Operating System
 * @version 1.0.0
 * 
 * Implements secure, scalable routes for accessing analytics data with 
 * comprehensive validation, caching, and monitoring controls.
 */

import { Router } from 'express'; // v4.18.2
import { z } from 'zod'; // v3.21.4
import rateLimit from 'express-rate-limit'; // v6.9.0
import cache from 'express-cache-middleware'; // v1.0.1
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateQuery, validateBody } from '../middlewares/validation.middleware';
import { MetricsManager } from '../../utils/metrics';
import { error } from '../../utils/logger';

// Initialize router
const router = Router();

// Initialize controllers
const analyticsController = new AnalyticsController(
  new MetricsManager(),
  cache({ ttl: 300 }) // 5 minute cache TTL
);

// Rate limiting configuration
const standardRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many analytics requests, please try again later'
});

const reportRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 report generations per minute
  message: 'Too many report generation requests, please try again later'
});

// Validation Schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime().min(new Date('2020-01-01')),
  endDate: z.string().datetime().max(new Date()),
  timezone: z.string().optional().default('UTC')
});

const underwritingMetricsSchema = z.object({
  startDate: z.string().datetime().min(new Date('2020-01-01')),
  endDate: z.string().datetime().max(new Date()),
  policyType: z.enum(['commercial', 'personal', 'specialty']).optional(),
  status: z.enum(['pending', 'approved', 'declined']).optional(),
  timezone: z.string().optional().default('UTC')
});

const reportConfigSchema = z.object({
  reportType: z.enum(['policy', 'claims', 'performance', 'compliance']),
  dateRange: dateRangeSchema,
  filters: z.record(z.string(), z.any()).optional(),
  format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
  includeCharts: z.boolean().default(true)
});

// Route Handlers
try {
  // Policy metrics endpoint
  router.get(
    '/policy-metrics',
    authenticateToken,
    validateQuery(dateRangeSchema),
    standardRateLimit,
    cache({ ttl: 300 }),
    analyticsController.getPolicyMetrics
  );

  // Underwriting metrics endpoint
  router.get(
    '/underwriting-metrics',
    authenticateToken,
    validateQuery(underwritingMetricsSchema),
    standardRateLimit,
    cache({ ttl: 300 }),
    analyticsController.getUnderwritingMetrics
  );

  // Compliance metrics endpoint
  router.get(
    '/compliance-metrics',
    authenticateToken,
    validateQuery(dateRangeSchema),
    standardRateLimit,
    cache({ ttl: 300 }),
    analyticsController.getComplianceMetrics
  );

  // Report generation endpoint
  router.post(
    '/reports',
    authenticateToken,
    validateBody(reportConfigSchema),
    reportRateLimit,
    analyticsController.generateReport
  );

} catch (err) {
  error('Failed to initialize analytics routes', err);
  throw err;
}

export default router;