/**
 * Date utility functions for the MGA Operating System web application
 * Provides comprehensive date manipulation, formatting, and validation
 * with timezone support and robust error handling
 * @version 1.0.0
 */

import { format, parse, isValid, differenceInDays } from 'date-fns'; // v2.30.x
import { DateRange } from '../types/common.types';

// Constants for date formatting and validation
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
const DISPLAY_DATE_FORMAT = 'MMM dd, yyyy';
const MIN_POLICY_DURATION_DAYS = 1;
const MAX_POLICY_DURATION_DAYS = 366;
const INVALID_DATE_MESSAGE = 'Invalid date';

/**
 * Formats a date into a standardized string format with timezone support
 * @param date - Date object or date string to format
 * @param formatString - Desired output format string
 * @param timezone - Optional timezone (defaults to local)
 * @returns Formatted date string or error message
 */
export const formatDate = (
  date: Date | string,
  formatString: string = DISPLAY_DATE_FORMAT,
  timezone?: string
): string => {
  try {
    if (!date) {
      return INVALID_DATE_MESSAGE;
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (!isValid(dateObj)) {
      return INVALID_DATE_MESSAGE;
    }

    // Handle timezone conversion if specified
    const dateToFormat = timezone 
      ? new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }))
      : dateObj;

    return format(dateToFormat, formatString);
  } catch (error) {
    console.error('Date formatting error:', error);
    return INVALID_DATE_MESSAGE;
  }
};

/**
 * Safely parses a date string into a Date object with validation
 * @param dateString - String representation of date
 * @param formatString - Expected format of input string
 * @param timezone - Optional timezone (defaults to local)
 * @returns Parsed Date object or null for invalid inputs
 */
export const parseDate = (
  dateString: string,
  formatString: string = DEFAULT_DATE_FORMAT,
  timezone?: string
): Date | null => {
  try {
    if (!dateString) {
      return null;
    }

    const parsedDate = parse(dateString, formatString, new Date());

    if (!isValid(parsedDate)) {
      return null;
    }

    // Handle timezone conversion if specified
    if (timezone) {
      const tzOffset = new Date(dateString).toLocaleString('en-US', { timeZone: timezone });
      return new Date(tzOffset);
    }

    return parsedDate;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

/**
 * Calculates policy duration with validation for business rules
 * @param dateRange - Policy date range object
 * @returns Number of days in policy term or -1 for invalid range
 */
export const calculatePolicyDuration = (dateRange: DateRange): number => {
  try {
    const startDate = parseDate(dateRange.startDate);
    const endDate = parseDate(dateRange.endDate);

    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
      return -1;
    }

    const duration = differenceInDays(endDate, startDate);

    if (duration < MIN_POLICY_DURATION_DAYS || duration > MAX_POLICY_DURATION_DAYS) {
      return -1;
    }

    return duration;
  } catch (error) {
    console.error('Policy duration calculation error:', error);
    return -1;
  }
};

/**
 * Comprehensive date range validation for policy terms
 * @param dateRange - Policy date range to validate
 * @returns Boolean indicating if range is valid according to business rules
 */
export const isValidDateRange = (dateRange: DateRange): boolean => {
  try {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      return false;
    }

    const startDate = parseDate(dateRange.startDate);
    const endDate = parseDate(dateRange.endDate);

    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
      return false;
    }

    // Validate date range business rules
    const duration = differenceInDays(endDate, startDate);
    const isValidDuration = duration >= MIN_POLICY_DURATION_DAYS && 
                           duration <= MAX_POLICY_DURATION_DAYS;
    const isEndAfterStart = endDate > startDate;

    return isValidDuration && isEndAfterStart;
  } catch (error) {
    console.error('Date range validation error:', error);
    return false;
  }
};

/**
 * Returns formatted policy dates with comprehensive error handling
 * @param policyDates - Policy date range object
 * @param timezone - Optional timezone for formatting
 * @returns Object containing formatted dates and validation status
 */
export const getFormattedPolicyDates = (
  policyDates: DateRange,
  timezone?: string
): {
  effectiveDate: string;
  expirationDate: string;
  isValid: boolean;
} => {
  try {
    const isValid = isValidDateRange(policyDates);

    const effectiveDate = formatDate(
      policyDates.startDate,
      DISPLAY_DATE_FORMAT,
      timezone
    );

    const expirationDate = formatDate(
      policyDates.endDate,
      DISPLAY_DATE_FORMAT,
      timezone
    );

    return {
      effectiveDate,
      expirationDate,
      isValid
    };
  } catch (error) {
    console.error('Policy date formatting error:', error);
    return {
      effectiveDate: INVALID_DATE_MESSAGE,
      expirationDate: INVALID_DATE_MESSAGE,
      isValid: false
    };
  }
};