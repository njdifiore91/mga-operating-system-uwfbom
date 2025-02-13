import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress
} from '@chakra-ui/react';
import { Claim, ClaimLocation, ClaimantInfo, ClaimDocument } from '../../types/claims.types';
import { useClaims } from '../../hooks/useClaims';
import { validateClaimForm, validateClaimDocument } from '../../validators/claims.validator';
import FileUpload from '../common/FileUpload';
import DatePicker from '../common/DatePicker';
import { CLAIM_DOCUMENT_TYPES, MAX_CLAIM_DESCRIPTION_LENGTH } from '../../constants/claims.constants';

interface ClaimFormProps {
  policyId: string;
  onSubmitSuccess?: (claim: Claim) => void;
  onCancel?: () => void;
}

interface ClaimFormData {
  policyId: string;
  incidentDate: Date;
  description: string;
  location: ClaimLocation;
  claimantInfo: ClaimantInfo;
  initialReserve: number;
  documents: File[];
}

export const ClaimForm: React.FC<ClaimFormProps> = ({
  policyId,
  onSubmitSuccess,
  onCancel
}) => {
  // Form state management
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch
  } = useForm<ClaimFormData>({
    defaultValues: {
      policyId,
      incidentDate: new Date(),
      description: '',
      location: {
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA'
      },
      claimantInfo: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        relationship: ''
      },
      initialReserve: 0,
      documents: []
    }
  });

  // Custom hooks
  const { submitClaim, uploadDocuments } = useClaims();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form submission handler
  const onSubmit = useCallback(async (data: ClaimFormData) => {
    try {
      setIsProcessing(true);
      setUploadError(null);

      // Validate form data
      const validation = validateClaimForm(data);
      if (!validation.isValid) {
        throw new Error(Object.values(validation.errors).flat().join('. '));
      }

      // Submit claim
      const claim = await submitClaim({
        policyId: data.policyId,
        incidentDate: data.incidentDate,
        description: data.description,
        location: data.location,
        claimantInfo: data.claimantInfo,
        initialReserve: data.initialReserve
      });

      // Upload documents if present
      if (data.documents.length > 0) {
        await uploadDocuments(claim.id, data.documents);
      }

      // Reset form and notify success
      reset();
      onSubmitSuccess?.(claim);

    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to submit claim');
    } finally {
      setIsProcessing(false);
    }
  }, [submitClaim, uploadDocuments, reset, onSubmitSuccess]);

  // File upload handler
  const handleFileUpload = useCallback(async (files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate each file
    for (const file of files) {
      const validation = validateClaimDocument(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(...Object.values(validation.errors).flat());
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join('. '));
      return;
    }

    setValue('documents', validFiles);
  }, [setValue]);

  return (
    <Box
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Claim submission form"
      role="form"
    >
      <Grid templateColumns="repeat(12, 1fr)" gap={6}>
        {/* Incident Information */}
        <Grid item xs={12}>
          <Typography variant="h6" component="h2" mb={3}>
            Incident Information
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="incidentDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Incident Date"
                value={field.value}
                onChange={field.onChange}
                error={!!errors.incidentDate}
                helperText={errors.incidentDate?.message}
                validationRules={{
                  allowPastDates: true,
                  businessDaysOnly: false
                }}
                aria-label="Select incident date"
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                multiline
                rows={4}
                label="Incident Description"
                error={!!errors.description}
                helperText={`${field.value.length}/${MAX_CLAIM_DESCRIPTION_LENGTH} characters. ${errors.description?.message || ''}`}
                inputProps={{
                  maxLength: MAX_CLAIM_DESCRIPTION_LENGTH,
                  'aria-label': 'Incident description'
                }}
                fullWidth
              />
            )}
          />
        </Grid>

        {/* Location Information */}
        <Grid item xs={12}>
          <Typography variant="h6" component="h2" mb={3}>
            Location Information
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="location.address"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Street Address"
                error={!!errors.location?.address}
                helperText={errors.location?.address?.message}
                fullWidth
                inputProps={{ 'aria-label': 'Street address' }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="location.city"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="City"
                error={!!errors.location?.city}
                helperText={errors.location?.city?.message}
                fullWidth
                inputProps={{ 'aria-label': 'City' }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <Controller
            name="location.state"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="State"
                error={!!errors.location?.state}
                helperText={errors.location?.state?.message}
                fullWidth
                inputProps={{ 'aria-label': 'State' }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <Controller
            name="location.zipCode"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="ZIP Code"
                error={!!errors.location?.zipCode}
                helperText={errors.location?.zipCode?.message}
                fullWidth
                inputProps={{
                  'aria-label': 'ZIP code',
                  pattern: '[0-9]{5}(-[0-9]{4})?'
                }}
              />
            )}
          />
        </Grid>

        {/* Claimant Information */}
        <Grid item xs={12}>
          <Typography variant="h6" component="h2" mb={3}>
            Claimant Information
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="claimantInfo.firstName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="First Name"
                error={!!errors.claimantInfo?.firstName}
                helperText={errors.claimantInfo?.firstName?.message}
                fullWidth
                inputProps={{ 'aria-label': 'First name' }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="claimantInfo.lastName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Last Name"
                error={!!errors.claimantInfo?.lastName}
                helperText={errors.claimantInfo?.lastName?.message}
                fullWidth
                inputProps={{ 'aria-label': 'Last name' }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="claimantInfo.email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="email"
                label="Email"
                error={!!errors.claimantInfo?.email}
                helperText={errors.claimantInfo?.email?.message}
                fullWidth
                inputProps={{ 'aria-label': 'Email address' }}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="claimantInfo.phone"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Phone"
                error={!!errors.claimantInfo?.phone}
                helperText={errors.claimantInfo?.phone?.message}
                fullWidth
                inputProps={{
                  'aria-label': 'Phone number',
                  pattern: '[0-9]{3}-[0-9]{3}-[0-9]{4}'
                }}
              />
            )}
          />
        </Grid>

        {/* Document Upload */}
        <Grid item xs={12}>
          <Typography variant="h6" component="h2" mb={3}>
            Supporting Documents
          </Typography>
          <FileUpload
            acceptedTypes={Object.values(CLAIM_DOCUMENT_TYPES)}
            onUpload={handleFileUpload}
            multiple
            label="Drop claim documents here or click to upload"
            ariaLabel="Upload claim documents"
          />
        </Grid>

        {/* Error Display */}
        {uploadError && (
          <Grid item xs={12}>
            <Alert status="error" mb={4}>
              {uploadError}
            </Alert>
          </Grid>
        )}

        {/* Form Actions */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              aria-label="Cancel claim submission"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              colorScheme="blue"
              disabled={isProcessing}
              leftIcon={isProcessing ? <CircularProgress size="sm" /> : undefined}
              aria-label="Submit claim"
            >
              {isProcessing ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ClaimForm;