/**
 * @fileoverview Date and time utility functions for MGA OS platform
 * Provides standardized date manipulation with timezone support and ISO-8601 compliance
 * @version 1.0.0
 */

import { format, addDays, differenceInDays, isValid } from 'date-fns'; // v2.30.x

/**
 * Default timezone if none specified
 */
const DEFAULT_TIMEZONE = 'UTC';

/**
 * ISO-8601 date format for policy dates
 */
const ISO_DATE_FORMAT = 'yyyy-MM-dd\'T\'HH:mm:ss.SSSX';

/**
 * Business day validation configuration
 */
const BUSINESS_DAY_CONFIG = {
  startHour: 0,
  endHour: 23,
  startMinute: 0,
  endMinute: 59
};

/**
 * Formats dates for policy-related displays and API responses
 * @param date - Date to format
 * @param formatString - Optional custom format string
 * @param timezone - Optional timezone (defaults to UTC)
 * @returns Formatted date string with timezone consideration
 * @throws Error if date is invalid
 */
export function formatPolicyDate(
  date: Date,
  formatString: string = ISO_DATE_FORMAT,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date || !isValid(date)) {
    throw new Error('Invalid date provided for formatting');
  }

  try {
    const normalizedDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return format(normalizedDate, formatString);
  } catch (error) {
    throw new Error(`Error formatting date: ${error.message}`);
  }
}

/**
 * Calculates policy expiration date based on effective date and term
 * @param effectiveDate - Policy effective date
 * @param termMonths - Policy term in months
 * @param timezone - Optional timezone (defaults to UTC)
 * @returns Calculated policy expiration date
 * @throws Error if parameters are invalid
 */
export function calculatePolicyEndDate(
  effectiveDate: Date,
  termMonths: number,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  if (!effectiveDate || !isValid(effectiveDate)) {
    throw new Error('Invalid effective date provided');
  }

  if (termMonths <= 0) {
    throw new Error('Policy term must be greater than zero');
  }

  try {
    const normalizedDate = new Date(effectiveDate.toLocaleString('en-US', { timeZone: timezone }));
    const daysInTerm = Math.floor(termMonths * 30.436875); // Average days per month including leap years
    return addDays(normalizedDate, daysInTerm);
  } catch (error) {
    throw new Error(`Error calculating policy end date: ${error.message}`);
  }
}

/**
 * Validates if a date falls within policy term
 * @param checkDate - Date to validate
 * @param effectiveDate - Policy effective date
 * @param expirationDate - Policy expiration date
 * @param timezone - Optional timezone (defaults to UTC)
 * @returns Boolean indicating if date is within policy term
 * @throws Error if any dates are invalid
 */
export function isDateInPolicyTerm(
  checkDate: Date,
  effectiveDate: Date,
  expirationDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  if (!checkDate || !effectiveDate || !expirationDate || 
      !isValid(checkDate) || !isValid(effectiveDate) || !isValid(expirationDate)) {
    throw new Error('Invalid date(s) provided for policy term validation');
  }

  try {
    const normalizedCheckDate = new Date(checkDate.toLocaleString('en-US', { timeZone: timezone }));
    const normalizedEffectiveDate = new Date(effectiveDate.toLocaleString('en-US', { timeZone: timezone }));
    const normalizedExpirationDate = new Date(expirationDate.toLocaleString('en-US', { timeZone: timezone }));

    return normalizedCheckDate >= normalizedEffectiveDate && 
           normalizedCheckDate <= normalizedExpirationDate;
  } catch (error) {
    throw new Error(`Error validating date in policy term: ${error.message}`);
  }
}

/**
 * Generates ISO-8601 compliant timestamp with microsecond precision
 * @param timezone - Optional timezone (defaults to UTC)
 * @returns ISO-8601 formatted timestamp string
 */
export function getAuditTimestamp(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const now = new Date();
    const normalizedDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const microseconds = (now.getMilliseconds() * 1000).toString().padStart(6, '0');
    
    return format(normalizedDate, `yyyy-MM-dd'T'HH:mm:ss.${microseconds}X`);
  } catch (error) {
    throw new Error(`Error generating audit timestamp: ${error.message}`);
  }
}

/**
 * Validates claim incident date against policy term with business rules
 * @param incidentDate - Claim incident date
 * @param policyEffectiveDate - Policy effective date
 * @param policyExpirationDate - Policy expiration date
 * @param timezone - Optional timezone (defaults to UTC)
 * @returns Boolean indicating if claim date is valid
 * @throws Error if any dates are invalid
 */
export function validateClaimDate(
  incidentDate: Date,
  policyEffectiveDate: Date,
  policyExpirationDate: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  if (!incidentDate || !policyEffectiveDate || !policyExpirationDate || 
      !isValid(incidentDate) || !isValid(policyEffectiveDate) || !isValid(policyExpirationDate)) {
    throw new Error('Invalid date(s) provided for claim date validation');
  }

  try {
    // Check if date is within policy term
    if (!isDateInPolicyTerm(incidentDate, policyEffectiveDate, policyExpirationDate, timezone)) {
      return false;
    }

    const normalizedIncidentDate = new Date(incidentDate.toLocaleString('en-US', { timeZone: timezone }));
    
    // Validate against business hours
    const hour = normalizedIncidentDate.getHours();
    const minute = normalizedIncidentDate.getMinutes();
    
    return hour >= BUSINESS_DAY_CONFIG.startHour && 
           hour <= BUSINESS_DAY_CONFIG.endHour &&
           minute >= BUSINESS_DAY_CONFIG.startMinute && 
           minute <= BUSINESS_DAY_CONFIG.endMinute;
  } catch (error) {
    throw new Error(`Error validating claim date: ${error.message}`);
  }
}