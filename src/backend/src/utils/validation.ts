/**
 * @file Core validation utility module for MGA Operating System
 * @version 1.0.0
 * @description Provides comprehensive Zod schema builders and validation helpers with
 * enhanced support for insurance-specific data validation, error handling, and performance optimization.
 * @package zod v3.21.4
 */

import { z } from 'zod';

// Types
type ValidationOptions = {
  partial?: boolean;
  strict?: boolean;
  cacheKey?: string;
  enableLogging?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
};

type ValidationResult<T = any> = {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  context?: ValidationContext;
};

type ValidationError = {
  path: string[];
  message: string;
  code: string;
  details?: Record<string, any>;
};

type ValidationContext = {
  timestamp: Date;
  duration: number;
  schemaId?: string;
  validationLevel: 'strict' | 'partial';
};

// Cache for schema validation
const schemaCache = new Map<string, z.ZodSchema>();

/**
 * Creates a type-safe Zod validation schema with enhanced validation rules
 * @param schemaDefinition Object defining the schema structure and rules
 * @param options Configuration options for schema creation
 * @returns Configured Zod schema with comprehensive validation rules
 */
export function createValidationSchema<T extends z.ZodRawShape>(
  schemaDefinition: T,
  options: ValidationOptions = {}
): z.ZodObject<T> {
  const { cacheKey, strict = true } = options;

  // Check cache first if cacheKey provided
  if (cacheKey && schemaCache.has(cacheKey)) {
    return schemaCache.get(cacheKey) as z.ZodObject<T>;
  }

  const schema = z.object(schemaDefinition).strict(strict);

  // Cache schema if cacheKey provided
  if (cacheKey) {
    schemaCache.set(cacheKey, schema);
  }

  return schema;
}

/**
 * Enhanced request validation with detailed error handling and validation context
 * @param schema Zod schema to validate against
 * @param data Input data to validate
 * @param options Validation configuration options
 * @returns Promise resolving to detailed validation result
 */
export async function validateRequest<T>(
  schema: z.ZodSchema,
  data: unknown,
  options: ValidationOptions = {}
): Promise<ValidationResult<T>> {
  const startTime = Date.now();
  const { partial = false, enableLogging = false, rateLimit } = options;

  // Initialize validation context
  const context: ValidationContext = {
    timestamp: new Date(),
    duration: 0,
    validationLevel: partial ? 'partial' : 'strict',
  };

  try {
    // Apply rate limiting if configured
    if (rateLimit) {
      // Rate limiting logic would go here
    }

    // Perform validation
    const validationSchema = partial ? schema.partial() : schema;
    const validatedData = await validationSchema.parseAsync(data);

    const result: ValidationResult<T> = {
      success: true,
      data: validatedData as T,
      context: {
        ...context,
        duration: Date.now() - startTime,
      },
    };

    if (enableLogging) {
      logValidationResult(result);
    }

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = formatZodErrors(error);
      const result: ValidationResult = {
        success: false,
        errors: formattedErrors,
        context: {
          ...context,
          duration: Date.now() - startTime,
        },
      };

      if (enableLogging) {
        logValidationResult(result);
      }

      return result;
    }
    throw error;
  }
}

/**
 * Advanced date range validation with timezone handling and insurance-specific rules
 * @param startDate Start date to validate
 * @param endDate End date to validate
 * @param options Validation options including business rules
 * @returns Boolean indicating if date range is valid
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date,
  options: {
    allowPast?: boolean;
    maxRangeInDays?: number;
    businessDaysOnly?: boolean;
    timezone?: string;
  } = {}
): boolean {
  const {
    allowPast = false,
    maxRangeInDays,
    businessDaysOnly = false,
    timezone = 'UTC',
  } = options;

  // Convert dates to specified timezone
  const tzStartDate = new Date(startDate.toLocaleString('en-US', { timeZone: timezone }));
  const tzEndDate = new Date(endDate.toLocaleString('en-US', { timeZone: timezone }));
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

  // Basic date validation
  if (!allowPast && tzStartDate < now) {
    return false;
  }

  if (tzEndDate <= tzStartDate) {
    return false;
  }

  // Check maximum range if specified
  if (maxRangeInDays) {
    const diffInDays = (tzEndDate.getTime() - tzStartDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffInDays > maxRangeInDays) {
      return false;
    }
  }

  // Business days validation if required
  if (businessDaysOnly) {
    return isBusinessDayRange(tzStartDate, tzEndDate);
  }

  return true;
}

/**
 * Enhanced numeric validation with currency and precision support
 * @param value Number to validate
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @param options Validation options including currency and precision rules
 * @returns Boolean indicating if number is valid
 */
export function validateNumericRange(
  value: number,
  min: number,
  max: number,
  options: {
    currency?: boolean;
    precision?: number;
    allowNegative?: boolean;
  } = {}
): boolean {
  const { currency = false, precision, allowNegative = false } = options;

  // Basic range validation
  if (!allowNegative && value < 0) {
    return false;
  }

  if (value < min || value > max) {
    return false;
  }

  // Currency validation
  if (currency) {
    const decimalPlaces = (value.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      return false;
    }
  }

  // Precision validation
  if (typeof precision === 'number') {
    const decimalPlaces = (value.toString().split('.')[1] || '').length;
    if (decimalPlaces > precision) {
      return false;
    }
  }

  return true;
}

// Helper Functions

/**
 * Formats Zod validation errors into a standardized format
 * @param error Zod error object
 * @returns Array of formatted validation errors
 */
function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    path: err.path,
    message: err.message,
    code: err.code,
    details: {
      received: err.received,
      expected: err.expected,
    },
  }));
}

/**
 * Checks if a date range only includes business days
 * @param startDate Range start date
 * @param endDate Range end date
 * @returns Boolean indicating if range only includes business days
 */
function isBusinessDayRange(startDate: Date, endDate: Date): boolean {
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day === 0 || day === 6) {
      return false;
    }
    current.setDate(current.getDate() + 1);
  }
  return true;
}

/**
 * Logs validation results for monitoring and debugging
 * @param result Validation result to log
 */
function logValidationResult(result: ValidationResult): void {
  // Logging implementation would go here
  // Could integrate with application logging system
  console.log('[Validation]', {
    timestamp: result.context?.timestamp,
    duration: result.context?.duration,
    success: result.success,
    errors: result.errors,
  });
}

// Re-export enhanced Zod schema builders
export { z };