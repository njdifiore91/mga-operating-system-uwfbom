import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Divider,
  Skeleton,
  Box,
  useTheme
} from '@mui/material';
import { formatCurrency, formatDate } from '@mui/x-data-grid';
import { IPolicy, PolicyType, PolicyStatus } from '../../types/policy.types';
import PolicyService from '../../services/policy.service';
import PolicyTimeline from './PolicyTimeline';
import StatusBadge from '../common/StatusBadge';

// Interface for component props
interface PolicyDetailsProps {
  policyId: string;
  onUpdate?: (policy: IPolicy) => void;
  className?: string;
  refreshInterval?: number;
  showActions?: boolean;
}

// Custom hook for managing policy details state
const usePolicyDetails = (policyId: string, refreshInterval?: number) => {
  const [policy, setPolicy] = useState<IPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPolicyDetails = useCallback(async () => {
    try {
      const policyData = await PolicyService.fetchPolicyDetails(policyId);
      setPolicy(policyData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    fetchPolicyDetails();

    if (refreshInterval) {
      const intervalId = setInterval(fetchPolicyDetails, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchPolicyDetails, refreshInterval]);

  const updatePolicy = useCallback(async (updates: Partial<IPolicy>) => {
    try {
      const updatedPolicy = await PolicyService.updatePolicyDetails(policyId, updates);
      setPolicy(updatedPolicy);
      return updatedPolicy;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [policyId]);

  return { policy, loading, error, updatePolicy, refreshData: fetchPolicyDetails };
};

/**
 * PolicyDetails Component
 * Displays comprehensive policy information with real-time updates and interactive elements
 */
const PolicyDetails: React.FC<PolicyDetailsProps> = ({
  policyId,
  onUpdate,
  className,
  refreshInterval,
  showActions = true
}) => {
  const theme = useTheme();
  const { policy, loading, error, updatePolicy, refreshData } = usePolicyDetails(
    policyId,
    refreshInterval
  );

  // Memoized computed values
  const totalPremium = useMemo(() => {
    if (!policy) return 0;
    return policy.coverages.reduce((sum, coverage) => sum + coverage.premium, 0);
  }, [policy]);

  const canBindPolicy = useMemo(() => {
    return policy?.status === PolicyStatus.APPROVED;
  }, [policy?.status]);

  // Event handlers
  const handleBindPolicy = async () => {
    try {
      const boundPolicy = await PolicyService.bindApprovedPolicy(policyId);
      onUpdate?.(boundPolicy);
      refreshData();
    } catch (err) {
      console.error('Error binding policy:', err);
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent>
          <Typography color="error" role="alert">
            Error loading policy details: {error.message}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (loading || !policy) {
    return (
      <Card className={className}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Skeleton variant="rectangular" height={48} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent>
        {/* Policy Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3
          }}
        >
          <Box>
            <Typography variant="h5" component="h1" gutterBottom>
              Policy #{policy.policyNumber}
            </Typography>
            <StatusBadge
              statusType="policy"
              status={policy.status}
              size="medium"
            />
          </Box>
          {showActions && canBindPolicy && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleBindPolicy}
              aria-label="Bind Policy"
            >
              Bind Policy
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Policy Details Grid */}
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography color="textSecondary">Policy Type</Typography>
                <Typography>{PolicyType[policy.type]}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Total Premium</Typography>
                <Typography>{formatCurrency(totalPremium, 'USD')}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Effective Date</Typography>
                <Typography>{formatDate(new Date(policy.effectiveDate))}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary">Expiration Date</Typography>
                <Typography>{formatDate(new Date(policy.expirationDate))}</Typography>
              </Grid>
            </Grid>
          </Grid>

          {/* Coverages */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Coverages
            </Typography>
            {policy.coverages.map((coverage, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Typography variant="subtitle2">{coverage.type}</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography color="textSecondary">Limit</Typography>
                    <Typography>{formatCurrency(coverage.limit, 'USD')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography color="textSecondary">Premium</Typography>
                    <Typography>{formatCurrency(coverage.premium, 'USD')}</Typography>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Grid>

          {/* Underwriting Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Underwriting Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary">Risk Score</Typography>
                <Typography>{policy.underwritingInfo.riskScore}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary">Reviewed By</Typography>
                <Typography>{policy.underwritingInfo.reviewedBy}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography color="textSecondary">Review Date</Typography>
                <Typography>
                  {formatDate(new Date(policy.underwritingInfo.reviewDate))}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography color="textSecondary">Notes</Typography>
                <Typography>{policy.underwritingInfo.underwriterNotes}</Typography>
              </Grid>
            </Grid>
          </Grid>

          {/* Policy Timeline */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Policy Timeline
            </Typography>
            <PolicyTimeline policy={policy} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default PolicyDetails;