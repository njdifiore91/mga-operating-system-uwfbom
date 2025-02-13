/**
 * @file TypeScript type definitions for the automated underwriting engine
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { PolicyType } from '../constants/policyTypes';
import { RISK_SCORE_THRESHOLDS } from '../constants/underwritingRules';

/**
 * Enum defining all possible underwriting review statuses
 */
export enum UnderwritingStatus {
    PENDING_REVIEW = 'PENDING_REVIEW',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED',
    DECLINED = 'DECLINED',
    REFERRED = 'REFERRED'
}

/**
 * Interface defining the structure of a risk assessment
 */
export interface IRiskAssessment {
    policyId: string;
    riskScore: number;
    riskFactors: IRiskFactor[];
    assessmentDate: Date;
    assessedBy: string;
    policyType: PolicyType;
    validationErrors: string[];
    lastModified: Date;
    version: number;
}

/**
 * Interface defining the structure of a risk factor assessment
 */
export interface IRiskFactor {
    type: string;
    score: number;
    weight: number;
    details: {
        description?: string;
        impact?: string;
        mitigation?: string;
        [key: string]: any;
    };
    confidence: number;
    dataSource: string;
    validationStatus: 'VALID' | 'INVALID' | 'PENDING';
}

/**
 * Interface defining the structure of an underwriting decision
 */
export interface IUnderwritingDecision {
    policyId: string;
    status: UnderwritingStatus;
    riskAssessment: IRiskAssessment;
    decisionDate: Date;
    decidedBy: string;
    notes: string;
    conditions: string[];
    automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL';
    reviewHistory: IReviewHistory[];
    oneShieldSyncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
}

/**
 * Interface defining the structure of a review history entry
 */
interface IReviewHistory {
    timestamp: Date;
    reviewer: string;
    action: string;
    notes: string;
    previousStatus: UnderwritingStatus;
    newStatus: UnderwritingStatus;
}

/**
 * Interface defining the structure of a validation rule
 */
interface IValidationRule {
    field: string;
    type: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'CUSTOM';
    criteria: any;
    errorMessage: string;
}

/**
 * Interface defining risk threshold configuration
 */
interface IRiskThreshold {
    low: number;
    medium: number;
    high: number;
    automatic: number;
}

/**
 * Interface defining the structure of an underwriting rule
 */
export interface IUnderwritingRule {
    id: string;
    name: string;
    description: string;
    policyType: PolicyType;
    criteria: {
        conditions: Array<{
            field: string;
            operator: string;
            value: any;
        }>;
        logicalOperator: 'AND' | 'OR';
    };
    action: 'APPROVE' | 'DECLINE' | 'REFER' | 'FLAG';
    priority: number;
    validationRules: IValidationRule[];
    riskThresholds: IRiskThreshold;
    automationEligible: boolean;
}

/**
 * Type guard to check if a risk score meets automatic approval threshold
 */
export function isAutoApprovalEligible(score: number): boolean {
    return score <= RISK_SCORE_THRESHOLDS.LOW_RISK;
}

/**
 * Type guard to check if a risk score requires manual review
 */
export function requiresManualReview(score: number): boolean {
    return score >= RISK_SCORE_THRESHOLDS.MEDIUM_RISK;
}