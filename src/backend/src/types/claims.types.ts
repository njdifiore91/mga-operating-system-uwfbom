/**
 * @fileoverview Defines comprehensive TypeScript interfaces and types for the claims management module
 * in the MGA OS platform. Supports full claims lifecycle management, integration with OneShield,
 * and regulatory compliance requirements.
 * 
 * @version 1.0.0
 */

import { CLAIM_STATUS } from '../constants/claimStatus';

/**
 * Interface defining the structure of a claim incident location with detailed address information
 * and geographical coordinates for precise location tracking.
 */
export interface ClaimLocation {
  address: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Interface defining detailed claimant information including primary and alternate contact details
 * and communication preferences.
 */
export interface ClaimantInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string;
  alternateContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  preferredContactMethod: string;
}

/**
 * Interface defining the structure of claim-related documents with comprehensive metadata
 * for document management and audit purposes.
 */
export interface ClaimDocument {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
  url: string;
  metadata: Record<string, unknown>;
}

/**
 * Comprehensive interface defining the complete structure of a claim with full audit trail
 * and integration support for OneShield systems.
 */
export interface Claim {
  id: string;
  policyId: string;
  claimNumber: string;
  status: CLAIM_STATUS;
  incidentDate: Date;
  reportedDate: Date;
  description: string;
  location: ClaimLocation;
  claimantInfo: ClaimantInfo;
  reserveAmount: number;
  paidAmount: number;
  documents: ClaimDocument[];
  adjusterId: string;
  statusHistory: Array<{
    status: CLAIM_STATUS;
    timestamp: Date;
    notes: string;
    userId: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface defining the structure of a new claim creation request with required
 * initial information and supporting documentation.
 */
export interface CreateClaimRequest {
  policyId: string;
  incidentDate: Date;
  description: string;
  location: ClaimLocation;
  claimantInfo: ClaimantInfo;
  initialReserve: number;
  documents: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    content: Buffer;
  }>;
}

/**
 * Interface defining the structure of a claim status update request with
 * required information for status changes and adjustments.
 */
export interface UpdateClaimStatusRequest {
  status: CLAIM_STATUS;
  notes: string;
  adjusterId: string;
  reserveAmount: number;
}