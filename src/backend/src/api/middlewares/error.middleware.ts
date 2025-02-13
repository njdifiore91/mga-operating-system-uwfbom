import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { logger, error as logError } from '../../utils/logger';
import { MetricsManager } from '../../utils/metrics';
import { 
  HTTP_STATUS_CODES, 
  ERROR_CODES, 
  ERROR_MESSAGES, 
  ERROR_SEVERITY,
  ERROR_CODE_HTTP_MAP 
} from '../../constants/errorCodes';

// Initialize metrics manager for error tracking
const metricsManager = new MetricsManager();

/**
 * Interface for standardized error response structure
 */
interface ErrorResponse {
  code: string;
  message: string;
  correlationId?: string;
  timestamp: string;
  severity: ERROR_SEVERITY;
  requestId?: string;
  details?: any;
  stack?: string;
}

/**
 * Custom error class for application-specific errors
 */
class ApplicationError extends Error {
  public code: ERROR_CODES;
  public severity: ERROR_SEVERITY;
  public details?: any;

  constructor(code: ERROR_CODES, message?: string, details?: any) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.severity = getSeverityForError(code);
    this.details = details;
  }
}

/**
 * Maps error codes to severity levels for monitoring
 */
const getSeverityForError = (code: ERROR_CODES): ERROR_SEVERITY => {
  switch (code) {
    case ERROR_CODES.SYSTEM_ERROR:
    case ERROR_CODES.INTEGRATION_ERROR:
    case ERROR_CODES.EXTERNAL_SERVICE_ERROR:
      return ERROR_SEVERITY.CRITICAL;
    
    case ERROR_CODES.AUTHENTICATION_ERROR:
    case ERROR_CODES.AUTHORIZATION_ERROR:
    case ERROR_CODES.DATA_INTEGRITY_ERROR:
      return ERROR_SEVERITY.HIGH;
    
    case ERROR_CODES.BUSINESS_RULE_ERROR:
    case ERROR_CODES.UNDERWRITING_ERROR:
    case ERROR_CODES.BILLING_ERROR:
      return ERROR_SEVERITY.MEDIUM;
    
    case ERROR_CODES.VALIDATION_ERROR:
    case ERROR_CODES.DUPLICATE_ERROR:
    case ERROR_CODES.DOCUMENT_ERROR:
      return ERROR_SEVERITY.LOW;
    
    default:
      return ERROR_SEVERITY.INFO;
  }
};

/**
 * Formats error details into standardized response structure
 */
const formatErrorResponse = (
  error: Error | ApplicationError,
  statusCode: number,
  correlationId?: string
): ErrorResponse => {
  const isAppError = error instanceof ApplicationError;
  const errorCode = isAppError ? error.code : ERROR_CODES.SYSTEM_ERROR;
  const severity = isAppError ? error.severity : ERROR_SEVERITY.CRITICAL;

  const response: ErrorResponse = {
    code: errorCode,
    message: error.message || ERROR_MESSAGES[errorCode],
    correlationId,
    timestamp: new Date().toISOString(),
    severity,
    requestId: correlationId
  };

  // Include error details for non-production environments
  if (process.env.NODE_ENV !== 'production') {
    response.details = isAppError ? error.details : undefined;
    response.stack = error.stack;
  }

  return response;
};

/**
 * Express middleware for centralized error handling
 */
export const errorHandler = (
  err: Error | ApplicationError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract correlation ID from request headers
  const correlationId = req.headers['x-correlation-id'] as string;

  // Determine appropriate status code
  const statusCode = err instanceof ApplicationError
    ? ERROR_CODE_HTTP_MAP[err.code]
    : HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

  // Log error with correlation ID and metadata
  logError('Request error occurred', err, {
    correlationId,
    path: req.path,
    method: req.method,
    statusCode,
    requestId: req.id
  });

  // Record error metrics
  metricsManager.recordAPIMetrics({
    method: req.method,
    path: req.path,
    statusCode,
    responseTime: Date.now() - (req.startTime || Date.now()),
    requestSize: parseInt(req.headers['content-length'] || '0'),
    responseSize: parseInt(res.getHeader('content-length') as string || '0'),
    clientId: req.headers['x-client-id'] as string
  });

  // Format and send error response
  const errorResponse = formatErrorResponse(err, statusCode, correlationId);
  res.status(statusCode).json(errorResponse);
};

/**
 * Express middleware to handle 404 Not Found errors
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new ApplicationError(
    ERROR_CODES.NOT_FOUND_ERROR,
    `Resource not found: ${req.path}`
  );
  next(error);
};

/**
 * Express middleware to handle validation errors
 */
export const validationErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err?.name === 'ValidationError') {
    const error = new ApplicationError(
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      err.details
    );
    next(error);
  } else {
    next(err);
  }
};