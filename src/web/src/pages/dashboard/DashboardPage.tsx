import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material';
import { useWebSocket } from 'react-use-websocket';
import { useNetworkStatus } from '@react-hooks/network-status';
import DashboardLayout from '../../components/layout/DashboardLayout';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';

// Decorators for error handling and telemetry
const withErrorBoundary = (Component: React.FC) => (props: any) => (
  <ErrorBoundary>
    <Component {...props} />
  </ErrorBoundary>
);

const withTelemetry = (Component: React.FC) => (props: any) => {
  useEffect(() => {
    // Initialize performance monitoring
    performance.mark('dashboard-render-start');
    return () => {
      performance.mark('dashboard-render-end');
      performance.measure(
        'dashboard-render',
        'dashboard-render-start',
        'dashboard-render-end'
      );
    };
  }, []);

  return <Component {...props} />;
};

// Props interface
interface DashboardPageProps {
  className?: string;
  wsEndpoint?: string;
  refreshInterval?: number;
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
  wsEndpoint = `${process.env.REACT_APP_WS_BASE_URL}/metrics`,
  refreshInterval = 30000
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { online: isOnline } = useNetworkStatus();

  // State management
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [metricsCache, setMetricsCache] = useState<MetricsData | null>(null);

  // WebSocket connection for real-time updates
  const { lastMessage, readyState } = useWebSocket(wsEndpoint, {
    shouldReconnect: (closeEvent) => true,
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

  // Monitor network status and WebSocket connection
  useEffect(() => {
    setOfflineMode(!isOnline || readyState !== WebSocket.OPEN);
  }, [isOnline, readyState]);

  // Memoized layout configuration
  const layoutConfig = useMemo(() => ({
    maxWidth: isTablet ? 'lg' : false,
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
            onDataUpdate={updateMetricsCache}
            offlineMode={offlineMode}
          />
        </Box>
      </Container>
    </DashboardLayout>
  );
};

// Apply decorators
const EnhancedDashboardPage = withTelemetry(withErrorBoundary(DashboardPage));

export default EnhancedDashboardPage;