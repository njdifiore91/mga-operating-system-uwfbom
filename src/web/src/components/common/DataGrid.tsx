import React, { useCallback, useMemo, useState } from 'react';
import { DataGrid as MuiDataGrid, GridColDef, GridFilterModel, GridSortModel } from '@mui/x-data-grid'; // @mui/x-data-grid@6.10.x
import { Box } from '@mui/material'; // @mui/material@5.14.x
import { PaginationParams } from '../../types/common.types';
import LoadingSpinner from './LoadingSpinner';
import { formatCurrency } from '../../utils/format.utils';

/**
 * Props interface for the DataGrid component
 */
interface DataGridProps {
  /** Data rows to display in the grid */
  rows: Record<string, any>[];
  /** Column definitions for the grid */
  columns: GridColDef[];
  /** Loading state indicator */
  loading?: boolean;
  /** Total number of rows (for server-side pagination) */
  totalRows: number;
  /** Current pagination parameters */
  paginationParams: PaginationParams;
  /** Callback for pagination changes */
  onPaginationChange: (params: PaginationParams) => void;
  /** Callback for filter changes */
  onFilterChange?: (field: string, value: any) => void;
  /** Current filter model */
  filterModel?: Record<string, any>;
  /** Disable sorting functionality */
  disableSortBy?: boolean;
  /** Disable filtering functionality */
  disableFilters?: boolean;
  /** Default page size */
  defaultPageSize?: number;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * A reusable data grid component that provides advanced data table functionality
 * with sorting, filtering, pagination, and customizable column rendering.
 * Implements Material Design guidelines and ensures WCAG 2.1 Level AA compliance.
 */
const DataGrid: React.FC<DataGridProps> = ({
  rows,
  columns,
  loading = false,
  totalRows,
  paginationParams,
  onPaginationChange,
  onFilterChange,
  filterModel = {},
  disableSortBy = false,
  disableFilters = false,
  defaultPageSize = 25,
  ariaLabel = 'Data grid'
}) => {
  // Memoize the processed columns to prevent unnecessary re-renders
  const processedColumns = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      // Add default formatting for currency fields
      valueFormatter: column.type === 'currency' 
        ? ({ value }) => formatCurrency(value)
        : column.valueFormatter,
      // Ensure consistent header styling
      headerClassName: 'data-grid-header',
      // Add sorting and filtering configurations
      sortable: !disableSortBy && column.sortable !== false,
      filterable: !disableFilters && column.filterable !== false,
      // Ensure minimum width for better readability
      minWidth: column.minWidth || 100,
      // Add flex grow for responsive layout
      flex: column.flex || 1,
    }));
  }, [columns, disableSortBy, disableFilters]);

  // Handle page changes with validation
  const handlePageChange = useCallback((page: number, pageSize: number) => {
    if (page < 0 || pageSize < 1) return;

    onPaginationChange({
      ...paginationParams,
      page,
      limit: pageSize
    });
  }, [paginationParams, onPaginationChange]);

  // Handle sorting changes
  const handleSortModelChange = useCallback((sortModel: GridSortModel) => {
    const [sort] = sortModel;
    if (!sort) return;

    onPaginationChange({
      ...paginationParams,
      sortBy: sort.field,
      sortOrder: sort.sort || 'asc'
    });
  }, [paginationParams, onPaginationChange]);

  // Handle filter changes
  const handleFilterModelChange = useCallback((model: GridFilterModel) => {
    if (!onFilterChange) return;
    
    const filters = model.items.reduce((acc, filter) => {
      if (filter.field && filter.value !== undefined) {
        acc[filter.field] = filter.value;
      }
      return acc;
    }, {} as Record<string, any>);

    Object.entries(filters).forEach(([field, value]) => {
      onFilterChange(field, value);
    });
  }, [onFilterChange]);

  // Calculate row count for virtual scrolling
  const rowCount = useMemo(() => totalRows || rows.length, [totalRows, rows.length]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        '& .data-grid-header': {
          backgroundColor: (theme) => theme.palette.background.default,
          fontWeight: 'bold',
        },
        '& .MuiDataGrid-row:hover': {
          backgroundColor: (theme) => theme.palette.action.hover,
        },
        // Ensure proper focus visibility for accessibility
        '& .MuiDataGrid-cell:focus-within': {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '-2px',
        },
      }}
    >
      <MuiDataGrid
        rows={rows}
        columns={processedColumns}
        rowCount={rowCount}
        loading={loading}
        pagination
        paginationMode="server"
        page={paginationParams.page}
        pageSize={paginationParams.limit}
        rowsPerPageOptions={[10, 25, 50, 100]}
        onPageChange={(page) => handlePageChange(page, paginationParams.limit)}
        onPageSizeChange={(pageSize) => handlePageChange(paginationParams.page, pageSize)}
        sortingMode="server"
        onSortModelChange={handleSortModelChange}
        filterMode="server"
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        disableColumnFilter={disableFilters}
        disableColumnSort={disableSortBy}
        components={{
          LoadingOverlay: LoadingSpinner
        }}
        componentsProps={{
          loadingOverlay: {
            size: 40,
            color: 'primary.main'
          }
        }}
        // Accessibility properties
        aria-label={ariaLabel}
        getRowId={(row) => row.id || row._id}
        // Performance optimizations
        density="standard"
        disableColumnMenu={false}
        disableSelectionOnClick
        keepNonExistentRowsSelected
        // Responsive settings
        autoHeight
        sx={{
          // Ensure proper border contrast for accessibility
          '& .MuiDataGrid-cell, & .MuiDataGrid-columnHeader': {
            borderColor: (theme) => theme.palette.divider,
          },
          // Responsive font sizes
          fontSize: {
            xs: '0.875rem',
            sm: '1rem'
          },
        }}
      />
    </Box>
  );
};

export default DataGrid;