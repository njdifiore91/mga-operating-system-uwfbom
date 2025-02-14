import React, { useState, useCallback, useEffect, memo } from 'react';
import { Box, Button, CircularProgress, Snackbar, Alert } from '@mui/material'; // @mui/material@5.14.x
import { Add as AddIcon } from '@mui/icons-material'; // @mui/icons-material@5.14.x
import { useNavigate } from 'react-router-dom'; // react-router-dom@6.14.x
import { debounce } from 'lodash'; // lodash@4.17.x

import ClaimsList from '../../components/claims/ClaimsList';
import PageHeader from '../../components/common/PageHeader';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useClaims } from '../../hooks/useClaims';

/**
 * ClaimsListPage Component - Displays a comprehensive list of insurance claims
 * with real-time updates, virtualized scrolling, and WCAG 2.1 Level AA compliance
 */
const ClaimsListPage: React.FC = memo(() => {
  // Hooks initialization
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize claims data with real-time updates
  const {
    claims,
    isLoading,
    error: claimsError,
    pagination,
    fetchClaims
  } = useClaims({
    autoFetch: true,
    pageSize: 25,
    enableRealTimeUpdates: true
  });

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
      fetchClaims({
        searchTerm: term,
        page: 1 // Reset to first page on search
      });
    }, 300),
    [fetchClaims]
  );

  // Handle new claim button click
  const handleNewClaim = useCallback(() => {
    try {
      navigate('/claims/new');
    } catch (err) {
      setError('Failed to navigate to new claim page');
    }
  }, [navigate]);

  // Handle claim selection
  const handleClaimSelect = useCallback((claimId: string) => {
    try {
      navigate(`/claims/${claimId}`);
    } catch (err) {
      setError('Failed to navigate to claim details');
    }
  }, [navigate]);

  // Error handling for claims loading
  const handleErrorClose = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ErrorBoundary>
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 3
        }}
      >
        {/* Page Header with Search */}
        <PageHeader
          title="Claims Management"
          subtitle={`${pagination.total} total claims`}
          showSearch
          onSearch={handleSearch}
          actions={
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleNewClaim}
              aria-label="Create new claim"
              data-testid="new-claim-button"
            >
              New Claim
            </Button>
          }
        />

        {/* Claims List with Loading State */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            position: 'relative'
          }}
        >
          {isLoading && !claims.length ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%'
              }}
            >
              <CircularProgress
                size={40}
                aria-label="Loading claims"
              />
            </Box>
          ) : (
            <ClaimsList
              onClaimSelect={handleClaimSelect}
              filterParams={{
                status: [],
                dateRange: {
                  startDate: '',
                  endDate: ''
                },
                searchTerm
              }}
              initialSort={{
                sortBy: 'lastActivityDate',
                sortOrder: 'desc'
              }}
              pageSize={25}
            />
          )}
        </Box>

        {/* Error Notifications */}
        <Snackbar
          open={!!error || !!claimsError}
          autoHideDuration={6000}
          onClose={handleErrorClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleErrorClose}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {error || claimsError?.message || 'An error occurred'}
          </Alert>
        </Snackbar>
      </Box>
    </ErrorBoundary>
  );
});

ClaimsListPage.displayName = 'ClaimsListPage';

export default ClaimsListPage;