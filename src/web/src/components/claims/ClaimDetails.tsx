import React, { useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Box,
  Skeleton
} from '@mui/material'; // v5.14.x
import { useAuditLogger } from '@mga-os/audit'; // v1.0.x
import { SecurityWrapper } from '@mga-os/security'; // v1.0.x

import { CLAIM_STATUS, CLAIM_STATUS_LABELS } from '../../constants/claims.constants';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for the ClaimDetails component
 */
interface ClaimDetailsProps {
  claimId: string;
  onStatusChange?: (newStatus: keyof typeof CLAIM_STATUS) => void;
  securityLevel: SecurityClassification;
  auditContext: AuditContext;
}

/**
 * Formats monetary amounts with proper currency symbol and security masking
 */
const formatClaimAmount = (amount: number, securityLevel: SecurityClassification): string => {
  if (securityLevel < SecurityClassification.CONFIDENTIAL) {
    return '***';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Enhanced component that displays detailed information about a specific claim
 * with security, accessibility, and real-time features
 */
const ClaimDetails: React.FC<ClaimDetailsProps> = ({
  claimId,
  onStatusChange,
  securityLevel,
  auditContext
}) => {
  const { logAuditEvent } = useAuditLogger();

  // Memoized claim data fetching
  const { claim, loading, error } = useClaims(claimId);

  // Handle status change with audit logging and OneShield sync
  const handleStatusChange = useCallback(async (newStatus: keyof typeof CLAIM_STATUS) => {
    try {
      logAuditEvent({
        action: 'CLAIM_STATUS_CHANGE_ATTEMPT',
        context: {
          claimId,
          oldStatus: claim?.status,
          newStatus,
          ...auditContext
        }
      });

      // Optimistic update
      if (onStatusChange) {
        onStatusChange(newStatus);
      }

      // Sync with OneShield
      await updateClaimStatus(claimId, newStatus);

      logAuditEvent({
        action: 'CLAIM_STATUS_CHANGE_SUCCESS',
        context: {
          claimId,
          newStatus,
          ...auditContext
        }
      });
    } catch (error) {
      logAuditEvent({
        action: 'CLAIM_STATUS_CHANGE_FAILURE',
        context: {
          claimId,
          error,
          ...auditContext
        }
      });

      // Rollback optimistic update
      if (onStatusChange && claim) {
        onStatusChange(claim.status);
      }
    }
  }, [claimId, claim, onStatusChange, logAuditEvent, auditContext]);

  // Render claimant information with security controls
  const renderClaimantInfo = useMemo(() => {
    if (!claim?.claimantInfo) return null;

    return (
      <SecurityWrapper minSecurityLevel={SecurityClassification.CONFIDENTIAL}>
        <Card elevation={0} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Claimant Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Name
                </Typography>
                <Typography>
                  {`${claim.claimantInfo.firstName} ${claim.claimantInfo.lastName}`}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Contact
                </Typography>
                <Typography>
                  {claim.claimantInfo.email}
                </Typography>
                <Typography>
                  {claim.claimantInfo.phone}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </SecurityWrapper>
    );
  }, [claim?.claimantInfo]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="text" sx={{ mt: 2 }} />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
      </Box>
    );
  }

  if (error || !claim) {
    return (
      <ErrorBoundary>
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            color: 'error.main'
          }}
          role="alert"
        >
          <Typography variant="h6">
            Error loading claim details
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </Box>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ p: 2 }} role="main" aria-label="Claim Details">
        <Grid container spacing={3}>
          {/* Header Section */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Grid container justifyContent="space-between" alignItems="center">
                  <Grid item>
                    <Typography variant="h5" component="h1">
                      Claim #{claim.claimNumber}
                    </Typography>
                    <Typography color="textSecondary">
                      Status: {CLAIM_STATUS_LABELS[claim.status as keyof typeof CLAIM_STATUS]}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <SecurityWrapper minSecurityLevel={SecurityClassification.CONFIDENTIAL}>
                      <Typography variant="h6">
                        Total Incurred: {formatClaimAmount(claim.totalIncurred, securityLevel)}
                      </Typography>
                    </SecurityWrapper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Claimant Information */}
          <Grid item xs={12} md={6}>
            {renderClaimantInfo}
          </Grid>

          {/* Financial Information */}
          <Grid item xs={12} md={6}>
            <SecurityWrapper minSecurityLevel={SecurityClassification.RESTRICTED}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Financial Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Reserve Amount
                      </Typography>
                      <Typography>
                        {formatClaimAmount(claim.reserveAmount, securityLevel)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Paid Amount
                      </Typography>
                      <Typography>
                        {formatClaimAmount(claim.paidAmount, securityLevel)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </SecurityWrapper>
          </Grid>

          {/* Status Actions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {CLAIM_STATUS_TRANSITIONS[claim.status as keyof typeof CLAIM_STATUS].map((status: keyof typeof CLAIM_STATUS) => (
                    <Button
                      key={status}
                      variant="contained"
                      onClick={() => handleStatusChange(status)}
                      aria-label={`Change status to ${CLAIM_STATUS_LABELS[status]}`}
                    >
                      {CLAIM_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
};

export default ClaimDetails;