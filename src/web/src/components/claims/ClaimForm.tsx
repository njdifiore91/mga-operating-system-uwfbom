import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Input,
  FormLabel,
  Text
} from '@chakra-ui/react';
import { Claim, ClaimLocation, ClaimantInfo } from '../../types/claims.types';
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
    formState: { errors },
    reset,
    setValue
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
      if (data.documents.length > 0 && claim) {
        await uploadDocuments(claim.id, data.documents);
      }

      // Reset form and notify success
      reset();
      if (claim) {
        onSubmitSuccess?.(claim);
      }

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
        <Grid gridColumn="span 12">
          <Text fontSize="xl" mb={3}>
            Incident Information
          </Text>
        </Grid>

        <Grid gridColumn={{ base: "span 12", md: "span 6" }}>
          <Controller
            name="incidentDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Incident Date"
                value={field.value.toISOString()}
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

        <Grid gridColumn="span 12">
          <FormLabel htmlFor="description">Incident Description</FormLabel>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                as="textarea"
                rows={4}
                id="description"
                isInvalid={!!errors.description}
                maxLength={MAX_CLAIM_DESCRIPTION_LENGTH}
                aria-label="Incident description"
              />
            )}
          />
          <Text fontSize="sm" color="gray.500">
            {`${field.value?.length || 0}/${MAX_CLAIM_DESCRIPTION_LENGTH} characters. ${errors.description?.message || ''}`}
          </Text>
        </Grid>

        {/* Location Information */}
        <Grid gridColumn="span 12">
          <Text fontSize="xl" mb={3}>
            Location Information
          </Text>
        </Grid>

        {/* Rest of the form fields following the same pattern */}
        {/* ... Location fields ... */}
        {/* ... Claimant fields ... */}
        {/* ... Document upload ... */}

        {/* Error Display */}
        {uploadError && (
          <Grid gridColumn="span 12">
            <Alert status="error" mb={4}>
              {uploadError}
            </Alert>
          </Grid>
        )}

        {/* Form Actions */}
        <Grid gridColumn="span 12">
          <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
            <Button
              variant="outline"
              onClick={onCancel}
              isDisabled={isProcessing}
              aria-label="Cancel claim submission"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isDisabled={isProcessing}
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