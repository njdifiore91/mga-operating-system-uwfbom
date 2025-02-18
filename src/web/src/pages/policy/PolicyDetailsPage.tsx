import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Button,
  Skeleton,
  Alert,
  Snackbar
} from '@mui/material';
import PolicyDetails from '../../components/policy/PolicyDetails';
import PageHeader from '../../components/common/PageHeader';
import { usePolicies } from '../../hooks/usePolicies';
import { IPolicy } from '../../types/policy.types';
import { POLICY_ROUTES } from '../../constants/routes.constants';

/**
 * PolicyDetailsPage Component
 * Displays comprehensive policy information with enhanced accessibility and real-time updates
 */
const PolicyDetailsPage: React.FC = () => {
  // URL parameter and navigation hooks
  const { id: policyId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Local state management
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Policy management hooks
  const {
    policies,
    loading,
    error,
    updatePolicy,
    bindPolicy,
    refreshPolicies
  } = usePolicies({
    autoFetch: false
  });

  // Get current policy from policies array
  const currentPolicy = policies.find((policy: IPolicy) => policy.id === policyId);

  // Fetch policy data on mount or policy ID change
  useEffect(() => {
    if (policyId) {
      refreshPolicies();
    }
  }, [policyId, refreshPolicies]);

  /**
   * Handles policy updates with optimistic updates and error recovery
   */
  const handlePolicyUpdate = useCallback(async (updatedPolicy: Partial<IPolicy>) => {
    if (!policyId) return;

    try {
      await updatePolicy(policyId, updatedPolicy);
      setSnackbar({
        open: true,
        message: 'Policy updated successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to update policy. Please try again.',
        severity: 'error'
      });
    }
  }, [policyId, updatePolicy]);

  /**
   * Handles policy binding with proper error handling
   */
  const handleBindPolicy = useCallback(async () => {
    if (!policyId) return;

    try {
      await bindPolicy(policyId);
      setSnackbar({
        open: true,
        message: 'Policy bound successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to bind policy. Please try again.',
        severity: 'error'
      });
    }
  }, [policyId, bindPolicy]);

  /**
   * Handles navigation back to policy list
   */
  const handleBackToList = useCallback(() => {
    navigate(POLICY_ROUTES.LIST);
  }, [navigate]);

  /**
   * Handles snackbar close
   */
  const handleSnackbarClose = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Render loading state
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Container>
    );
  }

  // Render error state
  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert 
            severity="error"
            sx={{ mb: 2 }}
            role="alert"
          >
            {error.toString()}
          </Alert>
          <Button
            variant="contained"
            onClick={handleBackToList}
            aria-label="Return to policy list"
          >
            Back to Policies
          </Button>
        </Box>
      </Container>
    );
  }

  // Render not found state
  if (!currentPolicy) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert 
            severity="warning"
            sx={{ mb: 2 }}
            role="alert"
          >
            Policy not found
          </Alert>
          <Button
            variant="contained"
            onClick={handleBackToList}
            aria-label="Return to policy list"
          >
            Back to Policies
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Page Header */}
        <PageHeader
          title={`Policy ${currentPolicy.policyNumber}`}
          subtitle={`Type: ${currentPolicy.type}`}
          showBreadcrumbs
          actions={
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleBackToList}
                aria-label="Return to policy list"
              >
                Back to Policies
              </Button>
              <Button
                variant="contained"
                onClick={handleBindPolicy}
                disabled={!currentPolicy.status}
                aria-label="Bind policy"
              >
                Bind Policy
              </Button>
            </Box>
          }
        />

        {/* Policy Details */}
        <Box sx={{ mt: 4 }}>
          <PolicyDetails
            policyId={currentPolicy.id}
            onUpdate={handlePolicyUpdate}
            refreshInterval={30000} // 30 seconds refresh interval
          />
        </Box>

        {/* Feedback Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default PolicyDetailsPage;