import React, { useCallback, useMemo } from 'react';
import { Box, Typography, Chip, CircularProgress, Alert } from '@mui/material'; // @mui/material@5.14.x
import { GridColDef } from '@mui/x-data-grid'; // @mui/x-data-grid@6.10.x
import { formatCurrency } from '../../utils/format.utils';
import DataGrid from '../common/DataGrid';
import ErrorBoundary from '../common/ErrorBoundary';
import { useClaims } from '../../hooks/useClaims';
import { CLAIM_STATUS_LABELS } from '../../constants/claims.constants';
import type { Claim } from '../../types/claims.types';

interface ClaimsListProps {
  onClaimSelect: (claimId: string) => void;
  filterParams: {
    status: string[];
    dateRange: {
      startDate: string;
      endDate: string;
    };
    searchTerm: string;
  };
  initialSort: {
    sortBy: keyof Claim;
    sortOrder: 'asc' | 'desc';
  };
  pageSize?: number;
}

const ClaimsList: React.FC<ClaimsListProps> = React.memo(({
  onClaimSelect,
  filterParams,
  initialSort,
  pageSize = 25
}) => {
  const {
    claims,
    isLoading,
    error,
    pagination,
    setPagination,
    setSorting,
    fetchClaims
  } = useClaims({
    autoFetch: true,
    pageSize,
    enableRealTimeUpdates: true
  });

  const columns = useGridColumns();

  const handlePageChange = useCallback((params: any) => {
    setPagination({
      ...pagination,
      page: params.page,
      pageSize: params.pageSize
    });
  }, [pagination, setPagination]);

  const handleSortChange = useCallback((sortModel: any) => {
    if (sortModel.length > 0) {
      setSorting({
        sortBy: sortModel[0].field as keyof Claim,
        sortOrder: sortModel[0].sort
      });
    }
  }, [setSorting]);

  const handleRowClick = useCallback((params: any) => {
    onClaimSelect(params.row.id);
  }, [onClaimSelect]);

  if (error) {
    return (
      <Alert 
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Button onClick={() => fetchClaims(filterParams)}>
            Retry
          </Button>
        }
      >
        Failed to load claims: {error.message}
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <Box
        sx={{
          height: '100%',
          width: '100%',
          '& .status-chip': {
            borderRadius: '16px',
            minWidth: '100px',
            justifyContent: 'center'
          },
          '& .high-priority': {
            backgroundColor: (theme) => theme.palette.error.light,
            color: (theme) => theme.palette.error.contrastText
          }
        }}
      >
        <DataGrid
          rows={claims}
          columns={columns}
          loading={isLoading}
          totalRows={pagination.total}
          paginationParams={{
            page: pagination.page,
            limit: pagination.pageSize,
            sortBy: initialSort.sortBy,
            sortOrder: initialSort.sortOrder
          }}
          onPaginationChange={handlePageChange}
          onSortModelChange={handleSortChange}
          onRowClick={handleRowClick}
          defaultPageSize={pageSize}
          ariaLabel="Claims list"
          disableColumnMenu={false}
          checkboxSelection={false}
          disableSelectionOnClick
          autoHeight
        />
      </Box>
    </ErrorBoundary>
  );
});

const useGridColumns = (): GridColDef[] => {
  return useMemo(() => [
    {
      field: 'claimNumber',
      headerName: 'Claim #',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="body2" component="span">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Chip
          label={CLAIM_STATUS_LABELS[params.value]}
          className={`status-chip ${params.row.priorityLevel === 'HIGH' ? 'high-priority' : ''}`}
          size="small"
        />
      ),
      sortable: true
    },
    {
      field: 'incidentDate',
      headerName: 'Incident Date',
      flex: 1,
      minWidth: 150,
      type: 'date',
      valueFormatter: ({ value }) => new Date(value).toLocaleDateString(),
      sortable: true
    },
    {
      field: 'claimantInfo',
      headerName: 'Claimant',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2">
          {`${params.value.firstName} ${params.value.lastName}`}
        </Typography>
      ),
      sortable: true
    },
    {
      field: 'reserveAmount',
      headerName: 'Reserve',
      flex: 1,
      minWidth: 150,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value),
      sortable: true
    },
    {
      field: 'paidAmount',
      headerName: 'Paid',
      flex: 1,
      minWidth: 150,
      type: 'number',
      valueFormatter: ({ value }) => formatCurrency(value),
      sortable: true
    },
    {
      field: 'lastActivityDate',
      headerName: 'Last Activity',
      flex: 1,
      minWidth: 150,
      type: 'date',
      valueFormatter: ({ value }) => new Date(value).toLocaleDateString(),
      sortable: true
    }
  ], []);
};

export default ClaimsList;