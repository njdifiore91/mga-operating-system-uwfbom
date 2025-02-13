import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Typography,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material'; // @mui/material@5.14.x
import DataGrid from '../common/DataGrid';
import { useUnderwriting } from '../../hooks/useUnderwriting';
import {
  IUnderwritingQueueItem,
  UnderwritingStatus,
  RiskSeverity
} from '../../types/underwriting.types';
import { RISK_SEVERITY, UNDERWRITING_QUEUE_COLUMNS } from '../../constants/underwriting.constants';

interface UnderwritingQueueProps {
  onPolicySelect: (policyId: string) => void;
  filters?: Record<string, any>;
  refreshInterval?: number;
  batchSize?: number;
  errorRetryCount?: number;
  virtualScrollConfig?: {
    rowHeight: number;
    overscanCount: number;
  };
}

const UnderwritingQueue: React.FC<UnderwritingQueueProps> = ({
  onPolicySelect,
  filters = {},
  refreshInterval = 30000,
  batchSize = 25,
  errorRetryCount = 3,
  virtualScrollConfig = { rowHeight: 52, overscanCount: 5 }
}) => {
  // State management with useUnderwriting hook
  const {
    queue,
    isLoading,
    isError,
    error,
    updateFilters,
    makeDecision,
    pagination,
    realTimeUpdates
  } = useUnderwriting(filters);

  // Local state for selected policies and error handling
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  // Set up real-time updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isLoading && realTimeUpdates.isConnected) {
        updateFilters(filters);
      }
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [filters, refreshInterval, isLoading, realTimeUpdates.isConnected, updateFilters]);

  // Handle retry logic for errors
  useEffect(() => {
    if (isError && retryCount < errorRetryCount) {
      const timeoutId = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        updateFilters(filters);
      }, 1000 * Math.pow(2, retryCount));

      return () => clearTimeout(timeoutId);
    }
  }, [isError, retryCount, errorRetryCount, filters, updateFilters]);

  // Memoized column definitions with custom renderers
  const columns = useMemo(() => [
    {
      ...UNDERWRITING_QUEUE_COLUMNS.POLICY_ID,
      renderCell: (params: { row: IUnderwritingQueueItem }) => (
        <Button
          variant="text"
          onClick={() => onPolicySelect(params.row.policyId)}
          sx={{ textTransform: 'none' }}
        >
          {params.row.policyId}
        </Button>
      )
    },
    {
      ...UNDERWRITING_QUEUE_COLUMNS.STATUS,
      renderCell: (params: { row: IUnderwritingQueueItem }) => (
        <Chip
          label={params.row.status}
          color={getStatusColor(params.row.status)}
          size="small"
        />
      )
    },
    {
      ...UNDERWRITING_QUEUE_COLUMNS.RISK_SCORE,
      renderCell: (params: { row: IUnderwritingQueueItem }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress
            variant="determinate"
            value={params.row.riskScore}
            size={24}
            sx={{
              color: RISK_SEVERITY[params.row.severity].color,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Typography variant="body2">
            {params.row.riskScore}
          </Typography>
        </Box>
      )
    },
    {
      ...UNDERWRITING_QUEUE_COLUMNS.SEVERITY,
      renderCell: (params: { row: IUnderwritingQueueItem }) => (
        <Tooltip title={RISK_SEVERITY[params.row.severity].label}>
          <Chip
            label={params.row.severity}
            size="small"
            sx={{
              backgroundColor: RISK_SEVERITY[params.row.severity].color,
              color: '#fff'
            }}
          />
        </Tooltip>
      )
    },
    UNDERWRITING_QUEUE_COLUMNS.POLICY_TYPE,
    UNDERWRITING_QUEUE_COLUMNS.SUBMISSION_DATE,
    UNDERWRITING_QUEUE_COLUMNS.ASSIGNED_TO,
  ], [onPolicySelect]);

  // Handle filter changes
  const handleFilterChange = useCallback((field: string, value: any) => {
    updateFilters({ ...filters, [field]: value });
  }, [filters, updateFilters]);

  // Handle decision actions
  const handleDecision = useCallback(async (policyId: string, decision: UnderwritingStatus) => {
    try {
      await makeDecision({ policyId, decision, notes: '', conditions: [] });
      setSelectedPolicies([]);
    } catch (err) {
      console.error('Decision processing failed:', err);
    }
  }, [makeDecision]);

  if (isError && retryCount >= errorRetryCount) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load underwriting queue. Please try again later.
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <DataGrid
        rows={queue?.items || []}
        columns={columns}
        loading={isLoading}
        totalRows={queue?.totalCount || 0}
        paginationParams={pagination}
        onPaginationChange={pagination.handlePagination}
        onFilterChange={handleFilterChange}
        filterModel={filters}
        defaultPageSize={batchSize}
        ariaLabel="Underwriting Queue"
        disableSortBy={false}
        disableFilters={false}
      />
    </Box>
  );
};

// Utility function to determine status chip color
const getStatusColor = (status: UnderwritingStatus): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  switch (status) {
    case UnderwritingStatus.APPROVED:
      return 'success';
    case UnderwritingStatus.DECLINED:
      return 'error';
    case UnderwritingStatus.IN_REVIEW:
      return 'primary';
    case UnderwritingStatus.MANUAL_REVIEW:
      return 'warning';
    case UnderwritingStatus.AUTO_APPROVED:
      return 'success';
    case UnderwritingStatus.PENDING_REVIEW:
      return 'info';
    default:
      return 'default';
  }
};

export default UnderwritingQueue;