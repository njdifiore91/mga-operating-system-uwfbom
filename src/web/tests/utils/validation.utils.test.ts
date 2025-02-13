import { describe, it, expect } from '@jest/globals';
import {
  validateRequired,
  validateEmail,
  validateDateRange,
  validateCurrency,
  validatePhoneNumber
} from '../../src/utils/validation.utils';

describe('validateRequired', () => {
  it('should return invalid for null with accessible error message', () => {
    const result = validateRequired(null, 'Test Field');
    expect(result.isValid).toBe(false);
    expect(result.errors['Test Field'][0]).toBe('Test Field is required');
  });

  it('should return invalid for undefined with accessible error message', () => {
    const result = validateRequired(undefined, 'Test Field');
    expect(result.isValid).toBe(false);
    expect(result.errors['Test Field'][0]).toBe('Test Field is required');
  });

  it('should return invalid for empty string with accessible error message', () => {
    const result = validateRequired('', 'Test Field');
    expect(result.isValid).toBe(false);
    expect(result.errors['Test Field'][0]).toBe('Test Field cannot be empty');
  });

  it('should return invalid for whitespace with accessible error message', () => {
    const result = validateRequired('   ', 'Test Field');
    expect(result.isValid).toBe(false);
    expect(result.errors['Test Field'][0]).toBe('Test Field cannot be empty');
  });

  it('should return invalid for empty array with accessible error message', () => {
    const result = validateRequired([], 'Test Field');
    expect(result.isValid).toBe(false);
    expect(result.errors['Test Field'][0]).toBe('At least one Test Field must be selected');
  });

  it('should return valid for non-empty values with type checking', () => {
    expect(validateRequired('test', 'Test Field').isValid).toBe(true);
    expect(validateRequired(['item'], 'Test Field').isValid).toBe(true);
    expect(validateRequired(123, 'Test Field').isValid).toBe(true);
    expect(validateRequired({ key: 'value' }, 'Test Field').isValid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should validate RFC 5322 compliant email formats', () => {
    expect(validateEmail('test@example.com').isValid).toBe(true);
    expect(validateEmail('test.name+label@example.co.uk').isValid).toBe(true);
    expect(validateEmail('invalid@email').isValid).toBe(false);
    expect(validateEmail('invalid.email@').isValid).toBe(false);
  });

  it('should validate domain and TLD combinations', () => {
    const options = { allowedDomains: ['example.com', 'company.net'] };
    expect(validateEmail('test@example.com', options).isValid).toBe(true);
    expect(validateEmail('test@company.net', options).isValid).toBe(true);
    expect(validateEmail('test@other.com', options).isValid).toBe(false);
  });

  it('should provide accessible error messages', () => {
    const result = validateEmail('invalid@email');
    expect(result.errors.email[0]).toBe('Please enter a valid email address');
  });
});

describe('validateDateRange', () => {
  it('should handle timezone boundary cases', () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-02T00:00:00Z');
    expect(validateDateRange(startDate, endDate).isValid).toBe(true);
  });

  it('should validate date range limits', () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-10');
    const minDate = new Date('2023-01-05');
    const maxDate = new Date('2023-01-15');
    
    const result = validateDateRange(startDate, endDate, { minDate, maxDate });
    expect(result.isValid).toBe(false);
    expect(result.errors.dateRange[0]).toContain('Start date cannot be before');
  });

  it('should provide accessible error messages for invalid dates', () => {
    const result = validateDateRange(new Date('invalid'), new Date('2023-01-01'));
    expect(result.errors.dateRange[0]).toBe('Please enter valid dates');
  });
});

describe('validateCurrency', () => {
  it('should enforce decimal precision rules', () => {
    expect(validateCurrency(100.00).isValid).toBe(true);
    expect(validateCurrency(100.123).isValid).toBe(false);
  });

  it('should validate amount limits', () => {
    const options = { minAmount: 100, maxAmount: 1000 };
    expect(validateCurrency(50, options).isValid).toBe(false);
    expect(validateCurrency(500, options).isValid).toBe(true);
    expect(validateCurrency(1500, options).isValid).toBe(false);
  });

  it('should handle negative values', () => {
    expect(validateCurrency(-100).isValid).toBe(false);
    expect(validateCurrency(-100, { allowNegative: true }).isValid).toBe(true);
  });

  it('should provide accessible error messages', () => {
    const result = validateCurrency(100.123);
    expect(result.errors.amount[0]).toBe('Amount cannot have more than 2 decimal places');
  });
});

describe('validatePhoneNumber', () => {
  it('should validate North American formats', () => {
    expect(validatePhoneNumber('123-456-7890').isValid).toBe(true);
    expect(validatePhoneNumber('(123) 456-7890').isValid).toBe(true);
    expect(validatePhoneNumber('12345').isValid).toBe(false);
  });

  it('should handle extensions', () => {
    expect(validatePhoneNumber('123-456-7890 x123', { allowExtensions: true }).isValid).toBe(true);
    expect(validatePhoneNumber('123-456-7890 x123', { allowExtensions: false }).isValid).toBe(false);
  });

  it('should validate custom formats', () => {
    const options = { format: '^\\+1-\\d{3}-\\d{3}-\\d{4}$' };
    expect(validatePhoneNumber('+1-123-456-7890', options).isValid).toBe(true);
    expect(validatePhoneNumber('123-456-7890', options).isValid).toBe(false);
  });

  it('should provide accessible error messages', () => {
    const result = validatePhoneNumber('12345');
    expect(result.errors.phoneNumber[0]).toBe('Please enter a valid phone number');
  });
});