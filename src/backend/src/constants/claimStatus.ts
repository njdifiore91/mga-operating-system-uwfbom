/**
 * @fileoverview Defines comprehensive claim status enumerations and related constants
 * for managing the complete lifecycle of insurance claims in the MGA OS platform.
 * Supports claims integration requirements and processing workflows with type-safe
 * status tracking and grouping capabilities.
 * 
 * @version 1.0.0
 */

/**
 * Enumeration of all possible claim status values in the system.
 * Represents the complete lifecycle of a claim from initiation to closure.
 */
export enum CLAIM_STATUS {
  /** Initial status when claim is first created */
  NEW = 'NEW',
  
  /** Claim is being reviewed by claims adjuster */
  UNDER_REVIEW = 'UNDER_REVIEW',
  
  /** Additional information needed from claimant or other parties */
  PENDING_INFO = 'PENDING_INFO',
  
  /** Claim has been approved for payment */
  APPROVED = 'APPROVED',
  
  /** Payment is being processed */
  IN_PAYMENT = 'IN_PAYMENT',
  
  /** Claim has been paid in full */
  PAID = 'PAID',
  
  /** Claim has been denied */
  DENIED = 'DENIED',
  
  /** Claim has been closed */
  CLOSED = 'CLOSED',
  
  /** Previously closed claim that has been reopened */
  REOPENED = 'REOPENED'
}

/**
 * Immutable array of claim statuses representing terminal states in the claim lifecycle.
 * Used for filtering and identifying claims that have reached their final disposition.
 */
export const FINAL_CLAIM_STATUSES = [
  CLAIM_STATUS.PAID,
  CLAIM_STATUS.DENIED, 
  CLAIM_STATUS.CLOSED
] as const;

/**
 * Immutable array of claim statuses representing active states requiring processing.
 * Used for filtering and identifying claims that need attention or are in progress.
 */
export const ACTIVE_CLAIM_STATUSES = [
  CLAIM_STATUS.NEW,
  CLAIM_STATUS.UNDER_REVIEW,
  CLAIM_STATUS.PENDING_INFO,
  CLAIM_STATUS.APPROVED,
  CLAIM_STATUS.IN_PAYMENT,
  CLAIM_STATUS.REOPENED
] as const;