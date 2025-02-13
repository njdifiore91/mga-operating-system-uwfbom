/**
 * @fileoverview Underwriting-related constants for the MGA Operating System
 * Defines standardized values used across underwriting components to support
 * automated workflows and risk assessment displays.
 * @version 1.0.0
 */

import { POLICY_TYPES } from '../constants/policy.constants';

/**
 * Enum defining all possible underwriting review statuses
 * Used for tracking the state of policy underwriting reviews
 */
export const UNDERWRITING_STATUS = {
    PENDING_REVIEW: 'PENDING_REVIEW',
    PENDING_DOCUMENTS: 'PENDING_DOCUMENTS',
    IN_REVIEW: 'IN_REVIEW',
    AUTO_APPROVED: 'AUTO_APPROVED',
    MANUAL_REVIEW: 'MANUAL_REVIEW',
    CONDITIONALLY_APPROVED: 'CONDITIONALLY_APPROVED',
    REFERRED_TO_CARRIER: 'REFERRED_TO_CARRIER',
    APPROVED: 'APPROVED',
    DECLINED: 'DECLINED'
} as const;

/**
 * Constants defining risk severity levels with associated visual indicators
 * and threshold values for risk categorization
 */
export const RISK_SEVERITY = {
    LOW: {
        value: 'LOW',
        label: 'Low Risk',
        color: '#00C853',
        threshold: 60
    },
    MEDIUM: {
        value: 'MEDIUM',
        label: 'Medium Risk',
        color: '#FFB300',
        threshold: 80
    },
    HIGH: {
        value: 'HIGH',
        label: 'High Risk',
        color: '#D32F2F',
        threshold: 100
    }
} as const;

/**
 * Constants defining risk score ranges with associated auto-approval
 * and referral rules for automated decisioning
 */
export const RISK_SCORE_RANGES = {
    LOW_RISK: {
        min: 0,
        max: 60,
        autoApprovalEligible: true,
        referralRequired: false
    },
    MEDIUM_RISK: {
        min: 61,
        max: 80,
        autoApprovalEligible: false,
        referralRequired: true
    },
    HIGH_RISK: {
        min: 81,
        max: 100,
        autoApprovalEligible: false,
        referralRequired: true
    }
} as const;

/**
 * Constants defining types of risk factors with associated weights
 * and validation rules for risk assessment
 */
export const RISK_FACTOR_TYPES = {
    CLAIMS_HISTORY: {
        id: 'CLAIMS_HISTORY',
        label: 'Claims History',
        weight: 0.35,
        displayOrder: 1,
        validationRules: ['requiresThreeYearHistory', 'excludeClosedClaims']
    },
    LOCATION_RISK: {
        id: 'LOCATION_RISK',
        label: 'Location Risk',
        weight: 0.25,
        displayOrder: 2,
        validationRules: ['requiresGeocodingValidation', 'checkFloodZone']
    },
    COVERAGE_AMOUNT: {
        id: 'COVERAGE_AMOUNT',
        label: 'Coverage Amount',
        weight: 0.2,
        displayOrder: 3,
        validationRules: ['withinCarrierLimits', 'checkReinsuranceThresholds']
    },
    BUSINESS_TYPE: {
        id: 'BUSINESS_TYPE',
        label: 'Business Type',
        weight: 0.2,
        displayOrder: 4,
        validationRules: ['checkIndustryCode', 'validateLicensing']
    }
} as const;

/**
 * Constants defining column configurations for the underwriting queue display
 * Includes settings for sorting, filtering, and data presentation
 */
export const UNDERWRITING_QUEUE_COLUMNS = {
    POLICY_ID: {
        id: 'policyId',
        label: 'Policy ID',
        width: 120,
        sortable: true,
        filterable: true,
        dataType: 'string'
    },
    POLICY_TYPE: {
        id: 'policyType',
        label: 'Policy Type',
        width: 150,
        sortable: true,
        filterable: true,
        dataType: 'enum'
    },
    STATUS: {
        id: 'status',
        label: 'Status',
        width: 140,
        sortable: true,
        filterable: true,
        dataType: 'enum'
    },
    RISK_SCORE: {
        id: 'riskScore',
        label: 'Risk Score',
        width: 100,
        sortable: true,
        filterable: true,
        dataType: 'number'
    },
    SEVERITY: {
        id: 'severity',
        label: 'Severity',
        width: 120,
        sortable: true,
        filterable: true,
        dataType: 'enum'
    },
    SUBMISSION_DATE: {
        id: 'submissionDate',
        label: 'Submitted',
        width: 160,
        sortable: true,
        filterable: true,
        dataType: 'date'
    },
    ASSIGNED_TO: {
        id: 'assignedTo',
        label: 'Assigned To',
        width: 140,
        sortable: true,
        filterable: true,
        dataType: 'string'
    }
} as const;