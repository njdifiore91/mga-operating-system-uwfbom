import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { http } from '../../utils/logger';
import { MetricsManager } from '../../utils/metrics';

// Global constants
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];
const metricsManager = new MetricsManager();

/**
 * Express middleware that provides comprehensive request/response logging
 * with correlation tracking, performance metrics, and ELK Stack integration
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique correlation ID for request tracking
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.headers['x-correlation-id'] = correlationId;

  // Capture request start time for performance tracking
  const startTime = process.hrtime();

  // Log incoming request with sanitized data
  http('Incoming request', { request: formatRequestLog(req) });

  // Capture response by overriding end method
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    // Calculate request duration
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = (seconds * 1000) + (nanoseconds / 1000000);

    // Format and log response details
    const responseLog = formatResponseLog(res, duration);
    http('Request completed', { 
      request: formatRequestLog(req),
      response: responseLog 
    });

    // Record metrics
    metricsManager.recordAPIMetrics({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: duration,
      requestSize: parseInt(req.headers['content-length'] || '0'),
      responseSize: parseInt(res.getHeader('content-length')?.toString() || '0'),
      clientId: req.headers['x-client-id']?.toString()
    });

    // Check response time against SLO thresholds
    if (duration > 2000) {
      http('Response time exceeded critical threshold', {
        duration,
        path: req.path,
        method: req.method,
        correlationId
      });
    } else if (duration > 1500) {
      http('Response time exceeded warning threshold', {
        duration,
        path: req.path,
        method: req.method,
        correlationId
      });
    }

    // Propagate correlation ID to response
    res.setHeader('x-correlation-id', correlationId);

    // Call original end method
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
};

/**
 * Formats request details for structured logging with sensitive data handling
 */
const formatRequestLog = (req: Request): object => {
  // Deep clone headers to avoid modifying original
  const sanitizedHeaders = JSON.parse(JSON.stringify(req.headers));

  // Remove sensitive header values
  for (const header of SENSITIVE_HEADERS) {
    if (sanitizedHeaders[header]) {
      sanitizedHeaders[header] = '[REDACTED]';
    }
  }

  return {
    method: req.method,
    url: req.url,
    path: req.path,
    headers: sanitizedHeaders,
    query: req.query,
    correlationId: req.headers['x-correlation-id'],
    timestamp: new Date().toISOString(),
    clientIp: req.ip,
    userAgent: req.headers['user-agent']
  };
};

/**
 * Formats response details with performance metrics and correlation tracking
 */
const formatResponseLog = (res: Response, duration: number): object => {
  // Deep clone headers to avoid modifying original
  const sanitizedHeaders = JSON.parse(JSON.stringify(res.getHeaders()));

  // Remove sensitive header values
  for (const header of SENSITIVE_HEADERS) {
    if (sanitizedHeaders[header]) {
      sanitizedHeaders[header] = '[REDACTED]';
    }
  }

  return {
    statusCode: res.statusCode,
    headers: sanitizedHeaders,
    responseTime: duration,
    correlationId: res.req.headers['x-correlation-id'],
    timestamp: new Date().toISOString(),
    contentLength: res.getHeader('content-length'),
    contentType: res.getHeader('content-type')
  };
};