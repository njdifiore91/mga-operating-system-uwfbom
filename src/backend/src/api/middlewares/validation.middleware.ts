/**
 * @file Express middleware for request validation using Zod schemas
 * @version 1.0.0
 * @description Provides centralized validation for all API endpoints in the MGA Operating System
 * @package express ^4.18.2
 * @package zod 3.21.4
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { HTTP_STATUS_CODES } from '../../constants/errorCodes';

// Types
interface ValidationOptions {
  partial?: boolean;
  strict?: boolean;
  enableLogging?: boolean;
  stripUnknown?: boolean;
  context?: Record<string, any>;
}

interface ValidationContext {
  timestamp: Date;
  duration: number;
  path: string;
  method: string;
  correlationId?: string;
}

/**
 * Factory function that creates a validation middleware for a specific Zod schema
 * @param schema Zod schema to validate against
 * @param options Validation configuration options
 * @returns Express middleware function
 */
const createValidationMiddleware = (
  schema: z.ZodSchema,
  options: ValidationOptions = {}
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    // Create validation context with request metadata
    const context: ValidationContext = {
      timestamp: new Date(),
      duration: 0,
      path: req.path,
      method: req.method,
      correlationId: req.headers['x-correlation-id'] as string
    };

    try {
      const validationResult = await validateRequest(schema, req.body, {
        partial: options.partial,
        strict: options.strict,
        enableLogging: options.enableLogging
      });

      context.duration = Date.now() - startTime;

      if (!validationResult.success) {
        logger.error('Request validation failed', {
          errors: validationResult.errors,
          context
        });

        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          errors: validationResult.errors,
          context
        });
      }

      // Attach validated data to request
      req.body = validationResult.data;

      logger.debug('Request validation successful', {
        path: req.path,
        method: req.method,
        duration: context.duration
      });

      next();
    } catch (error) {
      context.duration = Date.now() - startTime;

      logger.error('Validation middleware error', {
        error,
        context
      });

      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error during validation',
        context
      });
    }
  };
};

/**
 * Middleware for validating request body data
 * @param schema Zod schema for body validation
 * @param options Validation options
 * @returns Express middleware function
 */
export const validateBody = (
  schema: z.ZodSchema,
  options: ValidationOptions = {}
): ReturnType<typeof createValidationMiddleware> => {
  return createValidationMiddleware(schema, {
    ...options,
    strict: true
  });
};

/**
 * Middleware for validating request query parameters
 * @param schema Zod schema for query validation
 * @param options Validation options
 * @returns Express middleware function
 */
export const validateQuery = (
  schema: z.ZodSchema,
  options: ValidationOptions = {}
): ReturnType<typeof createValidationMiddleware> => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Replace req.body with req.query for validation
    req.body = req.query;
    const middleware = createValidationMiddleware(schema, {
      ...options,
      strict: false // Allow additional query parameters
    });
    await middleware(req, res, next);
  };
};

/**
 * Middleware for validating request URL parameters
 * @param schema Zod schema for params validation
 * @param options Validation options
 * @returns Express middleware function
 */
export const validateParams = (
  schema: z.ZodSchema,
  options: ValidationOptions = {}
): ReturnType<typeof createValidationMiddleware> => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Replace req.body with req.params for validation
    req.body = req.params;
    const middleware = createValidationMiddleware(schema, {
      ...options,
      strict: true // Params must match exactly
    });
    await middleware(req, res, next);
  };
};

export {
  createValidationMiddleware,
  type ValidationOptions,
  type ValidationContext
};