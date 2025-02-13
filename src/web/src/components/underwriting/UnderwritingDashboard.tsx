import React, { useState, useCallback, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import RiskScoreWidget from '../analytics/RiskScoreWidget';
import { useUnderwriting } from '../../hooks/useUnderwriting';
import StatusBadge from '../common/StatusBadge';
import { 
  UNDERWRITING_STATUS,
  RISK_SEVERITY,
  UNDERWRITING_QUEUE_COLUMNS 
} from '../../constants/underwriting.constants';
import { UnderwritingStatus, RiskSeverity } from '../../types/underwriting.types';

// Initial filters for the underwriting queue
const initialFilters = {
  status: null,
  severity: null,
  dateRange: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString()
  }
};

/**
 * Enhanced UnderwritingDashboard component with real-time updates and automated workflows
 * @returns JSX.Element Dashboard component with comprehensive underwriting features
 */
const UnderwritingDashboard: React.FC = React.memo(() => {
  const theme = useTheme();
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    title: string;
    message: string;
  }>({
    open: false,
    action: '',
    title: '',
    message: ''
  });

  // Initialize underwriting hook with real-time updates
  const {
    riskAssessment,
    queue,
    isLoading,
    error,
    submitForUnderwriting,
    makeDecision,
    updateFilters,
    pagination
  } = useUnderwriting(initialFilters);

  // Generate queue columns with enhanced functionality
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'policyId',
      headerName: UNDERWRITING_QUEUE_COLUMNS.POLICY_ID.label,
      width: UNDERWRITING_QUEUE_COLUMNS.POLICY_ID.width,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title="View Policy Details">
          <Button
            variant="text"
            size="small"
            onClick={() => window.location.href = `/policies/${params.value}`}
          >
            {params.value}
          </Button>
        </Tooltip>
      )
    },
    {
      field: 'policyType',
      headerName: UNDERWRITING_QUEUE_COLUMNS.POLICY_TYPE.label,
      width: UNDERWRITING_QUEUE_COLUMNS.POLICY_TYPE.width,
      valueFormatter: ({ value }) => value.replace(/_/g, ' ')
    },
    {
      field: 'status',
      headerName: UNDERWRITING_QUEUE_COLUMNS.STATUS.label,
      width: UNDERWRITING_QUEUE_COLUMNS.STATUS.width,
      renderCell: (params: GridRenderCellParams) => (
        <StatusBadge
          statusType="underwriting"
          status={params.value}
          aria-label={`Status: ${params.value}`}
        />
      )
    },
    {
      field: 'riskScore',
      headerName: UNDERWRITING_QUEUE_COLUMNS.RISK_SCORE.label,
      width: UNDERWRITING_QUEUE_COLUMNS.RISK_SCORE.width,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => (
        <Box
          sx={{
            color: params.value >= RISK_SEVERITY.HIGH.threshold
              ? theme.palette.error.main
              : params.value >= RISK_SEVERITY.MEDIUM.threshold
                ? theme.palette.warning.main
                : theme.palette.success.main
          }}
        >
          {params.value}
        </Box>
      )
    },
    {
      field: 'severity',
      headerName: UNDERWRITING_QUEUE_COLUMNS.SEVERITY.label,
      width: UNDERWRITING_QUEUE_COLUMNS.SEVERITY.width,
      renderCell: (params: GridRenderCellParams) => (
        <StatusBadge
          statusType="underwriting"
          status={params.value}
          label={RISK_SEVERITY[params.value as keyof typeof RISK_SEVERITY].label}
        />
      )
    },
    {
      field: 'submissionDate',
      headerName: UNDERWRITING_QUEUE_COLUMNS.SUBMISSION_DATE.label,
      width: UNDERWRITING_QUEUE_COLUMNS.SUBMISSION_DATE.width,
      type: 'dateTime',
      valueFormatter: ({ value }) => new Date(value).toLocaleString()
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Approve Policy">
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={() => handleAction(params.row.policyId, 'APPROVE')}
              disabled={params.row.status !== UnderwritingStatus.PENDING_REVIEW}
            >
              Approve
            </Button>
          </Tooltip>
          <Tooltip title="Decline Policy">
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={() => handleAction(params.row.policyId, 'DECLINE')}
              disabled={params.row.status !== UnderwritingStatus.PENDING_REVIEW}
            >
              Decline
            </Button>
          </Tooltip>
        </Box>
      )
    }
  ], [theme]);

  // Handle individual and bulk actions
  const handleAction = useCallback((policyId: string, action: string) => {
    setConfirmDialog({
      open: true,
      action,
      title: `Confirm ${action}`,
      message: `Are you sure you want to ${action.toLowerCase()} the selected ${
        selectedRows.length > 1 ? 'policies' : 'policy'
      }?`
    });
  }, [selectedRows]);

  // Process confirmed action
  const handleConfirmAction = useCallback(async () => {
    try {
      const decision = confirmDialog.action === 'APPROVE'
        ? UnderwritingStatus.APPROVED
        : UnderwritingStatus.DECLINED;

      await makeDecision({
        policyId: selectedRows[0],
        decision,
        notes: `Bulk ${confirmDialog.action.toLowerCase()} action`,
        conditions: []
      });

      setSelectedRows([]);
      setConfirmDialog({ ...confirmDialog, open: false });
    } catch (error) {
      console.error('Action processing failed:', error);
    }
  }, [confirmDialog, selectedRows, makeDecision]);

  return (
    <Grid container spacing={3}>
      {/* Metrics Section */}
      <Grid item xs={12} md={4}>
        <RiskScoreWidget
          dateRange={initialFilters.dateRange}
          refreshInterval={30000}
        />
      </Grid>

      {/* Queue Section */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" component="h2">
                Underwriting Queue
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {selectedRows.length > 0 && (
                  <>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => handleAction(selectedRows[0], 'APPROVE')}
                    >
                      Approve Selected
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => handleAction(selectedRows[0], 'DECLINE')}
                    >
                      Decline Selected
                    </Button>
                  </>
                )}
              </Box>
            </Box>

            <DataGrid
              rows={queue?.items || []}
              columns={columns}
              loading={isLoading}
              error={error}
              checkboxSelection
              disableRowSelectionOnClick
              onRowSelectionModelChange={(newSelection) => {
                setSelectedRows(newSelection as string[]);
              }}
              rowSelectionModel={selectedRows}
              paginationMode="server"
              rowCount={queue?.totalCount || 0}
              page={pagination.cursor?.page || 0}
              pageSize={10}
              onPageChange={(page) => pagination.handlePagination({ page })}
              autoHeight
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: 'none'
                }
              }}
              aria-label="Underwriting queue"
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        aria-labelledby="confirm-dialog-title"
      >
        <DialogTitle id="confirm-dialog-title">{confirmDialog.title}</DialogTitle>
        <DialogContent>{confirmDialog.message}</DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmDialog.action === 'APPROVE' ? 'success' : 'error'}
            variant="contained"
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
});

UnderwritingDashboard.displayName = 'UnderwritingDashboard';

export default UnderwritingDashboard;