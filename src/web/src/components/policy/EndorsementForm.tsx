/**
 * EndorsementForm Component
 * A production-ready form component for creating and managing policy endorsements
 * with comprehensive validation, accessibility features, and OneShield integration.
 * @version 1.0.0
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { Analytics } from '@segment/analytics-next';
import { IEndorsement } from '../../types/policy.types';
import { PolicyService } from '../../services/policy.service';

// Endorsement types based on business requirements
const ENDORSEMENT_TYPES = {
  COVERAGE_CHANGE: 'Coverage Change',
  LIMIT_CHANGE: 'Limit Change',
  DEDUCTIBLE_CHANGE: 'Deductible Change',
  NAMED_INSURED: 'Named Insured Change',
  LOCATION_CHANGE: 'Location Change',
} as const;

type EndorsementType = typeof ENDORSEMENT_TYPES[keyof typeof ENDORSEMENT_TYPES];

// Validation schema with business rules
const endorsementSchema = yup.object().shape({
  type: yup.string()
    .required('Endorsement type is required')
    .oneOf(Object.values(ENDORSEMENT_TYPES), 'Invalid endorsement type') as yup.StringSchema<EndorsementType>,
  effectiveDate: yup.date()
    .required('Effective date is required')
    .min(new Date(), 'Effective date cannot be in the past')
    .max(
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      'Effective date cannot be more than 90 days in the future'
    ),
  changes: yup.object().required('Changes are required'),
  premiumChange: yup.number()
    .required('Premium change is required')
    .test('premium-limit', 'Premium change exceeds allowed limit', 
      (value) => Math.abs(value || 0) <= 1000000),
});

interface EndorsementFormProps {
  policyId: string;
  onSubmit: (endorsement: IEndorsement) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<IEndorsement>;
}

export const EndorsementForm: React.FC<EndorsementFormProps> = ({
  policyId,
  onSubmit,
  onCancel,
  initialData,
}) => {
  const analytics = new Analytics();

  // Form initialization with validation
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    watch,
  } = useForm<IEndorsement>({
    resolver: yupResolver(endorsementSchema),
    defaultValues: {
      type: initialData?.type || '',
      effectiveDate: initialData?.effectiveDate || null,
      changes: initialData?.changes || {},
      premiumChange: initialData?.premiumChange || 0,
    },
  });

  // Track form changes for analytics
  const formValues = watch();
  useEffect(() => {
    if (isDirty) {
      analytics.track('Endorsement Form Updated', {
        policyId,
        formData: formValues,
        timestamp: new Date().toISOString(),
      });
    }
  }, [formValues, isDirty, policyId, analytics]);

  // Auto-save functionality
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (isDirty) {
        localStorage.setItem(
          `endorsement_draft_${policyId}`,
          JSON.stringify(formValues)
        );
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [formValues, isDirty, policyId]);

  // Handle form submission with validation and error handling
  const onFormSubmit = async (data: IEndorsement) => {
    try {
      // Track submission attempt
      analytics.track('Endorsement Submission Started', {
        policyId,
        endorsementType: data.type,
      });

      // Submit endorsement through service
      await PolicyService.submitEndorsement(policyId, data);
      
      // Clear draft on successful submission
      localStorage.removeItem(`endorsement_draft_${policyId}`);
      
      // Notify parent component
      await onSubmit(data);

      // Track successful submission
      analytics.track('Endorsement Submission Completed', {
        policyId,
        endorsementType: data.type,
      });
    } catch (error) {
      // Track submission failure
      analytics.track('Endorsement Submission Failed', {
        policyId,
        endorsementType: data.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  };

  // Memoized premium calculation
  const calculatedPremium = useMemo(() => {
    // Add premium calculation logic based on changes
    return formValues.premiumChange;
  }, [formValues.premiumChange]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      aria-label="Endorsement Form"
      sx={{ mt: 2 }}
    >
      <Grid container spacing={3}>
        {/* Endorsement Type Selection */}
        <Grid item xs={12} md={6}>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.type}>
                <InputLabel id="endorsement-type-label">
                  Endorsement Type
                </InputLabel>
                <Select
                  {...field}
                  labelId="endorsement-type-label"
                  label="Endorsement Type"
                  required
                >
                  {Object.entries(ENDORSEMENT_TYPES).map(([key, value]) => (
                    <MenuItem key={key} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{errors.type?.message}</FormHelperText>
              </FormControl>
            )}
          />
        </Grid>

        {/* Effective Date Selection */}
        <Grid item xs={12} md={6}>
          <Controller
            name="effectiveDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Effective Date"
                value={field.value}
                onChange={field.onChange}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: !!errors.effectiveDate,
                    helperText: errors.effectiveDate?.message,
                  },
                }}
              />
            )}
          />
        </Grid>

        {/* Changes Section */}
        <Grid item xs={12}>
          <Controller
            name="changes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Changes"
                multiline
                rows={4}
                fullWidth
                required
                error={!!errors.changes}
                helperText={errors.changes?.message || ''}
                onChange={(e) => field.onChange(JSON.parse(e.target.value || '{}'))}
                value={JSON.stringify(field.value, null, 2)}
              />
            )}
          />
        </Grid>

        {/* Premium Change */}
        <Grid item xs={12} md={6}>
          <Controller
            name="premiumChange"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Premium Change"
                type="number"
                fullWidth
                required
                error={!!errors.premiumChange}
                helperText={errors.premiumChange?.message || ''}
                InputProps={{
                  startAdornment: '$',
                }}
              />
            )}
          />
        </Grid>

        {/* Calculated Premium Display */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Calculated Premium Change: ${calculatedPremium.toFixed(2)}
          </Typography>
        </Grid>

        {/* Form Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || !isDirty}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
            >
              Submit Endorsement
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EndorsementForm;