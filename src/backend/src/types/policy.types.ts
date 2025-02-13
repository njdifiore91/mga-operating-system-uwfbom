/**
 * @file Policy type definitions for the MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { PolicyType } from '../constants/policyTypes';

/**
 * Enum defining all possible policy statuses in the system
 */
export enum PolicyStatus {
    DRAFT = 'DRAFT',
    QUOTED = 'QUOTED',
    BOUND = 'BOUND',
    ACTIVE = 'ACTIVE',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED'
}

/**
 * Enum defining policyholder types
 */
export enum PolicyHolderType {
    INDIVIDUAL = 'INDIVIDUAL',
    CORPORATION = 'CORPORATION',
    PARTNERSHIP = 'PARTNERSHIP',
    LLC = 'LLC',
    NON_PROFIT = 'NON_PROFIT'
}

/**
 * Enum defining verification status for policyholders
 */
export enum VerificationStatus {
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    FAILED = 'FAILED'
}

/**
 * Enum defining claim status types
 */
export enum ClaimStatus {
    OPEN = 'OPEN',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED',
    DENIED = 'DENIED',
    CLOSED = 'CLOSED'
}

/**
 * Enum defining OneShield sync status
 */
export enum SyncStatus {
    PENDING = 'PENDING',
    SYNCED = 'SYNCED',
    FAILED = 'FAILED',
    OUT_OF_SYNC = 'OUT_OF_SYNC'
}

/**
 * Enum defining payment methods
 */
export enum PaymentMethod {
    ACH = 'ACH',
    CREDIT_CARD = 'CREDIT_CARD',
    WIRE_TRANSFER = 'WIRE_TRANSFER',
    CHECK = 'CHECK'
}

/**
 * Enum defining billing schedules
 */
export enum BillingSchedule {
    ANNUAL = 'ANNUAL',
    SEMI_ANNUAL = 'SEMI_ANNUAL',
    QUARTERLY = 'QUARTERLY',
    MONTHLY = 'MONTHLY'
}

/**
 * Enum defining delivery methods
 */
export enum DeliveryMethod {
    EMAIL = 'EMAIL',
    MAIL = 'MAIL',
    PORTAL = 'PORTAL'
}

/**
 * Enum defining payment status
 */
export enum PaymentStatus {
    CURRENT = 'CURRENT',
    PAST_DUE = 'PAST_DUE',
    DELINQUENT = 'DELINQUENT',
    CANCELLED = 'CANCELLED'
}

/**
 * Interface defining address structure
 */
export interface IAddress {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}

/**
 * Interface defining contact information
 */
export interface IContact {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    alternatePhone?: string;
}

/**
 * Interface defining policyholder information
 */
export interface IPolicyHolder {
    id: string;
    type: PolicyHolderType;
    legalName: string;
    taxId: string;
    address: IAddress;
    contact: IContact;
    verificationStatus: VerificationStatus;
}

/**
 * Interface defining claim history records
 */
export interface IClaimHistory {
    id: string;
    policyId: string;
    claimNumber: string;
    incidentDate: Date;
    status: ClaimStatus;
    amount: number;
    description: string;
}

/**
 * Interface defining carrier integration information
 */
export interface ICarrierInfo {
    carrierId: string;
    carrierPolicyNumber: string;
    oneshieldId: string;
    syncStatus: SyncStatus;
    lastSyncDate: Date;
}

/**
 * Interface defining billing information
 */
export interface IBillingInfo {
    paymentMethod: PaymentMethod;
    billingSchedule: BillingSchedule;
    invoiceDelivery: DeliveryMethod;
    paymentStatus: PaymentStatus;
}

/**
 * Interface defining coverage details
 */
export interface ICoverage {
    id: string;
    type: string;
    limits: {
        perOccurrence: number;
        aggregate: number;
    };
    deductible: number;
    endorsements?: string[];
    exclusions?: string[];
}

/**
 * Interface defining underwriting information
 */
export interface IUnderwritingInfo {
    riskScore: number;
    underwriterNotes: string;
    approvalDate?: Date;
    approvedBy?: string;
    specialConditions?: string[];
}

/**
 * Interface defining endorsement structure
 */
export interface IEndorsement {
    id: string;
    type: string;
    effectiveDate: Date;
    description: string;
    premium: number;
    status: string;
}

/**
 * Interface defining document structure
 */
export interface IDocument {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    uploadDate: Date;
    metadata: Record<string, unknown>;
}

/**
 * Interface defining the complete structure of a policy
 */
export interface IPolicy {
    id: string;
    policyNumber: string;
    type: PolicyType;
    status: PolicyStatus;
    effectiveDate: Date;
    expirationDate: Date;
    premium: number;
    coverages: ICoverage[];
    underwritingInfo: IUnderwritingInfo;
    endorsements: IEndorsement[];
    documents: IDocument[];
    policyHolder: IPolicyHolder;
    claimHistory: IClaimHistory[];
    carrierInfo: ICarrierInfo;
    billingInfo: IBillingInfo;
    createdAt: Date;
    updatedAt: Date;
}