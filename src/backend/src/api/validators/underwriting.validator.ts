/**
 * @file Underwriting request validation schemas using Zod
 * @version 1.0.0
 * @description Implements comprehensive validation schemas for underwriting-related API requests
 * with enhanced performance, caching, and OneShield compatibility checks
 */

import { z } from '../../utils/validation';
import { UnderwritingStatus, PolicyType } from '../../types/underwriting.types';
import { 
  RISK_SCORE_THRESHOLDS, 
  RISK_FACTOR_WEIGHTS,
  VALIDATION_RULES,
  AUTO_APPROVAL_CRITERIA 
} from '../../constants/underwritingRules';

// Risk Factor Schema
const riskFactorSchema = z.object({
  type: z.string().min(1).max(100),
  score: z.number()
    .min(0)
    .max(100)
    .refine(score => score <= RISK_SCORE_THRESHOLDS.HIGH_RISK, {
      message: `Risk score cannot exceed maximum threshold of ${RISK_SCORE_THRESHOLDS.HIGH_RISK}`
    }),
  weight: z.number()
    .min(0)
    .max(1)
    .refine(weight => Object.values(RISK_FACTOR_WEIGHTS).includes(weight), {
      message: 'Weight must match predefined risk factor weights'
    }),
  details: z.object({
    description: z.string().optional(),
    impact: z.string().optional(),
    mitigation: z.string().optional()
  }).catchall(z.unknown()),
  confidence: z.number().min(0).max(1),
  dataSource: z.string().min(1),
  validationStatus: z.enum(['VALID', 'INVALID', 'PENDING'])
});

// OneShield Compatibility Schema
const oneShieldCompatibilitySchema = z.object({
  modelVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  mappingValid: z.boolean(),
  transformationRules: z.array(z.string()),
  validationErrors: z.array(z.string()).optional(),
  lastSyncTimestamp: z.date().optional()
});

// Risk Assessment Schema
export const riskAssessmentSchema = z.object({
  policyId: z.string().uuid(),
  riskScore: z.number()
    .min(0)
    .max(100)
    .refine(
      score => score <= RISK_SCORE_THRESHOLDS.HIGH_RISK,
      { message: 'Risk score exceeds maximum threshold' }
    ),
  riskFactors: z.array(riskFactorSchema)
    .min(1)
    .refine(
      factors => factors.reduce((sum, f) => sum + f.weight, 0) === 1,
      { message: 'Risk factor weights must sum to 1.0' }
    ),
  assessmentDate: z.date()
    .refine(date => date <= new Date(), {
      message: 'Assessment date cannot be in the future'
    }),
  assessedBy: z.string().min(1),
  policyType: z.nativeEnum(PolicyType),
  validationErrors: z.array(z.string()),
  lastModified: z.date(),
  version: z.number().int().positive(),
  oneShieldCompatibility: oneShieldCompatibilitySchema
});

// Underwriting Decision Schema
export const underwritingDecisionSchema = z.object({
  policyId: z.string().uuid(),
  status: z.nativeEnum(UnderwritingStatus),
  riskAssessment: riskAssessmentSchema,
  decisionDate: z.date(),
  decidedBy: z.string().min(1),
  notes: z.string()
    .min(10)
    .max(1000)
    .refine(
      notes => notes.length >= 50 || AUTO_APPROVAL_CRITERIA.MAX_RISK_SCORE >= RISK_SCORE_THRESHOLDS.LOW_RISK,
      { message: 'Detailed notes required for manual underwriting decisions' }
    ),
  conditions: z.array(z.string())
    .optional()
    .refine(
      conditions => !conditions || conditions.every(c => c.length >= 10),
      { message: 'Each condition must be at least 10 characters' }
    ),
  automationLevel: z.enum(['FULL', 'PARTIAL', 'MANUAL']),
  reviewHistory: z.array(z.object({
    timestamp: z.date(),
    reviewer: z.string().min(1),
    action: z.string().min(1),
    notes: z.string().min(1),
    previousStatus: z.nativeEnum(UnderwritingStatus),
    newStatus: z.nativeEnum(UnderwritingStatus)
  })),
  oneShieldSyncStatus: z.enum(['PENDING', 'SYNCED', 'FAILED'])
});

// Required Document Validation Schema
export const requiredDocumentSchema = z.object({
  documentType: z.string()
    .refine(
      type => Object.values(VALIDATION_RULES.REQUIRED_FIELDS).flat().includes(type),
      { message: 'Invalid document type' }
    ),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  uploadDate: z.date(),
  validationStatus: z.enum(['PENDING', 'VALID', 'INVALID']),
  validationErrors: z.array(z.string()).optional()
});

// Validation Result Schema
export const validationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string()
  })).optional(),
  warnings: z.array(z.object({
    field: z.string(),
    message: z.string(),
    code: z.string()
  })).optional(),
  metadata: z.object({
    validatedAt: z.date(),
    validatedBy: z.string(),
    automationEligible: z.boolean(),
    performanceMetrics: z.object({
      validationDuration: z.number(),
      ruleCount: z.number()
    }).optional()
  })
});

// Export validation helper functions
export const validateRiskAssessment = async (data: unknown) => {
  return riskAssessmentSchema.parseAsync(data);
};

export const validateUnderwritingDecision = async (data: unknown) => {
  return underwritingDecisionSchema.parseAsync(data);
};

export const validateRequiredDocuments = async (data: unknown) => {
  return z.array(requiredDocumentSchema).parseAsync(data);
};