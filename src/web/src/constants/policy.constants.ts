/**
 * @fileoverview Policy-related constants and enumerations for the MGA Operating System
 * Defines standardized values used across policy management components and ensures
 * compatibility with OneShield Policy systems.
 */

/**
 * Enum defining all supported insurance policy types in the MGA Operating System
 * Maps directly to OneShield Policy system types for integration
 */
export const enum POLICY_TYPES {
    COMMERCIAL_PROPERTY = 'COMMERCIAL_PROPERTY',
    GENERAL_LIABILITY = 'GENERAL_LIABILITY',
    PROFESSIONAL_LIABILITY = 'PROFESSIONAL_LIABILITY',
    WORKERS_COMPENSATION = 'WORKERS_COMPENSATION',
    COMMERCIAL_AUTO = 'COMMERCIAL_AUTO',
    CYBER_LIABILITY = 'CYBER_LIABILITY',
    UMBRELLA = 'UMBRELLA',
    BUSINESS_OWNERS_POLICY = 'BUSINESS_OWNERS_POLICY'
}

/**
 * Enum defining all possible policy statuses throughout the policy lifecycle
 * Used for tracking policy state and workflow progression
 */
export const enum POLICY_STATUS {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED',
    BOUND = 'BOUND',
    ACTIVE = 'ACTIVE',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED',
    PENDING_RENEWAL = 'PENDING_RENEWAL',
    RENEWED = 'RENEWED'
}

/**
 * Available policy term length options in months
 * Defines standard policy periods supported by the system
 */
export const POLICY_TERM_OPTIONS = {
    SIX_MONTHS: 6,
    TWELVE_MONTHS: 12
} as const;

/**
 * Validation rules and constraints for policy data
 * Ensures data integrity and business rule compliance
 */
export const POLICY_VALIDATION = {
    MIN_PREMIUM: 1000,
    MAX_PREMIUM: 10000000,
    MIN_TERM_LENGTH: 6,
    MAX_TERM_LENGTH: 12,
    MIN_COVERAGE_AMOUNT: 50000,
    MAX_COVERAGE_AMOUNT: 50000000,
    PREMIUM_CURRENCY: 'USD',
    ALLOWED_PAYMENT_TERMS: [30, 60, 90],
    MAX_ENDORSEMENTS_PER_TERM: 10,
    REQUIRED_DOCUMENTS: ['ACORD_125', 'LOSS_RUNS', 'FINANCIAL_STATEMENTS']
} as const;

/**
 * Configuration options for policy list table component
 * Defines display, interaction, and data management settings
 */
export const POLICY_TABLE_CONFIG = {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
    SORT_FIELD: 'createdAt',
    SORT_ORDER: 'desc',
    REFRESH_INTERVAL: 300000, // 5 minutes in milliseconds
    MAX_SELECTED_ITEMS: 50,
    COLUMN_RESIZE_MODE: 'fit',
    DEFAULT_FILTER_OPERATOR: 'contains',
    DATE_FORMAT: 'MM/DD/YYYY',
    CURRENCY_FORMAT: 'USD'
} as const;