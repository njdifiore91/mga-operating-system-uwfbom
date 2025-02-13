/**
 * @fileoverview Main Express application configuration for MGA Operating System
 * Implements comprehensive security, monitoring and integration features
 * @version 1.0.0
 */

import express, { Application, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import cors from 'cors'; // v2.8.5
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import Redis from 'ioredis'; // v5.3.2
import { authenticateToken } from './api/middlewares/auth.middleware';
import { errorHandler, notFoundHandler, validationErrorHandler } from './api/middlewares/error.middleware';
import { requestLoggingMiddleware } from './api/middlewares/logging.middleware';
import { metricsManager } from './utils/metrics';
import { logger } from './utils/logger';

// Initialize Express application
const app: Application = express();

// Initialize Redis client for rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
});

/**
 * Configures security middleware with strict settings
 */
const configureSecurity = (app: Application): void => {
  // Configure Helmet with strict security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true
  }));

  // Configure CORS with strict origin validation
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://mga-os.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-client-id'],
    exposedHeaders: ['x-correlation-id'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Configure rate limiting
  const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rate_limit',
    points: 1000, // Max requests per duration
    duration: 60, // Per minute
    blockDuration: 300 // Block for 5 minutes if exceeded
  });

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch (error) {
      res.status(429).json({
        code: 'ERR_RATE_LIMIT',
        message: 'Too many requests, please try again later'
      });
    }
  });
};

/**
 * Configures middleware chain with monitoring and performance features
 */
const configureMiddleware = (app: Application): void => {
  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request logging and metrics
  app.use(requestLoggingMiddleware);

  // Authentication
  app.use(authenticateToken);

  // Error handling
  app.use(validationErrorHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);
};

/**
 * Configures monitoring endpoints and health checks
 */
const configureMonitoring = (app: Application): void => {
  // Metrics endpoint
  app.get('/metrics', metricsManager.getMetricsMiddleware());

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      // Check Redis connection
      await redisClient.ping();

      // Add additional health checks here
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        services: {
          redis: 'connected'
        }
      });
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });
};

/**
 * Initializes API routes for the application
 */
const configureRoutes = (app: Application): void => {
  // Import and configure route handlers
  const policyRoutes = require('./api/routes/policy.routes');
  const underwritingRoutes = require('./api/routes/underwriting.routes');
  const billingRoutes = require('./api/routes/billing.routes');
  const documentRoutes = require('./api/routes/document.routes');

  // Mount route handlers
  app.use('/api/v1/policies', policyRoutes);
  app.use('/api/v1/underwriting', underwritingRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/documents', documentRoutes);
};

// Initialize application
const initializeApp = (): Application => {
  // Configure security features
  configureSecurity(app);

  // Configure middleware
  configureMiddleware(app);

  // Configure monitoring
  configureMonitoring(app);

  // Configure routes
  configureRoutes(app);

  // Log application startup
  logger.info('Application initialized successfully', {
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    startupTime: new Date().toISOString()
  });

  return app;
};

// Export configured application
export default initializeApp();