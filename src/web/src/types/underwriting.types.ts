/**
 * @fileoverview TypeScript type definitions for underwriting components and workflows
 * Provides comprehensive type safety and validation for automated underwriting processes
 * @version 1.0.0
 */

import { POLICY_TYPES as PolicyType } from '../constants/policy.constants';
import type { UUID } from 'crypto'; // ^1.0.0

/**
 * Enum defining all possible underwriting review statuses
 * Used for workflow management and UI state display
 */
export enum UnderwritingStatus {
    PENDING_REVIEW = 'PENDING_REVIEW',
    IN_REVIEW = 'IN_REVIEW',
    AUTO_APPROVED = 'AUTO_APPROVED',
    MANUAL_REVIEW = 'MANUAL_REVIEW',
    APPROVED = 'APPROVED',
    DECLINED = 'DECLINED'
}

/**
 * Enum defining risk severity levels for visual indicators
 * Used in risk assessment displays and automated routing decisions
 */
export enum RiskSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH'
}

/**
 * Interface for risk trend analysis
 * Provides trend indicators and historical risk data analysis
 */
export interface IRiskTrend {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentageChange: number;
    periodStart: Date;
    periodEnd: Date;
    comparisonFactors: string[];
    confidenceLevel: number;
}

/**
 * Interface for displaying comprehensive risk assessment data
 * Supports automated underwriting workflows with tracking and accountability
 */
export interface IRiskAssessmentDisplay {
    policyId: UUID;
    riskScore: number;
    severity: RiskSeverity;
    factors: IRiskFactorDisplay[];
    assessmentDate: Date;
    assessedBy: string;
}

/**
 * Interface for individual risk factor display
 * Provides detailed scoring and severity indicators for each factor
 */
export interface IRiskFactorDisplay {
    type: string;
    score: number;
    severity: RiskSeverity;
    details: {
        description?: string;
        impact?: string;
        recommendation?: string;
        dataSource?: string;
        lastUpdated?: Date;
    };
}

/**
 * Interface for items in the underwriting queue
 * Enables priority-based workflow management and status tracking
 */
export interface IUnderwritingQueueItem {
    policyId: UUID;
    policyType: PolicyType;
    status: UnderwritingStatus;
    riskScore: number;
    severity: RiskSeverity;
    submissionDate: Date;
    assignedTo: string;
}

/**
 * Interface for underwriting decision form data
 * Captures and validates underwriting decisions with supporting documentation
 */
export interface IUnderwritingDecisionForm {
    policyId: UUID;
    decision: UnderwritingStatus;
    notes: string;
    conditions: string[];
}

/**
 * Type guard to check if a value is a valid RiskSeverity
 */
export const isRiskSeverity = (value: any): value is RiskSeverity => {
    return Object.values(RiskSeverity).includes(value);
};

/**
 * Type guard to check if a value is a valid UnderwritingStatus
 */
export const isUnderwritingStatus = (value: any): value is UnderwritingStatus => {
    return Object.values(UnderwritingStatus).includes(value);
};

/**
 * Type for risk score calculation function
 * Ensures consistent risk scoring across the application
 */
export type RiskScoreCalculator = (factors: IRiskFactorDisplay[]) => number;

/**
 * Type for automated decision routing logic
 * Determines workflow based on risk assessment results
 */
export type DecisionRouter = (assessment: IRiskAssessmentDisplay) => UnderwritingStatus;