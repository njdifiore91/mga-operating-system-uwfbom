import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Alert, useTheme } from '@mui/material'; // @mui/material@5.14.x
import { useTranslation } from 'react-i18next'; // react-i18next@13.x.x
import { IPolicy, PolicyStatus, PolicyType } from '../../types/policy.types';
import DataGrid from '../common/DataGrid';
import LoadingSpinner from '../common/LoadingSpinner';
import usePolicies from '../../hooks/usePolicies';
import { formatCurrency } from '../../utils/format.utils';

/**
 * Props interface for PolicyList component with comprehensive configuration options
 */
interface PolicyListProps {
  onPolicySelect?: (policy: IPolicy) => void;
  filterOptions?: {
    type?: PolicyType;
    status?: PolicyStatus;
    searchTerm?: string;
  };
  pageSize?: number;
  initialSort?: {
    field: keyof IPolicy;
    direction: 'asc' | 'desc';
  };
  refreshInterval?: number;
}

/**
 * A production-ready policy list component that displays a paginated, sortable,
 * and filterable list of insurance policies using Material UI's DataGrid.
 * Implements real-time updates, comprehensive error handling, and accessibility features.
 */
const PolicyList: React.FC<PolicyListProps> = memo(({
  onPolicySelect,
  filterOptions = {},
  pageSize = 25,
  initialSort = { field: 'updatedAt', direction: 'desc' },
  refreshInterval = 30000
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  // Initialize policy management hook with filters
  const {
    policies,
    loading,
    error,
    totalPolicies,
    fetchPolicies,
    refreshPolicies
  } = usePolicies({
    autoFetch: true,
    page,
    limit: pageSize,
    ...filterOptions
  });

  // Set up automatic refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(refreshPolicies, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, refreshPolicies]);

  // Configure grid columns with responsive breakpoints
  const columns = useMemo(() => [
    {
      field: 'policyNumber',
      headerName: t('policy.fields.policyNumber'),
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box component="span" sx={{ fontWeight: 'medium' }}>
          {params.value}
        </Box>
      )
    },
    {
      field: 'type',
      headerName: t('policy.fields.type'),
      flex: 1,
      minWidth: 180,
      valueFormatter: ({ value }) => t(`policy.types.${value.toLowerCase()}`)
    },
    {
      field: 'status',
      headerName: t('policy.fields.status'),
      flex: 1,
      minWidth: 140,
      renderCell: (params) => (
        <Box
          component="span"
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: theme.palette[getStatusColor(params.value)].light,
            color: theme.palette[getStatusColor(params.value)].dark
          }}
        >
          {t(`policy.status.${params.value.toLowerCase()}`)}
        </Box>
      )
    },
    {
      field: 'premium',
      headerName: t('policy.fields.premium'),
      flex: 1,
      minWidth: 120,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value)
    },
    {
      field: 'effectiveDate',
      headerName: t('policy.fields.effectiveDate'),
      flex: 1,
      minWidth: 150,
      type: 'date',
      valueFormatter: ({ value }) => new Date(value).toLocaleDateString()
    },
    {
      field: 'expirationDate',
      headerName: t('policy.fields.expirationDate'),
      flex: 1,
      minWidth: 150,
      type: 'date',
      valueFormatter: ({ value }) => new Date(value).toLocaleDateString()
    }
  ], [t, theme]);

  // Handle pagination changes with validation
  const handlePaginationChange = useCallback((params: { page: number; pageSize: number }) => {
    setPage(params.page);
  }, []);

  // Handle row selection
  const handleRowClick = useCallback((params) => {
    if (onPolicySelect) {
      onPolicySelect(params.row);
    }
  }, [onPolicySelect]);

  // Helper function for status colors
  const getStatusColor = (status: PolicyStatus): 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case PolicyStatus.ACTIVE:
      case PolicyStatus.BOUND:
        return 'success';
      case PolicyStatus.IN_REVIEW:
      case PolicyStatus.SUBMITTED:
        return 'warning';
      case PolicyStatus.CANCELLED:
      case PolicyStatus.EXPIRED:
        return 'error';
      default:
        return 'info';
    }
  };

  // Render error state if present
  if (error) {
    return (
      <Alert 
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Box onClick={() => fetchPolicies()} sx={{ cursor: 'pointer' }}>
            {t('common.retry')}
          </Box>
        }
      >
        {t('policy.errors.loadFailed')}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        '& .policy-grid': {
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          overflow: 'hidden'
        }
      }}
    >
      <DataGrid
        rows={policies}
        columns={columns}
        loading={loading}
        totalRows={totalPolicies}
        paginationParams={{
          page,
          limit: pageSize,
          sortBy: initialSort.field,
          sortOrder: initialSort.direction
        }}
        onPaginationChange={handlePaginationChange}
        onRowClick={handleRowClick}
        defaultPageSize={pageSize}
        ariaLabel={t('policy.grid.ariaLabel')}
        className="policy-grid"
        disableSelectionOnClick
        filterModel={filterOptions}
      />
      {loading && <LoadingSpinner />}
    </Box>
  );
});

PolicyList.displayName = 'PolicyList';

export default PolicyList;