/**
 * @fileoverview Claims validation module for MGA Operating System
 * @version 1.0.0
 * @description Implements comprehensive Zod validation schemas and validation functions 
 * for claims-related API requests with support for regulatory compliance and business rules.
 */

import { z } from 'zod'; // v3.21.4
import { CLAIM_STATUS } from '../../constants/claimStatus';
import { CreateClaimRequest } from '../../types/claims.types';
import { ValidationUtils, validateRequest, validateDateRange } from '../../utils/validation';

// Coordinate validation constants
const LATITUDE_RANGE = { min: -90, max: 90 };
const LONGITUDE_RANGE = { min: -180, max: 180 };

/**
 * Zod schema for validating geographical coordinates of claim location
 */
export const claimLocationSchema = z.object({
  address: z.string().min(1).max(200),
  address2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().min(2).max(2),
  coordinates: z.object({
    latitude: z.number().min(LATITUDE_RANGE.min).max(LATITUDE_RANGE.max),
    longitude: z.number().min(LONGITUDE_RANGE.min).max(LONGITUDE_RANGE.max)
  })
}).strict();

/**
 * Zod schema for validating claimant information
 */
export const claimantInfoSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+?1?\d{10,14}$/),
  relationship: z.string().min(1).max(50),
  alternateContact: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().regex(/^\+?1?\d{10,14}$/),
    relationship: z.string().min(1).max(50)
  }),
  preferredContactMethod: z.enum(['email', 'phone', 'mail'])
}).strict();

/**
 * Comprehensive Zod schema for validating new claim creation requests
 */
export const createClaimSchema = z.object({
  policyId: z.string().uuid(),
  incidentDate: z.date(),
  description: z.string().min(10).max(2000),
  location: claimLocationSchema,
  claimantInfo: claimantInfoSchema,
  initialReserve: z.number().positive().max(999999999.99).multipleOf(0.01),
  documents: z.array(z.object({
    fileName: z.string().min(1).max(255),
    fileSize: z.number().positive().max(10 * 1024 * 1024), // 10MB max
    mimeType: z.string().regex(/^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$|^image\/(jpeg|png|heic)$/),
    content: z.instanceof(Buffer)
  })).min(1).max(10)
}).strict();

/**
 * Zod schema for validating claim status update requests
 */
export const updateClaimStatusSchema = z.object({
  status: z.nativeEnum(CLAIM_STATUS),
  notes: z.string().min(10).max(1000),
  adjusterId: z.string().uuid(),
  reserveAmount: z.number().nonnegative().max(999999999.99).multipleOf(0.01)
}).strict();

/**
 * Validates a new claim creation request with comprehensive business rules
 * @param requestData The claim creation request data to validate
 * @returns Promise resolving to validation result with sanitized data
 */
export async function validateCreateClaimRequest(
  requestData: unknown
): Promise<ValidationResult<CreateClaimRequest>> {
  // Initial schema validation
  const validationResult = await validateRequest<CreateClaimRequest>(
    createClaimSchema,
    requestData,
    { 
      enableLogging: true,
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000
      }
    }
  );

  if (!validationResult.success) {
    return validationResult;
  }

  const data = validationResult.data!;

  // Additional business rule validations
  const isValidDateRange = validateDateRange(
    data.incidentDate,
    new Date(),
    {
      allowPast: true,
      maxRangeInDays: 365,
      timezone: 'America/New_York'
    }
  );

  if (!isValidDateRange) {
    return {
      success: false,
      errors: [{
        path: ['incidentDate'],
        message: 'Incident date must be within the last 365 days',
        code: 'INVALID_DATE_RANGE'
      }]
    };
  }

  // Document validation
  const totalFileSize = data.documents.reduce((sum, doc) => sum + doc.fileSize, 0);
  if (totalFileSize > 50 * 1024 * 1024) { // 50MB total limit
    return {
      success: false,
      errors: [{
        path: ['documents'],
        message: 'Total document size exceeds 50MB limit',
        code: 'FILE_SIZE_EXCEEDED'
      }]
    };
  }

  return {
    success: true,
    data: data
  };
}

/**
 * Validates claim status update requests with transition rules
 * @param requestData The status update request data to validate
 * @param currentStatus The current status of the claim
 * @returns Promise resolving to validation result
 */
export async function validateUpdateClaimStatusRequest(
  requestData: unknown,
  currentStatus: CLAIM_STATUS
): Promise<ValidationResult> {
  // Initial schema validation
  const validationResult = await validateRequest(
    updateClaimStatusSchema,
    requestData,
    { enableLogging: true }
  );

  if (!validationResult.success) {
    return validationResult;
  }

  const data = validationResult.data!;

  // Validate status transitions
  const allowedTransitions: Record<CLAIM_STATUS, CLAIM_STATUS[]> = {
    [CLAIM_STATUS.NEW]: [CLAIM_STATUS.UNDER_REVIEW, CLAIM_STATUS.DENIED],
    [CLAIM_STATUS.UNDER_REVIEW]: [CLAIM_STATUS.PENDING_INFO, CLAIM_STATUS.APPROVED, CLAIM_STATUS.DENIED],
    [CLAIM_STATUS.PENDING_INFO]: [CLAIM_STATUS.UNDER_REVIEW, CLAIM_STATUS.DENIED],
    [CLAIM_STATUS.APPROVED]: [CLAIM_STATUS.IN_PAYMENT, CLAIM_STATUS.DENIED],
    [CLAIM_STATUS.IN_PAYMENT]: [CLAIM_STATUS.PAID, CLAIM_STATUS.DENIED],
    [CLAIM_STATUS.PAID]: [CLAIM_STATUS.CLOSED, CLAIM_STATUS.REOPENED],
    [CLAIM_STATUS.DENIED]: [CLAIM_STATUS.CLOSED, CLAIM_STATUS.REOPENED],
    [CLAIM_STATUS.CLOSED]: [CLAIM_STATUS.REOPENED],
    [CLAIM_STATUS.REOPENED]: [CLAIM_STATUS.UNDER_REVIEW]
  };

  if (!allowedTransitions[currentStatus].includes(data.status)) {
    return {
      success: false,
      errors: [{
        path: ['status'],
        message: `Invalid status transition from ${currentStatus} to ${data.status}`,
        code: 'INVALID_STATUS_TRANSITION'
      }]
    };
  }

  return {
    success: true,
    data: data
  };
}