import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Grid,
  Paper,
  Box,
  Typography,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro';
import { useWebSocket } from 'react-use-websocket';
import MetricsCard from './MetricsCard';
import PerformanceChart from './PerformanceChart';
import {
  PolicyMetrics,
  UnderwritingMetrics,
  ComplianceMetrics,
  DashboardMetrics,
  MetricTrend,
  ChartType
} from '../../types/analytics.types';
import { DateRange } from '../../types/common.types';

// WebSocket endpoint for real-time updates
const WS_ENDPOINT = `${process.env.REACT_APP_WS_BASE_URL}/analytics/metrics`;

interface AnalyticsDashboardProps {
  className?: string;
  style?: React.CSSProperties;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className,
  style,
  refreshInterval = 30000,
  onError
}) => {
  // Theme and responsive breakpoints
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString()
  });

  // WebSocket connection for real-time updates
  const { lastMessage, readyState } = useWebSocket(WS_ENDPOINT, {
    shouldReconnect: () => true,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
    share: true
  });

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const updatedMetrics = JSON.parse(lastMessage.data);
        setMetrics(prevMetrics => ({
          ...prevMetrics,
          ...updatedMetrics,
          lastUpdated: new Date(),
          isRealTime: true
        }));
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
        onError?.(err as Error);
      }
    }
  }, [lastMessage, onError]);

  // Initial data fetch and refresh interval
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/analytics/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [dateRange, refreshInterval, onError]);

  // Memoized grid layout configuration
  const gridLayout = useMemo(() => ({
    xs: 12,
    sm: 6,
    md: 4,
    lg: 3,
    spacing: { xs: 2, md: 3 }
  }), []);

  // Render loading state
  if (loading && !metrics) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
        role="progressbar"
        aria-label="Loading dashboard metrics"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box
        component={Paper}
        p={3}
        bgcolor="error.light"
        color="error.main"
        role="alert"
      >
        <Typography variant="h6">Error Loading Dashboard</Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Box>
    );
  }

  return (
    <Box className={className} style={style}>
      {/* Dashboard Header */}
      <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom={isMobile}>
          Analytics Dashboard
        </Typography>
        <DateRangePicker
          value={[new Date(dateRange.startDate), new Date(dateRange.endDate)]}
          onChange={(newValue) => {
            if (newValue[0] && newValue[1]) {
              setDateRange({
                startDate: newValue[0].toISOString(),
                endDate: newValue[1].toISOString()
              });
            }
          }}
          slotProps={{
            textField: { size: 'small' },
            actionBar: { actions: ['clear', 'cancel', 'accept'] }
          }}
        />
      </Box>

      {/* Metrics Grid */}
      <Grid container spacing={gridLayout.spacing} mb={4}>
        {/* Policy Metrics */}
        <Grid item xs={gridLayout.xs} sm={gridLayout.sm} md={gridLayout.md} lg={gridLayout.lg}>
          <MetricsCard
            title="Total Policies"
            value={metrics?.policyMetrics.totalPolicies || 0}
            format="number"
            trend={{ trend: 'up', change: 5.2 }}
            loading={loading}
          />
        </Grid>
        <Grid item xs={gridLayout.xs} sm={gridLayout.sm} md={gridLayout.md} lg={gridLayout.lg}>
          <MetricsCard
            title="Total Premium"
            value={metrics?.policyMetrics.totalPremium || 0}
            format="currency"
            trend={{ trend: 'up', change: 12.8 }}
            loading={loading}
          />
        </Grid>

        {/* Underwriting Metrics */}
        <Grid item xs={gridLayout.xs} sm={gridLayout.sm} md={gridLayout.md} lg={gridLayout.lg}>
          <MetricsCard
            title="Automation Rate"
            value={metrics?.underwritingMetrics.automationRate || 0}
            format="percentage"
            trend={{ trend: 'up', change: 8.5 }}
            loading={loading}
          />
        </Grid>
        <Grid item xs={gridLayout.xs} sm={gridLayout.sm} md={gridLayout.md} lg={gridLayout.lg}>
          <MetricsCard
            title="Pending Reviews"
            value={metrics?.underwritingMetrics.pendingReviews || 0}
            format="number"
            trend={{ trend: 'down', change: -15.3 }}
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Performance Charts */}
      <Grid container spacing={gridLayout.spacing}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Policy Performance</Typography>
            <PerformanceChart
              chartType="area"
              metricCategory="policy"
              dateRange={dateRange}
              enableRealTime={true}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Underwriting Metrics</Typography>
            <PerformanceChart
              chartType="line"
              metricCategory="underwriting"
              dateRange={dateRange}
              enableRealTime={true}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(AnalyticsDashboard);