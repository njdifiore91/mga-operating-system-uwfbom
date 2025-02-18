/**
 * Enhanced date picker component for MGA OS with policy-specific validation
 * and WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker'; // v6.x
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker'; // v6.x
import { TextField } from '@mui/material'; // v5.14.x
import { formatDate, parseDate } from '../../utils/date.utils';
import { validateDateRange } from '../../utils/validation.utils';
import { Timestamp, DateRange } from '../../types/common.types';

// Constants for date formatting and validation
const MIN_POLICY_TERM = 1; // days
const MAX_POLICY_TERM = 366; // days

export interface PolicyDateValidationRules {
  minDate?: Date;
  maxDate?: Date;
  businessDaysOnly?: boolean;
  allowPastDates?: boolean;
  termLimits?: {
    min: number;
    max: number;
  };
}

export interface DatePickerProps {
  value: Timestamp | null;
  onChange: (date: Timestamp | null) => void;
  onRangeChange?: (range: DateRange | null) => void;
  label: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  minDate?: Timestamp;
  maxDate?: Timestamp;
  isRangePicker?: boolean;
  validationRules?: PolicyDateValidationRules;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  onRangeChange,
  label,
  error = false,
  helperText = '',
  disabled = false,
  minDate,
  maxDate,
  isRangePicker = false,
  validationRules,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  // State management
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? parseDate(value) : null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(true);

  // Validation rules with defaults
  const rules: PolicyDateValidationRules = {
    minDate: minDate ? (parseDate(minDate) || undefined) : undefined,
    maxDate: maxDate ? (parseDate(maxDate) || undefined) : undefined,
    businessDaysOnly: validationRules?.businessDaysOnly ?? false,
    allowPastDates: validationRules?.allowPastDates ?? false,
    termLimits: validationRules?.termLimits ?? {
      min: MIN_POLICY_TERM,
      max: MAX_POLICY_TERM,
    },
  };

  /**
   * Validates a single date against policy rules
   * @param date - Date to validate
   * @returns Validation result with error message if invalid
   */
  const validateSingleDate = useCallback((date: Date | null): { isValid: boolean; error: string } => {
    if (!date) {
      return { isValid: true, error: '' };
    }

    const now = new Date();
    
    if (!rules.allowPastDates && date < now) {
      return { isValid: false, error: 'Date cannot be in the past' };
    }

    if (rules.minDate && date < rules.minDate) {
      return { isValid: false, error: `Date cannot be before ${formatDate(rules.minDate)}` };
    }

    if (rules.maxDate && date > rules.maxDate) {
      return { isValid: false, error: `Date cannot be after ${formatDate(rules.maxDate)}` };
    }

    if (rules.businessDaysOnly) {
      const day = date.getDay();
      if (day === 0 || day === 6) {
        return { isValid: false, error: 'Please select a business day' };
      }
    }

    return { isValid: true, error: '' };
  }, [rules]);

  /**
   * Handles single date selection with validation
   * @param date - Selected date or null
   */
  const handleDateChange = useCallback((date: Date | null) => {
    const validation = validateSingleDate(date);
    setIsValid(validation.isValid);
    setValidationError(validation.error);
    setSelectedDate(date);

    if (validation.isValid && onChange) {
      onChange(date ? formatDate(date, 'yyyy-MM-dd') : null);
    }
  }, [onChange, validateSingleDate]);

  /**
   * Handles date range selection with validation
   * @param range - Selected date range or null
   */
  const handleRangeChange = useCallback((range: [Date | null, Date | null]) => {
    if (!range[0] || !range[1]) {
      setDateRange(null);
      setIsValid(true);
      setValidationError('');
      if (onRangeChange) {
        onRangeChange(null);
      }
      return;
    }

    const validation = validateDateRange(range[0], range[1], {
      minDate: rules.minDate,
      maxDate: rules.maxDate,
      businessDaysOnly: rules.businessDaysOnly,
    });

    setIsValid(validation.isValid);
    setValidationError(validation.errors.dateRange?.[0] || '');

    if (validation.isValid) {
      const formattedRange: DateRange = {
        startDate: formatDate(range[0], 'yyyy-MM-dd'),
        endDate: formatDate(range[1], 'yyyy-MM-dd'),
      };
      setDateRange(formattedRange);
      if (onRangeChange) {
        onRangeChange(formattedRange);
      }
    }
  }, [onRangeChange, rules]);

  // Update state when value prop changes
  useEffect(() => {
    if (value && !isRangePicker) {
      setSelectedDate(parseDate(value));
    }
  }, [value, isRangePicker]);

  return isRangePicker ? (
    <DateRangePicker
      disabled={disabled}
      value={[
        dateRange?.startDate ? parseDate(dateRange.startDate) : null,
        dateRange?.endDate ? parseDate(dateRange.endDate) : null
      ]}
      onChange={handleRangeChange}
      slotProps={{
        textField: (index: number) => ({
          label: index === 0 ? `${label} Start` : `${label} End`,
          error: !isValid || error,
          helperText: validationError || helperText,
          'aria-label': `${ariaLabel} ${index === 0 ? 'start' : 'end'} date`,
          'aria-describedby': ariaDescribedBy
        })
      }}
      minDate={rules.minDate}
      maxDate={rules.maxDate}
    />
  ) : (
    <MuiDatePicker
      value={selectedDate}
      onChange={handleDateChange}
      disabled={disabled}
      slotProps={{
        textField: {
          label,
          error: !isValid || error,
          helperText: validationError || helperText,
          'aria-label': ariaLabel,
          'aria-describedby': ariaDescribedBy,
          fullWidth: true
        }
      }}
      minDate={rules.minDate}
      maxDate={rules.maxDate}
    />
  );
};

export default DatePicker;