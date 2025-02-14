import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@mui/material';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/common/PageHeader';
import PolicyForm from '../../components/policy/PolicyForm';
import { useNotification } from '../../hooks/useNotification';
import { IPolicy } from '../../types/policy.types';
import { PolicyService } from '../../services/policy.service';
import { POLICY_ROUTES } from '../../constants/routes.constants';

/**
 * NewPolicyPage component for creating new insurance policies
 * Implements comprehensive policy creation with OneShield integration
 * and WCAG 2.1 Level AA compliance
 */
const NewPolicyPage: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup any pending operations
      if (isSubmitting) {
        setIsSubmitting(false);
      }
    };
  }, [isSubmitting]);

  /**
   * Handles policy form submission with OneShield integration
   * @param policyData - Complete policy data from form
   */
  const handlePolicySubmit = useCallback(async (policyData: IPolicy) => {
    setIsSubmitting(true);

    try {
      // Submit policy
      const createdPolicy = await PolicyService.submitNewPolicy(policyData);

      // Show success notification
      showNotification({
        message: 'Policy created successfully',
        severity: 'success',
        duration: 5000,
        ariaLive: 'polite'
      });

      // Navigate to policy details
      navigate(`${POLICY_ROUTES.DETAILS.replace(':id', createdPolicy.id)}`);
    } catch (error) {
      // Handle submission error
      console.error('Policy creation failed:', error);

      // Show error notification
      showNotification({
        message: 'Failed to create policy. Please try again.',
        severity: 'error',
        duration: 8000,
        ariaLive: 'assertive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, showNotification]);

  return (
    <DashboardLayout>
      <Container maxWidth={false}>
        <PageHeader
          title="Create New Policy"
          subtitle="Enter policy details and submit for underwriting review"
          showBreadcrumbs={true}
          analyticsData={{
            page: 'new_policy',
            section: 'policy_creation'
          }}
        />

        <PolicyForm
          onSubmit={handlePolicySubmit}
          isEditMode={false}
        />
      </Container>
    </DashboardLayout>
  );
};

export default NewPolicyPage;