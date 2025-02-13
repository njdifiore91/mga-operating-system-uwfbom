/**
 * @file Underwriting rules and constants for automated risk assessment
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 * 
 * Defines the core underwriting rules, thresholds and criteria used by the 
 * automated underwriting engine for risk assessment and policy approval.
 */

import { PolicyType } from './policyTypes';

/**
 * Risk score thresholds for underwriting decisions
 * Scores are on a scale of 0-100 where lower scores indicate lower risk
 */
export const RISK_SCORE_THRESHOLDS = {
    LOW_RISK: 30,      // Eligible for automatic approval
    MEDIUM_RISK: 60,   // Requires limited manual review
    HIGH_RISK: 85      // Requires full underwriter review
} as const;

/**
 * Coverage limit rules by policy type (in USD)
 * Defines minimum and maximum coverage amounts allowed
 */
export const COVERAGE_LIMIT_RULES = {
    [PolicyType.COMMERCIAL_PROPERTY]: {
        MIN_COVERAGE: 100_000,
        MAX_COVERAGE: 10_000_000,
        MIN_DEDUCTIBLE: 1_000,
        MAX_DEDUCTIBLE: 100_000
    },
    [PolicyType.GENERAL_LIABILITY]: {
        MIN_COVERAGE: 500_000,
        MAX_COVERAGE: 5_000_000,
        MIN_DEDUCTIBLE: 2_500,
        MAX_DEDUCTIBLE: 50_000
    },
    [PolicyType.PROFESSIONAL_LIABILITY]: {
        MIN_COVERAGE: 250_000,
        MAX_COVERAGE: 3_000_000,
        MIN_DEDUCTIBLE: 5_000,
        MAX_DEDUCTIBLE: 25_000
    }
} as const;

/**
 * Risk factor weights for calculating overall risk score
 * Weights should sum to 1.0 (100%)
 */
export const RISK_FACTOR_WEIGHTS = {
    CLAIMS_HISTORY: 0.35,    // Past claims frequency and severity
    LOCATION_RISK: 0.25,     // Geographic and environmental risks
    COVERAGE_AMOUNT: 0.20,   // Requested coverage limits
    BUSINESS_TYPE: 0.20      // Industry and operations type
} as const;

/**
 * Criteria for automatic policy approval eligibility
 * Policies meeting all criteria can bypass manual review
 */
export const AUTO_APPROVAL_CRITERIA = {
    MAX_RISK_SCORE: RISK_SCORE_THRESHOLDS.LOW_RISK,
    MIN_YEARS_IN_BUSINESS: 3,
    MAX_CLAIMS_COUNT: 2,
    MAX_CLAIMS_AMOUNT: 50_000,
    MIN_CREDIT_SCORE: 700,
    REQUIRED_DOCUMENTS_COMPLETE: true
} as const;

/**
 * Required documentation by policy type for underwriting
 * All documents must be provided for underwriting review
 */
export const REQUIRED_DOCUMENTS = {
    [PolicyType.COMMERCIAL_PROPERTY]: [
        'property_valuation_report',
        'building_inspection_report',
        'loss_prevention_measures',
        'business_continuity_plan'
    ],
    [PolicyType.GENERAL_LIABILITY]: [
        'business_operations_description',
        'safety_procedures_manual',
        'employee_training_records',
        'premises_photos'
    ],
    [PolicyType.PROFESSIONAL_LIABILITY]: [
        'professional_certifications',
        'service_contracts_sample',
        'quality_control_procedures',
        'staff_qualifications'
    ]
} as const;

/**
 * Risk multipliers for specific business characteristics
 * Applied to base risk score during assessment
 */
export const RISK_MULTIPLIERS = {
    CLAIMS_SEVERITY: {
        NO_CLAIMS: 1.0,
        MINOR_CLAIMS: 1.2,
        MAJOR_CLAIMS: 1.5,
        SEVERE_CLAIMS: 2.0
    },
    LOCATION_TYPE: {
        LOW_RISK_ZONE: 1.0,
        MODERATE_RISK_ZONE: 1.3,
        HIGH_RISK_ZONE: 1.8,
        CATASTROPHE_ZONE: 2.5
    },
    BUSINESS_MATURITY: {
        ESTABLISHED: 1.0,      // >5 years
        GROWING: 1.2,          // 3-5 years
        STARTUP: 1.5           // <3 years
    }
} as const;

/**
 * Validation rules for underwriting data completeness
 * All required fields must be present and valid
 */
export const VALIDATION_RULES = {
    REQUIRED_FIELDS: {
        BUSINESS: [
            'legal_name',
            'tax_id',
            'years_in_business',
            'annual_revenue',
            'employee_count'
        ],
        LOCATION: [
            'street_address',
            'city',
            'state',
            'zip_code',
            'building_type',
            'occupancy_type'
        ],
        COVERAGE: [
            'coverage_type',
            'coverage_amount',
            'deductible',
            'effective_date',
            'expiration_date'
        ]
    },
    DATE_RULES: {
        MIN_EFFECTIVE_DATE: 'current_date + 1 day',
        MAX_EFFECTIVE_DATE: 'current_date + 90 days',
        POLICY_TERM_LENGTH: 365 // days
    }
} as const;