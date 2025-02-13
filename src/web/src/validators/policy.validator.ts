/**
 * Policy validator for MGA Operating System web frontend
 * Implements comprehensive validation logic for insurance policy data with
 * OneShield compatibility and WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.21.4
import dayjs from 'dayjs'; // v1.11.9
import { IPolicy, PolicyStatus, PolicyType } from '../types/policy.types';
import { POLICY_VALIDATION } from '../constants/policy.constants';
import { ValidationUtils } from '../utils/validation.utils';
import type { ValidationResult } from '../types/common.types';

// Zod schema for policy validation
const policySchema = z.object({
  id: z.string().uuid(),
  policyNumber: z.string().min(1).regex(/^[A-Z0-9-]+$/),
  type: z.nativeEnum(PolicyType),
  status: z.nativeEnum(PolicyStatus),
  effectiveDate: z.string().datetime(),
  expirationDate: z.string().datetime(),
  premium: z.number().min(POLICY_VALIDATION.MIN_PREMIUM).max(POLICY_VALIDATION.MAX_PREMIUM),
  coverages: z.array(z.object({
    type: z.string(),
    limit: z.number().min(POLICY_VALIDATION.MIN_COVERAGE_AMOUNT),
    deductible: z.number(),
    premium: z.number()
  })).min(1),
  underwritingInfo: z.object({
    riskScore: z.number().min(0).max(100).optional(),
    underwriterNotes: z.string().optional(),
    approvalStatus: z.string().optional(),
    reviewedBy: z.string().optional(),
    reviewDate: z.string().datetime().optional()
  }).optional()
});

/**
 * Validates a complete policy object against business rules and OneShield compatibility
 * @param policy - Policy object to validate
 * @returns ValidationResult with WCAG 2.1 compliant messages
 */
export const validatePolicy = (policy: IPolicy): ValidationResult => {
  const errors: Record<string, string[]> = {};

  // Basic schema validation
  const schemaResult = policySchema.safeParse(policy);
  if (!schemaResult.success) {
    errors.schema = schemaResult.error.errors.map(err => err.message);
  }

  // Validate policy dates
  const dateValidation = validatePolicyDates(
    new Date(policy.effectiveDate),
    new Date(policy.expirationDate)
  );
  if (!dateValidation.isValid) {
    errors.dates = Object.values(dateValidation.errors).flat();
  }

  // Validate premium
  const premiumValidation = ValidationUtils.validateCurrency(policy.premium, {
    minAmount: POLICY_VALIDATION.MIN_PREMIUM,
    maxAmount: POLICY_VALIDATION.MAX_PREMIUM,
    currency: POLICY_VALIDATION.PREMIUM_CURRENCY
  });
  if (!premiumValidation.isValid) {
    errors.premium = Object.values(premiumValidation.errors).flat();
  }

  // Validate coverages
  const coverageValidation = validatePolicyCoverages(policy.coverages);
  if (!coverageValidation.isValid) {
    errors.coverages = Object.values(coverageValidation.errors).flat();
  }

  // Validate underwriting info for non-DRAFT policies
  if (policy.status !== PolicyStatus.DRAFT) {
    const underwritingValidation = validateUnderwritingInfo(policy.underwritingInfo);
    if (!underwritingValidation.isValid) {
      errors.underwriting = Object.values(underwritingValidation.errors).flat();
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates policy effective and expiration dates with business day consideration
 * @param effectiveDate - Policy effective date
 * @param expirationDate - Policy expiration date
 * @returns ValidationResult with accessibility-compliant messages
 */
export const validatePolicyDates = (
  effectiveDate: Date,
  expirationDate: Date
): ValidationResult => {
  const errors: string[] = [];

  // Validate date presence and format
  if (!effectiveDate || !expirationDate) {
    errors.push('Both effective and expiration dates are required');
    return { isValid: false, errors: { dates: errors } };
  }

  // Validate effective date is a business day
  const effectiveDateValidation = ValidationUtils.validateBusinessDays(effectiveDate);
  if (!effectiveDateValidation.isValid) {
    errors.push('Effective date must be a business day');
  }

  // Validate date range
  const dateRangeValidation = ValidationUtils.validateDateRange(
    effectiveDate,
    expirationDate,
    {
      minDate: dayjs().startOf('day').toDate(),
      businessDaysOnly: true
    }
  );
  if (!dateRangeValidation.isValid) {
    errors.push(...Object.values(dateRangeValidation.errors).flat());
  }

  // Validate policy term length
  const termMonths = dayjs(expirationDate).diff(dayjs(effectiveDate), 'month');
  if (termMonths < POLICY_VALIDATION.MIN_TERM_LENGTH || 
      termMonths > POLICY_VALIDATION.MAX_TERM_LENGTH) {
    errors.push(`Policy term must be between ${POLICY_VALIDATION.MIN_TERM_LENGTH} and ${POLICY_VALIDATION.MAX_TERM_LENGTH} months`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length ? { dates: errors } : {}
  };
};

/**
 * Validates policy coverages with OneShield compatibility
 * @param coverages - Array of policy coverages
 * @returns ValidationResult with OneShield compatibility details
 */
export const validatePolicyCoverages = (
  coverages: IPolicy['coverages']
): ValidationResult => {
  const errors: string[] = [];

  // Validate coverage array presence
  if (!Array.isArray(coverages) || coverages.length === 0) {
    errors.push('At least one coverage is required');
    return { isValid: false, errors: { coverages: errors } };
  }

  // Validate individual coverages
  coverages.forEach((coverage, index) => {
    // Validate coverage type
    if (!coverage.type) {
      errors.push(`Coverage ${index + 1}: Type is required`);
    }

    // Validate coverage limits
    const limitValidation = ValidationUtils.validateCurrency(coverage.limit, {
      minAmount: POLICY_VALIDATION.MIN_COVERAGE_AMOUNT,
      maxAmount: POLICY_VALIDATION.MAX_COVERAGE_AMOUNT,
      currency: POLICY_VALIDATION.PREMIUM_CURRENCY
    });
    if (!limitValidation.isValid) {
      errors.push(`Coverage ${index + 1}: ${Object.values(limitValidation.errors).flat().join(', ')}`);
    }

    // Validate coverage premium
    const premiumValidation = ValidationUtils.validateCurrency(coverage.premium, {
      minAmount: 0,
      currency: POLICY_VALIDATION.PREMIUM_CURRENCY
    });
    if (!premiumValidation.isValid) {
      errors.push(`Coverage ${index + 1}: ${Object.values(premiumValidation.errors).flat().join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors: errors.length ? { coverages: errors } : {}
  };
};

/**
 * Validates underwriting information for non-DRAFT policies
 * @param underwritingInfo - Policy underwriting information
 * @returns ValidationResult with accessibility-compliant messages
 */
const validateUnderwritingInfo = (
  underwritingInfo: IPolicy['underwritingInfo']
): ValidationResult => {
  const errors: string[] = [];

  if (!underwritingInfo) {
    errors.push('Underwriting information is required for non-DRAFT policies');
    return { isValid: false, errors: { underwriting: errors } };
  }

  // Validate risk score
  if (typeof underwritingInfo.riskScore !== 'number' || 
      underwritingInfo.riskScore < 0 || 
      underwritingInfo.riskScore > 100) {
    errors.push('Risk score must be between 0 and 100');
  }

  // Validate underwriter notes
  if (!underwritingInfo.underwriterNotes?.trim()) {
    errors.push('Underwriter notes are required');
  }

  // Validate review information
  if (!underwritingInfo.reviewedBy?.trim()) {
    errors.push('Reviewer information is required');
  }

  if (!underwritingInfo.reviewDate) {
    errors.push('Review date is required');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length ? { underwriting: errors } : {}
  };
};