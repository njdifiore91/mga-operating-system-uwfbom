/**
 * Claims Validator Module
 * Implements comprehensive validation logic for claims-related forms and data
 * with WCAG 2.1 Level AA compliance and robust business rule enforcement
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.21.4
import {
  Claim,
  CreateClaimRequest,
  UpdateClaimStatusRequest,
  ClaimLocation,
  ClaimantInfo
} from '../types/claims.types';
import {
  validateRequired,
  validateEmail,
  validateDateRange,
  validateCurrency,
  validatePhoneNumber
} from '../utils/validation.utils';
import {
  CLAIM_STATUS,
  MAX_CLAIM_DESCRIPTION_LENGTH,
  MAX_FILE_SIZE_MB,
  ALLOWED_FILE_TYPES,
  CLAIM_STATUS_TRANSITIONS
} from '../constants/claims.constants';
import { ValidationResult } from '../types/common.types';

/**
 * Validates the complete claim form submission with enhanced accessibility support
 * @param formData - The claim form data to validate
 * @returns ValidationResult with WCAG 2.1 compliant error messages
 */
export const validateClaimForm = (formData: CreateClaimRequest): ValidationResult => {
  const errors: Record<string, string[]> = {};

  // Policy ID validation
  const policyIdResult = validateRequired(formData.policyId, 'Policy ID');
  if (!policyIdResult.isValid) {
    errors.policyId = policyIdResult.errors.policyId || [];
  }

  // Incident date validation with business day awareness
  const today = new Date();
  const incidentDateResult = validateDateRange(
    formData.incidentDate,
    today,
    {
      maxDate: today,
      businessDaysOnly: true,
      customMessage: 'Incident date cannot be in the future and must be a business day'
    }
  );
  if (!incidentDateResult.isValid) {
    errors.incidentDate = incidentDateResult.errors.dateRange || [];
  }

  // Description validation with length constraints
  const descriptionResult = validateRequired(formData.description, 'Description');
  if (!descriptionResult.isValid) {
    errors.description = descriptionResult.errors.description || [];
  } else if (formData.description.length > MAX_CLAIM_DESCRIPTION_LENGTH) {
    errors.description = [`Description cannot exceed ${MAX_CLAIM_DESCRIPTION_LENGTH} characters`];
  }

  // Location validation
  const locationErrors = validateLocation(formData.location);
  if (Object.keys(locationErrors).length > 0) {
    errors.location = locationErrors;
  }

  // Claimant information validation
  const claimantErrors = validateClaimantInfo(formData.claimantInfo);
  if (Object.keys(claimantErrors).length > 0) {
    errors.claimantInfo = claimantErrors;
  }

  // Initial reserve amount validation
  const reserveResult = validateCurrency(formData.initialReserve, {
    minAmount: 0,
    allowNegative: false,
    currency: 'USD',
    customMessage: 'Initial reserve amount must be greater than zero'
  });
  if (!reserveResult.isValid) {
    errors.initialReserve = reserveResult.errors.amount || [];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates claim status transitions with business rule enforcement
 * @param updateData - The status update request data
 * @param currentStatus - The current claim status
 * @returns ValidationResult with detailed transition validation
 */
export const validateClaimStatusUpdate = (
  updateData: UpdateClaimStatusRequest,
  currentStatus: keyof typeof CLAIM_STATUS
): ValidationResult => {
  const errors: Record<string, string[]> = {};

  // Validate status value
  if (!Object.values(CLAIM_STATUS).includes(updateData.status)) {
    errors.status = ['Invalid claim status'];
    return { isValid: false, errors };
  }

  // Validate status transition
  const allowedTransitions = CLAIM_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions.includes(updateData.status)) {
    errors.status = [
      `Cannot transition from ${currentStatus} to ${updateData.status}. ` +
      `Allowed transitions: ${allowedTransitions.join(', ')}`
    ];
  }

  // Validate required notes for specific transitions
  const requiresNotes = [
    CLAIM_STATUS.DENIED,
    CLAIM_STATUS.PENDING_INFO,
    CLAIM_STATUS.REOPENED
  ];
  
  if (requiresNotes.includes(updateData.status)) {
    const notesResult = validateRequired(updateData.notes, 'Notes', {
      customMessage: `Notes are required when changing status to ${updateData.status}`
    });
    if (!notesResult.isValid) {
      errors.notes = notesResult.errors.notes || [];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates claim document uploads with enhanced security and accessibility
 * @param file - The file to validate
 * @returns ValidationResult with security and accessibility checks
 */
export const validateClaimDocument = (file: File): ValidationResult => {
  const errors: Record<string, string[]> = [];

  // Validate file presence
  if (!file) {
    return {
      isValid: false,
      errors: { file: ['Please select a file to upload'] }
    };
  }

  // Validate file type
  const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
    errors.fileType = [
      `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
    ];
  }

  // Validate file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    errors.fileSize = [
      `File size cannot exceed ${MAX_FILE_SIZE_MB}MB. Current size: ${fileSizeMB.toFixed(2)}MB`
    ];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Helper function to validate claim location data
 * @param location - The location data to validate
 * @returns Record of validation errors
 */
const validateLocation = (location: ClaimLocation): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  // Address validation
  const addressResult = validateRequired(location.address, 'Address');
  if (!addressResult.isValid) {
    errors.address = addressResult.errors.address || [];
  }

  // City validation
  const cityResult = validateRequired(location.city, 'City');
  if (!cityResult.isValid) {
    errors.city = cityResult.errors.city || [];
  }

  // State validation
  const stateResult = validateRequired(location.state, 'State');
  if (!stateResult.isValid) {
    errors.state = stateResult.errors.state || [];
  }

  // ZIP code validation with format check
  const zipSchema = z.string().regex(/^\d{5}(-\d{4})?$/);
  const zipResult = zipSchema.safeParse(location.zipCode);
  if (!zipResult.success) {
    errors.zipCode = ['Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'];
  }

  return errors;
};

/**
 * Helper function to validate claimant information
 * @param claimantInfo - The claimant information to validate
 * @returns Record of validation errors
 */
const validateClaimantInfo = (claimantInfo: ClaimantInfo): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  // Name validation
  const firstNameResult = validateRequired(claimantInfo.firstName, 'First name');
  if (!firstNameResult.isValid) {
    errors.firstName = firstNameResult.errors.firstName || [];
  }

  const lastNameResult = validateRequired(claimantInfo.lastName, 'Last name');
  if (!lastNameResult.isValid) {
    errors.lastName = lastNameResult.errors.lastName || [];
  }

  // Email validation
  const emailResult = validateEmail(claimantInfo.email);
  if (!emailResult.isValid) {
    errors.email = emailResult.errors.email || [];
  }

  // Phone validation with US format
  const phoneResult = validatePhoneNumber(claimantInfo.phone, {
    countryCode: 'US',
    format: '\\d{3}-\\d{3}-\\d{4}',
    customMessage: 'Please enter a valid US phone number (e.g., 555-555-5555)'
  });
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.errors.phoneNumber || [];
  }

  // Relationship validation
  const relationshipResult = validateRequired(claimantInfo.relationship, 'Relationship');
  if (!relationshipResult.isValid) {
    errors.relationship = relationshipResult.errors.relationship || [];
  }

  return errors;
};