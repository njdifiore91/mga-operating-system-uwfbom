/**
 * Utility module providing comprehensive data formatting functions for the MGA OS web application.
 * Handles currency, percentages, policy numbers, phone numbers, and file sizes with internationalization support.
 * @version 1.0.0
 */

import numeral from 'numeral'; // v2.0.x - Number formatting library with locale support
import { ID } from '../types/common.types';

/**
 * Formats a number as currency with proper symbol, decimal places, and thousands separators.
 * @param amount - The numeric amount to format
 * @param currencyCode - ISO 4217 currency code (default: 'USD')
 * @param locale - BCP 47 language tag (default: 'en-US')
 * @returns Formatted currency string
 * @throws Error if amount is invalid
 */
export const formatCurrency = (
  amount: number,
  currencyCode: string = 'USD',
  locale: string = 'en-US'
): string => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Invalid amount provided for currency formatting');
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    console.error('Currency formatting error:', error);
    return numeral(amount).format('$0,0.00'); // Fallback formatting
  }
};

/**
 * Formats a decimal number as a percentage with locale-aware formatting.
 * @param value - Number to format (can be 0-1 or 0-100)
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @param autoConvert - Auto-convert decimal to percentage (default: true)
 * @returns Formatted percentage string
 * @throws Error if value is invalid
 */
export const formatPercentage = (
  value: number,
  decimalPlaces: number = 2,
  autoConvert: boolean = true
): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('Invalid value provided for percentage formatting');
  }

  let percentValue = value;
  if (autoConvert && value <= 1) {
    percentValue = value * 100;
  }

  if (percentValue < 0 || percentValue > 100) {
    throw new Error('Percentage value must be between 0 and 100');
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    }).format(value <= 1 ? value : value / 100);
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return numeral(percentValue / 100).format('0.[00]%'); // Fallback formatting
  }
};

/**
 * Formats a policy ID into standardized format with validation and checksum.
 * @param policyId - Policy identifier
 * @param prefix - Custom prefix (default: 'P-')
 * @returns Formatted policy number
 * @throws Error if policy ID is invalid
 */
export const formatPolicyNumber = (
  policyId: ID,
  prefix: string = 'P-'
): string => {
  if (!policyId || typeof policyId !== 'string') {
    throw new Error('Invalid policy ID provided');
  }

  // Remove existing prefix and non-alphanumeric characters
  const cleanId = policyId.replace(/^[A-Z]-/, '').replace(/[^A-Z0-9]/g, '');

  // Validate length
  if (cleanId.length < 6 || cleanId.length > 10) {
    throw new Error('Invalid policy ID length');
  }

  // Add checksum digit if not present
  const withChecksum = cleanId.length % 2 === 0 ? 
    cleanId : 
    cleanId + calculateChecksum(cleanId);

  // Format with prefix and groups of 4
  return `${prefix}${withChecksum.match(/.{1,4}/g)?.join('-')}`;
};

/**
 * Formats phone numbers with international support and extension handling.
 * @param phoneNumber - Raw phone number string
 * @param countryCode - ISO 3166-1 alpha-2 country code (default: 'US')
 * @returns Formatted phone number
 * @throws Error if phone number is invalid
 */
export const formatPhoneNumber = (
  phoneNumber: string,
  countryCode: string = 'US'
): string => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error('Invalid phone number provided');
  }

  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Handle US phone numbers
  if (countryCode === 'US') {
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
  }

  // Handle international numbers
  try {
    const formatter = new Intl.NumberFormat(countryCode, {
      style: 'unit',
      unit: 'phone'
    });
    return formatter.format(Number(cleaned));
  } catch (error) {
    // Fallback formatting for international numbers
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2).match(/.{1,3}/g)?.join(' ')}`;
  }
};

/**
 * Formats file sizes with support for binary and decimal units.
 * @param bytes - Size in bytes
 * @param useBinaryUnits - Use binary (1024) instead of decimal (1000) units
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted file size string
 * @throws Error if bytes is invalid
 */
export const formatFileSize = (
  bytes: number,
  useBinaryUnits: boolean = true,
  precision: number = 2
): string => {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    throw new Error('Invalid byte value provided');
  }

  const base = useBinaryUnits ? 1024 : 1000;
  const units = useBinaryUnits
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    : ['B', 'KB', 'MB', 'GB', 'TB'];

  if (bytes === 0) return '0 B';

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );
  const value = bytes / Math.pow(base, exponent);

  return `${value.toFixed(precision)} ${units[exponent]}`;
};

/**
 * Calculates a checksum digit for policy number validation.
 * @private
 * @param value - String to calculate checksum for
 * @returns Checksum digit
 */
const calculateChecksum = (value: string): string => {
  const sum = value
    .split('')
    .map(Number)
    .reduce((acc, digit, index) => {
      return acc + (index % 2 ? digit : digit * 2);
    }, 0);
  return ((10 - (sum % 10)) % 10).toString();
};