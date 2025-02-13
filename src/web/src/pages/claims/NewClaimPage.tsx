import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@chakra-ui/react';
import { Analytics } from '@segment/analytics-next';

import DashboardLayout from '../../components/layout/DashboardLayout';
import ClaimForm from '../../components/claims/ClaimForm';
import PageHeader from '../../components/common/PageHeader';
import { useNotification } from '../../hooks/useNotification';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { CLAIMS_ROUTES } from '../../constants/routes.constants';
import type { Claim } from '../../types/claims.types';

// Initialize analytics
const analytics = new Analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY || ''
});

/**
 * NewClaimPage component for creating new insurance claims
 * Implements WCAG 2.1 Level AA compliance and real-time OneShield integration
 */
const NewClaimPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Handle form submission success
  const handleSubmitSuccess = useCallback(async (claim: Claim) => {
    try {
      // Track successful claim submission
      await analytics.track('Claim Submitted', {
        claimId: claim.id,
        policyId: claim.policyId,
        type: 'new_claim',
        timestamp: new Date().toISOString()
      });

      showSuccess('Claim submitted successfully');
      setHasUnsavedChanges(false);
      navigate(`${CLAIMS_ROUTES.DETAILS.replace(':id', claim.id)}`);
    } catch (error) {
      console.error('Error handling claim submission success:', error);
    }
  }, [navigate, showSuccess]);

  // Handle form submission error
  const handleSubmitError = useCallback((error: Error) => {
    showError(error.message || 'Failed to submit claim. Please try again.');
    setIsSubmitting(false);

    // Track submission error
    analytics.track('Claim Submission Failed', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, [showError]);

  // Handle form cancellation
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    navigate(CLAIMS_ROUTES.LIST);
  }, [navigate, hasUnsavedChanges]);

  // Set up unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <Container maxWidth="lg">
          <PageHeader
            title="New Claim"
            subtitle="Submit a new insurance claim with supporting documentation"
            actions={[]}
            showBreadcrumbs
          />

          <ClaimForm
            policyId=""
            onSubmitSuccess={handleSubmitSuccess}
            onCancel={handleCancel}
            onFormChange={() => setHasUnsavedChanges(true)}
            isSubmitting={isSubmitting}
            onError={handleSubmitError}
          />
        </Container>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default NewClaimPage;