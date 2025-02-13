/**
 * Claims Management Types
 * Version: 1.0.0
 * Defines TypeScript interfaces and types for claims management in the MGA OS platform
 */

import { CLAIM_STATUS, CLAIM_DOCUMENT_TYPES } from '../constants/claims.constants';

/**
 * Interface defining the structure of a claim incident location
 */
export interface ClaimLocation {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Interface defining the structure of claimant information
 */
export interface ClaimantInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string;
}

/**
 * Interface defining the structure of claim-related documents with enhanced security and tracking features
 */
export interface ClaimDocument {
  id: string;
  type: keyof typeof CLAIM_DOCUMENT_TYPES;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  url: string;
  uploadedBy: string;
  isConfidential: boolean;
  expiryDate?: Date;
}

/**
 * Main interface defining the comprehensive structure of a claim in the frontend
 */
export interface Claim {
  id: string;
  policyId: string;
  claimNumber: string;
  status: keyof typeof CLAIM_STATUS;
  incidentDate: Date;
  reportedDate: Date;
  description: string;
  location: ClaimLocation;
  claimantInfo: ClaimantInfo;
  reserveAmount: number;
  paidAmount: number;
  documents: ClaimDocument[];
  createdAt: Date;
  updatedAt: Date;
  adjusterNotes?: string;
  denialReason?: string;
  lastActivityDate: Date;
  totalIncurred: number;
  isReopened: boolean;
}

/**
 * Interface defining the structure of a claim creation request
 */
export interface CreateClaimRequest {
  policyId: string;
  incidentDate: Date;
  description: string;
  location: ClaimLocation;
  claimantInfo: ClaimantInfo;
  initialReserve: number;
  priorityLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  notificationPreference?: 'EMAIL' | 'SMS' | 'BOTH';
}

/**
 * Interface defining the structure of a claim status update request
 */
export interface UpdateClaimStatusRequest {
  status: keyof typeof CLAIM_STATUS;
  notes: string;
}