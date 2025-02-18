/**
 * @fileoverview Underwriting validation logic for MGA OS web application
 * Implements comprehensive validation for underwriting forms and risk assessment data
 * with WCAG 2.1 Level AA compliance and strict type safety
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.21.4
import { IRiskAssessmentDisplay, IUnderwritingDecisionForm, RiskSeverity, UnderwritingStatus } from '../types/underwriting.types';
import { validateRequired } from '../utils/validation.utils';
import { RISK_SCORE_RANGES } from '../constants/underwriting.constants';
import type { ValidationResult } from '../types/common.types';

// Cache for validation results to optimize performance
const validationCache = new Map<string, ValidationResult>();

/**
 * Validates risk assessment data with comprehensive checks and WCAG 2.1 compliance
 * @param riskAssessment - Risk assessment data to validate
 * @returns ValidationResult with accessibility-compliant error messages
 */
export const validateRiskAssessment = (
  riskAssessment: IRiskAssessmentDisplay
): ValidationResult => {
  const errors: Record<string, string[]> = {};
  const startTime = performance.now();

  // Generate cache key for this validation
  const cacheKey = `risk_${riskAssessment.policyId}_${riskAssessment.riskScore}`;
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Validate risk score
  const scoreSchema = z.number()
    .min(0, { message: 'Risk score must be at least 0' })
    .max(100, { message: 'Risk score cannot exceed 100' });
  
  const scoreResult = scoreSchema.safeParse(riskAssessment.riskScore);
  if (!scoreResult.success) {
    errors.riskScore = ['Risk score must be a number between 0 and 100'];
  }

  // Validate severity matches score range
  const expectedSeverity = determineRiskSeverity(riskAssessment.riskScore);
  if (riskAssessment.severity !== expectedSeverity) {
    errors.severity = [
      `Risk severity does not match score. Expected ${expectedSeverity} for score ${riskAssessment.riskScore}`
    ];
  }

  // Validate risk factors
  if (!riskAssessment.factors || riskAssessment.factors.length === 0) {
    errors.factors = ['At least one risk factor is required'];
  } else {
    const factorErrors: string[] = [];
    riskAssessment.factors.forEach((factor, index) => {
      if (!factor.type) {
        factorErrors.push(`Risk factor ${index + 1} must have a type`);
      }
      if (factor.score < 0 || factor.score > 100) {
        factorErrors.push(`Risk factor ${index + 1} score must be between 0 and 100`);
      }
      if (!Object.values(RiskSeverity).includes(factor.severity)) {
        factorErrors.push(`Risk factor ${index + 1} has invalid severity`);
      }
    });
    if (factorErrors.length > 0) {
      errors.factors = factorErrors;
    }
  }

  const result: ValidationResult = {
    isValid: Object.keys(errors).length === 0,
    errors
  };

  // Cache the result for future use
  validationCache.set(cacheKey, result);

  return result;
};

/**
 * Validates underwriting decision form data with strict type checking
 * @param decisionForm - Underwriting decision form data to validate
 * @returns ValidationResult with accessibility-compliant error messages
 */
export const validateUnderwritingDecision = (
  decisionForm: IUnderwritingDecisionForm
): ValidationResult => {
  const errors: Record<string, string[]> = {};

  // Validate decision status
  if (!Object.values(UnderwritingStatus).includes(decisionForm.decision)) {
    errors.decision = ['Invalid underwriting decision status'];
  }

  // Validate required notes for declined status
  if (decisionForm.decision === UnderwritingStatus.DECLINED) {
    const notesValidation = validateRequired(decisionForm.notes, 'Decline notes');
    if (!notesValidation.isValid) {
      errors.notes = ['Notes are required when declining a policy'];
    } else if (decisionForm.notes.length < 10) {
      errors.notes = ['Decline notes must be at least 10 characters'];
    }
  }

  // Validate conditions array if present
  if (decisionForm.conditions) {
    if (!Array.isArray(decisionForm.conditions)) {
      errors.conditions = ['Conditions must be an array'];
    } else {
      const conditionErrors = decisionForm.conditions
        .map((condition, index) => {
          if (typeof condition !== 'string' || condition.trim().length === 0) {
            return `Condition ${index + 1} must be a non-empty string`;
          }
          return null;
        })
        .filter((error): error is string => error !== null);

      if (conditionErrors.length > 0) {
        errors.conditions = conditionErrors;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates individual risk score with performance optimization and caching
 * @param score - Risk score to validate
 * @returns ValidationResult with optimized validation result
 */
export const validateRiskScore = (score: number): ValidationResult => {
  const cacheKey = `score_${score}`;
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const errors: Record<string, string[]> = {};
  
  // Validate score is a number
  if (typeof score !== 'number' || isNaN(score)) {
    errors.score = ['Risk score must be a valid number'];
  } else {
    // Validate score range
    if (score < 0 || score > 100) {
      errors.score = ['Risk score must be between 0 and 100'];
    }
  }

  const result: ValidationResult = {
    isValid: Object.keys(errors).length === 0,
    errors
  };

  // Cache the result
  validationCache.set(cacheKey, result);

  return result;
};

/**
 * Determines risk severity level based on score
 * @param score - Risk score to evaluate
 * @returns RiskSeverity level
 */
const determineRiskSeverity = (score: number): RiskSeverity => {
  if (score <= RISK_SCORE_RANGES.LOW_RISK.max) {
    return RiskSeverity.LOW;
  } else if (score <= RISK_SCORE_RANGES.MEDIUM_RISK.max) {
    return RiskSeverity.MEDIUM;
  }
  return RiskSeverity.HIGH;
};