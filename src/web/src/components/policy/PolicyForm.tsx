import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormHelperText,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { debounce } from 'lodash';
import { IPolicy, PolicyType, PolicyStatus } from '../../types/policy.types';
import { PolicyService } from '../../services/policy.service';
import { validatePolicy } from '../../validators/policy.validator';
import { POLICY_VALIDATION, POLICY_TYPES } from '../../constants/policy.constants';

// Form steps configuration
const FORM_STEPS = [
  { label: 'Basic Information', description: 'Enter policy details' },
  { label: 'Coverage Configuration', description: 'Configure policy coverages' },
  { label: 'Underwriting Review', description: 'Review and validate policy' },
  { label: 'Document Upload', description: 'Upload required documents' }
];

interface PolicyFormProps {
  initialData?: Partial<IPolicy>;
  isEditMode?: boolean;
  onSubmit: (policy: IPolicy) => Promise<void>;
}

/**
 * Enhanced policy form component with OneShield integration and accessibility features
 */
const PolicyForm: React.FC<PolicyFormProps> = ({
  initialData = {},
  isEditMode = false,
  onSubmit
}) => {
  // Form state management
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<IPolicy>({
    defaultValues: {
      type: PolicyType.COMMERCIAL_PROPERTY,
      status: PolicyStatus.DRAFT,
      ...initialData
    }
  });

  // Component state
  const [activeStep, setActiveStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [oneShieldStatus, setOneShieldStatus] = useState<{
    isValidating: boolean;
    error?: string;
  }>({ isValidating: false });

  // Watch form values for validation
  const watchedValues = watch();

  // Debounced OneShield validation
  const validateWithOneShield = useCallback(
    debounce(async (formData: Partial<IPolicy>) => {
      try {
        setOneShieldStatus({ isValidating: true });
        await PolicyService.validateWithOneShield(formData);
        setOneShieldStatus({ isValidating: false });
      } catch (error) {
        setOneShieldStatus({
          isValidating: false,
          error: 'OneShield validation failed. Please check your policy details.'
        });
      }
    }, 500),
    []
  );

  // Validate form data on change
  useEffect(() => {
    if (isDirty) {
      const validationResult = validatePolicy(watchedValues as IPolicy);
      setValidationErrors(validationResult.errors);

      if (validationResult.isValid) {
        validateWithOneShield(watchedValues);
      }
    }
  }, [watchedValues, isDirty]);

  // Form submission handler
  const handleFormSubmit = async (formData: IPolicy) => {
    try {
      // Final validation
      const validationResult = validatePolicy(formData);
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors);
        return;
      }

      // OneShield validation
      await PolicyService.validateWithOneShield(formData);

      // Submit policy
      await onSubmit(formData);
    } catch (error) {
      console.error('Policy submission failed:', error);
      setValidationErrors({
        submit: ['Failed to submit policy. Please try again.']
      });
    }
  };

  // Step navigation
  const handleNext = () => setActiveStep(prev => prev + 1);
  const handleBack = () => setActiveStep(prev => prev - 1);

  // Render basic information step
  const renderBasicInfo = () => (
    <Box sx={{ p: 2 }}>
      <Controller
        name="type"
        control={control}
        rules={{ required: 'Policy type is required' }}
        render={({ field }) => (
          <FormControl fullWidth error={!!errors.type} sx={{ mb: 2 }}>
            <Select
              {...field}
              labelId="policy-type-label"
              id="policy-type"
              aria-label="Policy Type"
            >
              {Object.values(POLICY_TYPES).map(type => (
                <MenuItem key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{errors.type?.message}</FormHelperText>
          </FormControl>
        )}
      />

      <Controller
        name="effectiveDate"
        control={control}
        rules={{ required: 'Effective date is required' }}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            type="date"
            label="Effective Date"
            error={!!errors.effectiveDate}
            helperText={errors.effectiveDate?.message}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
        )}
      />

      <Controller
        name="expirationDate"
        control={control}
        rules={{ required: 'Expiration date is required' }}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            type="date"
            label="Expiration Date"
            error={!!errors.expirationDate}
            helperText={errors.expirationDate?.message}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
        )}
      />
    </Box>
  );

  // Render coverage configuration step
  const renderCoverages = () => (
    <Box sx={{ p: 2 }}>
      <Controller
        name="coverages"
        control={control}
        rules={{ required: 'At least one coverage is required' }}
        render={({ field }) => (
          <Box>
            {field.value?.map((coverage, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  label="Coverage Type"
                  value={coverage.type}
                  onChange={e => {
                    const newCoverages = [...field.value];
                    newCoverages[index].type = e.target.value;
                    setValue('coverages', newCoverages);
                  }}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Coverage Limit"
                  value={coverage.limit}
                  onChange={e => {
                    const newCoverages = [...field.value];
                    newCoverages[index].limit = Number(e.target.value);
                    setValue('coverages', newCoverages);
                  }}
                  sx={{ mb: 2 }}
                />
              </Paper>
            ))}
            <Button
              variant="outlined"
              onClick={() => {
                const newCoverages = [...(field.value || [])];
                newCoverages.push({
                  type: '',
                  limit: POLICY_VALIDATION.MIN_COVERAGE_AMOUNT,
                  deductible: 0,
                  premium: 0
                });
                setValue('coverages', newCoverages);
              }}
            >
              Add Coverage
            </Button>
          </Box>
        )}
      />
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {FORM_STEPS.map((step, index) => (
          <Step key={step.label}>
            <StepLabel
              optional={
                <Typography variant="caption">{step.description}</Typography>
              }
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <ul>
            {Object.entries(validationErrors).map(([field, errors]) => (
              errors.map((error, index) => (
                <li key={`${field}-${index}`}>{error}</li>
              ))
            ))}
          </ul>
        </Alert>
      )}

      {/* OneShield Status */}
      {oneShieldStatus.isValidating && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Validating with OneShield...
        </Alert>
      )}
      {oneShieldStatus.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {oneShieldStatus.error}
        </Alert>
      )}

      {/* Form Steps */}
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        {activeStep === 0 && renderBasicInfo()}
        {activeStep === 1 && renderCoverages()}
        {/* Additional steps rendered similarly */}

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box>
            {activeStep === FORM_STEPS.length - 1 ? (
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting || oneShieldStatus.isValidating}
                startIcon={isSubmitting && <CircularProgress size={20} />}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Policy'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={Object.keys(validationErrors).length > 0}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default PolicyForm;