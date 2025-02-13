/**
 * @file Policy type definitions for the MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 * 
 * Defines the enumeration of supported insurance policy types in the MGA Operating System.
 * These constants are used across policy administration, underwriting, and OneShield integration.
 */

/**
 * Enum defining all supported insurance policy types with their OneShield system mappings
 */
export const enum PolicyType {
    /** Commercial property insurance covering buildings, equipment, and business property */
    COMMERCIAL_PROPERTY = 'COMM_PROP',

    /** General liability insurance for third-party bodily injury and property damage claims */
    GENERAL_LIABILITY = 'GEN_LIAB',

    /** Professional liability insurance for errors and omissions coverage */
    PROFESSIONAL_LIABILITY = 'PROF_LIAB',

    /** Workers compensation insurance for employee injury coverage */
    WORKERS_COMPENSATION = 'WORK_COMP',

    /** Commercial auto insurance for business vehicle coverage */
    COMMERCIAL_AUTO = 'COMM_AUTO',

    /** Cyber liability insurance for data breach and cyber risk coverage */
    CYBER_LIABILITY = 'CYBER_LIAB',

    /** Umbrella insurance providing additional liability coverage */
    UMBRELLA = 'UMBRELLA',

    /** Combined package policy for small to medium businesses */
    BUSINESS_OWNERS_POLICY = 'BOP'
}

/**
 * Type guard function to validate if a value is a valid PolicyType at runtime
 * @param value - The value to check
 * @returns True if the value is a valid PolicyType, false otherwise
 */
export function isPolicyType(value: unknown): value is PolicyType {
    const validTypes = [
        PolicyType.COMMERCIAL_PROPERTY,
        PolicyType.GENERAL_LIABILITY,
        PolicyType.PROFESSIONAL_LIABILITY,
        PolicyType.WORKERS_COMPENSATION,
        PolicyType.COMMERCIAL_AUTO,
        PolicyType.CYBER_LIABILITY,
        PolicyType.UMBRELLA,
        PolicyType.BUSINESS_OWNERS_POLICY
    ];
    return typeof value === 'string' && validTypes.includes(value as PolicyType);
}

/**
 * @constant
 * Array of all valid policy types for validation and iteration
 */
export const VALID_POLICY_TYPES = Object.values(PolicyType);

/**
 * @constant
 * Map of PolicyType to human-readable descriptions
 */
export const POLICY_TYPE_DESCRIPTIONS: Record<PolicyType, string> = {
    [PolicyType.COMMERCIAL_PROPERTY]: 'Commercial property insurance covering buildings, equipment, and business property',
    [PolicyType.GENERAL_LIABILITY]: 'General liability insurance for third-party bodily injury and property damage claims',
    [PolicyType.PROFESSIONAL_LIABILITY]: 'Professional liability insurance for errors and omissions coverage',
    [PolicyType.WORKERS_COMPENSATION]: 'Workers compensation insurance for employee injury coverage',
    [PolicyType.COMMERCIAL_AUTO]: 'Commercial auto insurance for business vehicle coverage',
    [PolicyType.CYBER_LIABILITY]: 'Cyber liability insurance for data breach and cyber risk coverage',
    [PolicyType.UMBRELLA]: 'Umbrella insurance providing additional liability coverage',
    [PolicyType.BUSINESS_OWNERS_POLICY]: 'Combined package policy for small to medium businesses'
};