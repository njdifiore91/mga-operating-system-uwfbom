import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material';
import useWebSocket from 'react-use-websocket';
import DashboardLayout from '../../components/layout/DashboardLayout';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// Props interface
interface DashboardPageProps {
  className?: string;
  wsEndpoint?: string;
}

// MetricsData interface for WebSocket updates
interface MetricsData {
  timestamp: number;
  metrics: Record<string, number>;
  version: string;
}

/**
 * DashboardPage Component
 * Main dashboard page implementing real-time metrics, analytics, and responsive layout
 */
const DashboardPage: React.FC<DashboardPageProps> = ({
  className = '',
  wsEndpoint = `${process.env.REACT_APP_WS_BASE_URL}/metrics`
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [metricsCache, setMetricsCache] = useState<MetricsData | null>(null);

  // WebSocket connection for real-time updates
  const { lastMessage, readyState } = useWebSocket(wsEndpoint, {
    shouldReconnect: () => true,
    reconnectAttempts: 5,
    reconnectInterval: 3000
  });

  // Cache management for offline support
  const updateMetricsCache = useCallback((data: MetricsData) => {
    try {
      localStorage.setItem('mga_metrics_cache', JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      setMetricsCache(data);
    } catch (error) {
      console.error('Error caching metrics:', error);
    }
  }, []);

  // Load cached metrics on initialization
  useEffect(() => {
    try {
      const cached = localStorage.getItem('mga_metrics_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Only use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setMetricsCache(data);
        }
      }
    } catch (error) {
      console.error('Error loading cached metrics:', error);
    }
  }, []);

  // Handle WebSocket messages and offline mode
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const data: MetricsData = JSON.parse(lastMessage.data);
        updateMetricsCache(data);
        setOfflineMode(false);
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    }
  }, [lastMessage, updateMetricsCache]);

  // Monitor WebSocket connection
  useEffect(() => {
    setOfflineMode(readyState !== WebSocket.OPEN);
  }, [readyState]);

  // Memoized layout configuration
  const layoutConfig = useMemo(() => ({
    maxWidth: isTablet ? 'lg' : false as const,
    padding: theme.spacing(isMobile ? 2 : 3),
    marginTop: theme.spacing(2)
  }), [theme, isMobile, isTablet]);

  return (
    <DashboardLayout>
      <Container
        maxWidth={layoutConfig.maxWidth}
        sx={{
          padding: layoutConfig.padding,
          marginTop: layoutConfig.marginTop
        }}
      >
        <Box
          component="main"
          className={className}
          sx={{
            flexGrow: 1,
            width: '100%',
            minHeight: '100vh'
          }}
        >
          <AnalyticsDashboard
            className="dashboard-analytics"
            offlineMode={offlineMode}
          />
        </Box>
      </Container>
    </DashboardLayout>
  );
};

// Apply decorators
const EnhancedDashboardPage = withErrorBoundary(DashboardPage);

// Higher-order component for error boundary
function withErrorBoundary(Component: React.FC<DashboardPageProps>) {
  return function WithErrorBoundaryWrapper(props: DashboardPageProps) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default EnhancedDashboardPage;