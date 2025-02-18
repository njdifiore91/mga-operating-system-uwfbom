import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  CircularProgress,
  Alert,
  Snackbar,
  Typography,
  Button
} from '@mui/material'; // v5.14.x
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PageHeader from '../../components/common/PageHeader';
import ClaimDetails from '../../components/claims/ClaimDetails';
import { useClaims } from '../../hooks/useClaims';
import { CLAIM_STATUS } from '../../constants/claims.constants';
import { useNotification } from '../../hooks/useNotification';

/**
 * Interface for OneShield synchronization status
 */
interface SyncStatus {
  status: 'synced' | 'syncing' | 'error';
  lastSynced: Date | null;
  error?: string;
}

/**
 * ClaimDetailsPage - Displays detailed information about a specific insurance claim
 * with real-time OneShield synchronization and comprehensive error handling.
 * Implements WCAG 2.1 Level AA compliance.
 */
const ClaimDetailsPage: React.FC = () => {
  // Hooks initialization
  const { claimId } = useParams<{ claimId: string }>();
  const { showNotification } = useNotification();
  
  // Claims management hook with real-time sync
  const {
    selectedClaim,
    isLoading,
    error,
    fetchClaimDetails,
    updateClaimStatus,
    validateStatusTransition
  } = useClaims();

  // Local state for sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'synced',
    lastSynced: null
  });

  // Effect for initial claim data fetching
  useEffect(() => {
    if (claimId) {
      const loadClaimDetails = async () => {
        try {
          await fetchClaimDetails(claimId);
          setSyncStatus({
            status: 'synced',
            lastSynced: new Date()
          });
        } catch (err) {
          setSyncStatus({
            status: 'error',
            lastSynced: null,
            error: 'Failed to sync with OneShield'
          });
          showNotification({
            message: 'Error loading claim details',
            severity: 'error',
            duration: 5000
          });
        }
      };

      loadClaimDetails();
    }

    // Cleanup function
    return () => {
      // Any cleanup needed for real-time connections
    };
  }, [claimId, fetchClaimDetails, showNotification]);

  /**
   * Handles claim status changes with validation and OneShield sync
   */
  const handleStatusChange = useCallback(async (newStatus: keyof typeof CLAIM_STATUS) => {
    if (!selectedClaim || !claimId) return;

    try {
      // Validate status transition
      if (!validateStatusTransition(selectedClaim.status, newStatus)) {
        showNotification({
          message: 'Invalid status transition',
          severity: 'error',
          duration: 5000
        });
        return;
      }

      setSyncStatus({ ...syncStatus, status: 'syncing' });

      // Update claim status with OneShield sync
      await updateClaimStatus(claimId, {
        status: newStatus,
        notes: `Status updated to ${newStatus}`
      });

      setSyncStatus({
        status: 'synced',
        lastSynced: new Date()
      });

      showNotification({
        message: 'Claim status updated successfully',
        severity: 'success',
        duration: 3000
      });
    } catch (err) {
      setSyncStatus({
        status: 'error',
        lastSynced: syncStatus.lastSynced,
        error: 'Failed to sync status change'
      });

      showNotification({
        message: 'Error updating claim status',
        severity: 'error',
        duration: 5000
      });
    }
  }, [selectedClaim, claimId, updateClaimStatus, validateStatusTransition, showNotification, syncStatus]);

  /**
   * Renders sync status indicator with accessibility support
   */
  const renderSyncStatus = () => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
      role="status"
      aria-live="polite"
    >
      <Typography
        variant="body2"
        color={syncStatus.status === 'error' ? 'error' : 'textSecondary'}
      >
        {syncStatus.status === 'syncing' && 'Syncing with OneShield...'}
        {syncStatus.status === 'synced' && 'Synced with OneShield'}
        {syncStatus.status === 'error' && 'Sync Error'}
      </Typography>
      {syncStatus.status === 'syncing' && (
        <CircularProgress size={16} />
      )}
    </Box>
  );

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px'
        }}
        role="alert"
        aria-label="Loading claim details"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Container>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          }
        >
          {error.message || 'Error loading claim details'}
        </Alert>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="lg">
        <PageHeader
          title={`Claim #${selectedClaim?.claimNumber || ''}`}
          subtitle={selectedClaim?.description}
          showBreadcrumbs
          actions={renderSyncStatus()}
        />

        {selectedClaim && (
          <ClaimDetails
            claimId={claimId!}
            onStatusChange={handleStatusChange}
            onError={(error: Error) => {
              showNotification({
                message: error.message,
                severity: 'error',
                duration: 5000
              });
            }}
          />
        )}

        <Snackbar
          open={syncStatus.status === 'error'}
          autoHideDuration={6000}
          onClose={() => setSyncStatus({ ...syncStatus, error: undefined })}
        >
          <Alert severity="error" onClose={() => setSyncStatus({ ...syncStatus, error: undefined })}>
            {syncStatus.error}
          </Alert>
        </Snackbar>
      </Container>
    </ErrorBoundary>
  );
};

export default ClaimDetailsPage;