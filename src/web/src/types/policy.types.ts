/**
 * TypeScript type definitions for insurance policies in the MGA Operating System.
 * Provides comprehensive type safety for policy-related data structures and operations.
 * @version 1.0.0
 */

import { ID, Timestamp } from './common.types';

/**
 * Enum defining supported insurance policy types
 */
export enum PolicyType {
  COMMERCIAL_PROPERTY = 'COMMERCIAL_PROPERTY',
  GENERAL_LIABILITY = 'GENERAL_LIABILITY',
  PROFESSIONAL_LIABILITY = 'PROFESSIONAL_LIABILITY',
  WORKERS_COMPENSATION = 'WORKERS_COMPENSATION',
  COMMERCIAL_AUTO = 'COMMERCIAL_AUTO',
  CYBER_LIABILITY = 'CYBER_LIABILITY'
}

/**
 * Enum defining all possible policy statuses throughout its lifecycle
 */
export enum PolicyStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  BOUND = 'BOUND',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

/**
 * Interface defining the structure of policy coverage details
 */
export interface ICoverage {
  type: string;
  limit: number;
  deductible: number;
  premium: number;
}

/**
 * Interface defining the structure of policy endorsements
 */
export interface IEndorsement {
  id: ID;
  type: string;
  effectiveDate: Timestamp;
  changes: Record<string, any>;
  premiumChange: number;
  policyId: ID;
}

/**
 * Interface defining underwriting information and review details
 */
export interface IUnderwritingInfo {
  riskScore: number;
  underwriterNotes: string;
  approvalStatus: string;
  reviewedBy: string;
  reviewDate: Timestamp;
}

/**
 * Interface defining the structure of policy documents
 */
export interface IDocument {
  id: ID;
  type: string;
  name: string;
  url: string;
  uploadedAt: Timestamp;
}

/**
 * Primary interface defining the complete structure of an insurance policy
 */
export interface IPolicy {
  id: ID;
  policyNumber: string;
  type: PolicyType;
  status: PolicyStatus;
  effectiveDate: Timestamp;
  expirationDate: Timestamp;
  premium: number;
  coverages: ICoverage[];
  underwritingInfo: IUnderwritingInfo;
  endorsements: IEndorsement[];
  documents: IDocument[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}