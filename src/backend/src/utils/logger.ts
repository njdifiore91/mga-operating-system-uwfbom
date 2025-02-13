import winston from 'winston'; // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1
import { ElasticsearchTransport } from 'winston-elasticsearch'; // v0.17.1
import { getLogger as getConfigLogger, getLoggerConfig } from '../config/logger';

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Default metadata for all log entries
const DEFAULT_META = {
  service: 'mga-os',
  environment: process.env.NODE_ENV
};

// Singleton logger instance
let loggerInstance: winston.Logger | null = null;

/**
 * Returns a singleton instance of the configured Winston logger
 * with ELK Stack integration and correlation tracking
 */
export const getLogger = (): winston.Logger => {
  if (!loggerInstance) {
    loggerInstance = getConfigLogger();
  }
  return loggerInstance;
};

/**
 * Logs error messages with stack traces and detailed metadata
 * @param message Error message to log
 * @param error Error object or error details
 * @param metadata Additional contextual information
 */
export const error = (
  message: string,
  error?: Error | object,
  metadata: object = {}
): void => {
  const logger = getLogger();
  const errorDetails = error instanceof Error ? {
    stack: error.stack,
    code: (error as any).code,
    ...error
  } : error;

  // Filter sensitive data
  const sanitizedMetadata = filterSensitiveData({ ...metadata });
  const sanitizedError = filterSensitiveData(errorDetails || {});

  logger.error(message, {
    ...DEFAULT_META,
    ...sanitizedMetadata,
    error: sanitizedError
  });
};

/**
 * Logs warning messages with correlation tracking
 * @param message Warning message to log
 * @param metadata Additional contextual information
 */
export const warn = (message: string, metadata: object = {}): void => {
  const logger = getLogger();
  const sanitizedMetadata = filterSensitiveData({ ...metadata });

  logger.warn(message, {
    ...DEFAULT_META,
    ...sanitizedMetadata
  });
};

/**
 * Logs informational messages with performance metrics
 * @param message Info message to log
 * @param metadata Additional contextual information
 */
export const info = (message: string, metadata: object = {}): void => {
  const logger = getLogger();
  const sanitizedMetadata = filterSensitiveData({ ...metadata });

  logger.info(message, {
    ...DEFAULT_META,
    ...sanitizedMetadata
  });
};

/**
 * Logs HTTP request/response details with correlation IDs
 * @param message HTTP-related message to log
 * @param metadata Request/response details and metrics
 */
export const http = (message: string, metadata: object = {}): void => {
  const logger = getLogger();
  const {
    request,
    response,
    ...rest
  } = metadata as any;

  // Filter sensitive headers and body data
  const sanitizedRequest = request ? filterSensitiveData({
    method: request.method,
    url: request.url,
    headers: filterSensitiveHeaders(request.headers),
    body: filterSensitiveData(request.body)
  }) : undefined;

  const sanitizedResponse = response ? filterSensitiveData({
    statusCode: response.statusCode,
    headers: filterSensitiveHeaders(response.headers),
    responseTime: response.responseTime
  }) : undefined;

  logger.http(message, {
    ...DEFAULT_META,
    ...filterSensitiveData(rest),
    ...(sanitizedRequest && { request: sanitizedRequest }),
    ...(sanitizedResponse && { response: sanitizedResponse })
  });
};

/**
 * Logs debug messages with detailed metadata
 * @param message Debug message to log
 * @param metadata Additional debugging information
 */
export const debug = (message: string, metadata: object = {}): void => {
  const logger = getLogger();
  const sanitizedMetadata = filterSensitiveData({ ...metadata });

  logger.debug(message, {
    ...DEFAULT_META,
    ...sanitizedMetadata,
    stack: new Error().stack
  });
};

/**
 * Filters sensitive data from objects before logging
 * @param obj Object to sanitize
 * @returns Sanitized object
 */
const filterSensitiveData = (obj: object): object => {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'authorization',
    'key',
    'ssn',
    'creditCard'
  ];

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      acc[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      acc[key] = filterSensitiveData(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
};

/**
 * Filters sensitive headers from request/response
 * @param headers Headers object to sanitize
 * @returns Sanitized headers
 */
const filterSensitiveHeaders = (headers: object): object => {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'session',
    'token'
  ];

  return Object.entries(headers || {}).reduce((acc, [key, value]) => {
    if (sensitiveHeaders.some(h => key.toLowerCase().includes(h))) {
      acc[key] = '[REDACTED]';
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
};