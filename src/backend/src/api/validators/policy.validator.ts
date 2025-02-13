/**
 * @file Policy validation schemas and rules for MGA Operating System
 * @version 1.0.0
 * @description Implements comprehensive validation for policy-related requests using Zod
 * with enhanced business rules and carrier-specific validation logic.
 */

import { z } from 'zod'; // v3.21.4
import { 
  createValidationSchema, 
  validateRequest, 
  validateDateRange 
} from '../utils/validation';
import { PolicyType } from '../../constants/policyTypes';

// Types
type ValidationResult = {
  success: boolean;
  data?: any;
  errors?: Array<{
    path: string[];
    message: string;
    code: string;
    details?: Record<string, any>;
  }>;
  context?: {
    timestamp: Date;
    duration: number;
    validationLevel: 'strict' | 'partial';
  };
};

// Base policy validation schema
const basePolicySchema = createValidationSchema({
  policyNumber: z.string()
    .min(10)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Policy number must contain only uppercase letters, numbers, and hyphens'),
  
  policyType: z.nativeEnum(PolicyType, {
    errorMap: () => ({ message: 'Invalid policy type' })
  }),
  
  effectiveDate: z.date(),
  expirationDate: z.date(),
  
  premium: z.number()
    .min(0)
    .max(999999999.99)
    .transform(val => Number(val.toFixed(2))),
  
  coverageLimits: z.object({
    perOccurrence: z.number().min(0),
    aggregate: z.number().min(0)
  }),
  
  deductible: z.number().min(0),
  
  status: z.enum(['DRAFT', 'QUOTED', 'BOUND', 'ACTIVE', 'CANCELLED', 'EXPIRED']),
  
  carrierCode: z.string().min(2).max(10),
  
  stateCode: z.string().length(2),
  
  insuredInfo: z.object({
    name: z.string().min(1).max(100),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().length(2),
      zipCode: z.string().regex(/^\d{5}(-\d{4})?$/)
    }),
    email: z.string().email(),
    phone: z.string().regex(/^\+?1?\d{10,}$/)
  })
}, { cacheKey: 'base-policy-schema' });

/**
 * Validates policy creation request data against defined schema with enhanced business rules
 * @param policyData Policy data to validate
 * @param carrierConfig Carrier-specific configuration and rules
 * @returns Promise resolving to validation result with detailed error messages
 */
export async function validatePolicyCreate(
  policyData: unknown,
  carrierConfig: Record<string, any>
): Promise<ValidationResult> {
  // Extend base schema with carrier-specific rules
  const policyCreateSchema = basePolicySchema.extend({
    underwritingInfo: z.object({
      riskFactors: z.array(z.string()),
      notes: z.string().optional(),
      documents: z.array(z.object({
        type: z.string(),
        url: z.string().url()
      })).optional()
    })
  });

  // Custom validation rules
  const customValidations = async (data: any): Promise<string[]> => {
    const errors: string[] = [];

    // Validate date range
    if (!validateDateRange(data.effectiveDate, data.expirationDate, {
      allowPast: false,
      maxRangeInDays: carrierConfig.maxPolicyTermDays || 365,
      timezone: carrierConfig.timezone
    })) {
      errors.push('Invalid policy date range');
    }

    // Validate coverage limits based on policy type
    const maxLimit = carrierConfig.maxCoverageLimits?.[data.policyType];
    if (maxLimit && data.coverageLimits.aggregate > maxLimit) {
      errors.push(`Coverage limit exceeds maximum allowed for ${data.policyType}`);
    }

    return errors;
  };

  // Perform validation
  const result = await validateRequest(policyCreateSchema, policyData, {
    strict: true,
    enableLogging: true
  });

  // Add custom validation errors if base validation passed
  if (result.success) {
    const customErrors = await customValidations(result.data);
    if (customErrors.length > 0) {
      return {
        success: false,
        errors: customErrors.map(message => ({
          path: ['custom'],
          message,
          code: 'CUSTOM_VALIDATION_FAILED'
        })),
        context: result.context
      };
    }
  }

  return result;
}

/**
 * Validates policy update request data with change tracking and status transitions
 * @param policyData Updated policy data
 * @param currentPolicy Current policy data
 * @param carrierConfig Carrier configuration
 * @returns Promise resolving to validation result with change tracking
 */
export async function validatePolicyUpdate(
  policyData: unknown,
  currentPolicy: Record<string, any>,
  carrierConfig: Record<string, any>
): Promise<ValidationResult> {
  // Create update-specific schema
  const policyUpdateSchema = basePolicySchema
    .partial()
    .extend({
      changeReason: z.string().min(1).max(500),
      statusTransition: z.object({
        from: z.string(),
        to: z.string(),
        reason: z.string()
      }).optional()
    });

  // Validate status transitions
  const validateStatusTransition = (from: string, to: string): boolean => {
    const allowedTransitions: Record<string, string[]> = {
      'DRAFT': ['QUOTED'],
      'QUOTED': ['BOUND', 'DRAFT'],
      'BOUND': ['ACTIVE', 'CANCELLED'],
      'ACTIVE': ['CANCELLED', 'EXPIRED'],
      'CANCELLED': [],
      'EXPIRED': []
    };
    return allowedTransitions[from]?.includes(to) || false;
  };

  // Perform validation
  const result = await validateRequest(policyUpdateSchema, policyData, {
    partial: true,
    enableLogging: true
  });

  // Additional validation for status transitions
  if (result.success && result.data?.status && result.data.status !== currentPolicy.status) {
    if (!validateStatusTransition(currentPolicy.status, result.data.status)) {
      return {
        success: false,
        errors: [{
          path: ['status'],
          message: `Invalid status transition from ${currentPolicy.status} to ${result.data.status}`,
          code: 'INVALID_STATUS_TRANSITION'
        }],
        context: result.context
      };
    }
  }

  return result;
}

/**
 * Validates endorsement creation with premium adjustments and effective dates
 * @param endorsementData Endorsement data to validate
 * @param policyData Parent policy data
 * @param carrierConfig Carrier configuration
 * @returns Promise resolving to validation result with endorsement context
 */
export async function validateEndorsementCreate(
  endorsementData: unknown,
  policyData: Record<string, any>,
  carrierConfig: Record<string, any>
): Promise<ValidationResult> {
  const endorsementSchema = createValidationSchema({
    type: z.string().min(1),
    effectiveDate: z.date(),
    description: z.string().min(1).max(500),
    premiumAdjustment: z.number(),
    changes: z.record(z.unknown()),
    documents: z.array(z.object({
      type: z.string(),
      url: z.string().url()
    })).optional()
  });

  // Custom endorsement validations
  const validateEndorsement = async (data: any): Promise<string[]> => {
    const errors: string[] = [];

    // Validate effective date is within policy period
    if (data.effectiveDate < policyData.effectiveDate || 
        data.effectiveDate > policyData.expirationDate) {
      errors.push('Endorsement effective date must be within policy period');
    }

    // Validate premium adjustment limits
    const maxAdjustment = policyData.premium * (carrierConfig.maxPremiumAdjustmentPercent || 0.25);
    if (Math.abs(data.premiumAdjustment) > maxAdjustment) {
      errors.push('Premium adjustment exceeds maximum allowed percentage');
    }

    return errors;
  };

  // Perform validation
  const result = await validateRequest(endorsementSchema, endorsementData, {
    strict: true,
    enableLogging: true
  });

  // Add endorsement-specific validations
  if (result.success) {
    const endorsementErrors = await validateEndorsement(result.data);
    if (endorsementErrors.length > 0) {
      return {
        success: false,
        errors: endorsementErrors.map(message => ({
          path: ['endorsement'],
          message,
          code: 'ENDORSEMENT_VALIDATION_FAILED'
        })),
        context: result.context
      };
    }
  }

  return result;
}