import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PolicyList from '../../components/policy/PolicyList';
import PageHeader from '../../components/common/PageHeader';
import { usePolicies } from '../../hooks/usePolicies';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { IPolicy } from '../../types/policy.types';
import { POLICY_ROUTES } from '../../constants/routes.constants';

/**
 * PolicyListPage Component - Displays a comprehensive list of insurance policies
 * with advanced filtering, sorting, and management capabilities.
 * Implements Material Design principles and WCAG 2.1 Level AA compliance.
 */
const PolicyListPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [retryError, setRetryError] = useState<string>('');

  // Initialize enhanced policy management hook with caching
  const {
    loading,
    error,
    totalPolicies,
    refreshPolicies
  } = usePolicies({
    autoFetch: true,
    page: 1,
    limit: 25,
    retryAttempts: 3,
    cacheTimeout: 5 * 60 * 1000 // 5 minutes
  });

  // Handle new policy creation
  const handleNewPolicy = useCallback(() => {
    navigate(POLICY_ROUTES.NEW);
  }, [navigate]);

  // Handle policy selection with optimistic updates
  const handlePolicySelect = useCallback((policy: IPolicy) => {
    navigate(`${POLICY_ROUTES.DETAILS.replace(':id', policy.id)}`);
  }, [navigate]);

  // Handle search with debouncing
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  // Handle retry on error
  const handleRetry = useCallback(async () => {
    try {
      setRetryError('');
      await refreshPolicies();
    } catch (error) {
      setRetryError('Failed to refresh policies. Please try again.');
    }
  }, [refreshPolicies]);

  // Set up automatic refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshPolicies();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [refreshPolicies]);

  // Error state with retry option
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={4}
      >
        <Alert 
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRetry}
              disabled={!!loading}
            >
              Retry
            </Button>
          }
        >
          {error.toString()}
        </Alert>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: { xs: 2, sm: 3 }
        }}
      >
        {/* Page Header with Search */}
        <PageHeader
          title="Policies"
          subtitle={`${totalPolicies} total policies`}
          showSearch
          onSearch={handleSearch}
          actions={
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleNewPolicy}
              aria-label="Create new policy"
              sx={{ minWidth: 140 }}
            >
              New Policy
            </Button>
          }
        />

        {/* Policy List with Loading State */}
        <Box flex={1} position="relative">
          <PolicyList
            onPolicySelect={handlePolicySelect}
            filterOptions={{
              searchTerm,
            }}
            pageSize={25}
            initialSort={{
              field: 'updatedAt',
              direction: 'desc'
            }}
            refreshInterval={30000}
          />
          {loading && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
              bgcolor="rgba(255, 255, 255, 0.7)"
              zIndex={1}
            >
              <CircularProgress />
            </Box>
          )}
        </Box>

        {/* Error Notification */}
        <Snackbar
          open={!!retryError}
          autoHideDuration={6000}
          onClose={() => setRetryError('')}
        >
          <Alert severity="error" onClose={() => setRetryError('')}>
            {retryError}
          </Alert>
        </Snackbar>
      </Box>
    </ErrorBoundary>
  );
});

PolicyListPage.displayName = 'PolicyListPage';

export default PolicyListPage;