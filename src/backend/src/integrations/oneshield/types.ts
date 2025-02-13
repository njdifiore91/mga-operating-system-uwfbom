/**
 * @file OneShield integration type definitions for the MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { IPolicy } from '../../types/policy.types';

/**
 * Enum defining available OneShield environments
 */
export enum OneShieldEnvironment {
    PRODUCTION = 'production',
    STAGING = 'staging',
    DEVELOPMENT = 'development'
}

/**
 * Enum defining OneShield policy statuses
 */
export enum OneShieldPolicyStatus {
    DRAFT = 'DRAFT',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED',
    DECLINED = 'DECLINED',
    BOUND = 'BOUND',
    CANCELLED = 'CANCELLED'
}

/**
 * Enum defining OneShield transaction types
 */
export enum OneShieldTransactionType {
    NEW_BUSINESS = 'NEW_BUSINESS',
    RENEWAL = 'RENEWAL',
    ENDORSEMENT = 'ENDORSEMENT',
    CANCELLATION = 'CANCELLATION',
    REINSTATEMENT = 'REINSTATEMENT'
}

/**
 * Interface for OneShield API configuration
 */
export interface IOneShieldConfig {
    baseUrl: string;
    apiKey: string;
    environment: OneShieldEnvironment;
    timeout: number;
    version: string;
    retryConfig: IRetryConfig;
}

/**
 * Interface for retry configuration
 */
export interface IRetryConfig {
    maxRetries: number;
    backoffFactor: number;
    initialDelay: number;
    maxDelay: number;
}

/**
 * Interface for OneShield coverage details
 */
export interface IOneShieldCoverage {
    coverageCode: string;
    limitAmount: number;
    deductibleAmount: number;
    endorsements: IOneShieldEndorsement[];
    exclusions: string[];
    options: Record<string, unknown>;
}

/**
 * Interface for OneShield endorsement details
 */
export interface IOneShieldEndorsement {
    endorsementCode: string;
    effectiveDate: string;
    premium: number;
    details: Record<string, unknown>;
}

/**
 * Interface for OneShield underwriting information
 */
export interface IOneShieldUnderwritingInfo {
    riskScore: number;
    notes: string;
    approvalDate?: string;
    approvedBy?: string;
    conditions: string[];
    referralReason?: string;
}

/**
 * Interface for OneShield document metadata
 */
export interface IOneShieldDocument {
    documentId: string;
    documentType: string;
    fileName: string;
    contentType: string;
    contentUrl: string;
    metadata: Record<string, unknown>;
}

/**
 * Interface for OneShield payment plan details
 */
export interface IOneShieldPaymentPlan {
    planCode: string;
    frequency: string;
    numberOfInstallments: number;
    downPaymentPercentage: number;
    installmentAmount: number;
}

/**
 * Interface for OneShield error details
 */
export interface IOneShieldErrorDetails {
    field?: string;
    constraint?: string;
    value?: unknown;
    additionalInfo?: Record<string, unknown>;
}

/**
 * Interface for OneShield policy request
 */
export interface IOneShieldPolicyRequest {
    policyNumber: string;
    effectiveDate: string;
    expirationDate: string;
    coverages: IOneShieldCoverage[];
    premium: number;
    underwritingInfo: IOneShieldUnderwritingInfo;
    documents: IOneShieldDocument[];
}

/**
 * Interface for OneShield policy response
 */
export interface IOneShieldPolicyResponse {
    policyId: string;
    status: OneShieldPolicyStatus;
    createdAt: string;
    updatedAt: string;
    version: number;
    transactionId: string;
}

/**
 * Interface for OneShield billing request
 */
export interface IOneShieldBillingRequest {
    policyId: string;
    amount: number;
    dueDate: string;
    paymentPlan: IOneShieldPaymentPlan;
    transactionType: OneShieldTransactionType;
}

/**
 * Interface for OneShield error response
 */
export interface IOneShieldError {
    code: string;
    message: string;
    details: IOneShieldErrorDetails;
    timestamp: string;
    transactionId: string;
}

/**
 * Type for mapping MGA OS policy to OneShield format
 */
export type OneShieldPolicyMapper = (policy: IPolicy) => IOneShieldPolicyRequest;

/**
 * Type for mapping OneShield response to MGA OS policy
 */
export type MGAOSPolicyMapper = (response: IOneShieldPolicyResponse) => Partial<IPolicy>;