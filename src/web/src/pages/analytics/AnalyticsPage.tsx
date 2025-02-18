import React, { useEffect } from 'react';
import { Container } from '@mui/material';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/common/PageHeader';
import AnalyticsDashboard from '../../components/analytics/AnalyticsDashboard';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAnalytics } from '@mga/analytics'; // v1.0.x

/**
 * AnalyticsPage Component
 * Serves as the main analytics dashboard page in the MGA Operating System platform.
 * Provides comprehensive view of key performance metrics, risk assessments, and operational analytics.
 */
const AnalyticsPage: React.FC = () => {
  // Initialize analytics tracking
  const { trackPageView, trackEvent } = useAnalytics();

  // Track page view on component mount
  useEffect(() => {
    trackPageView({
      page: 'analytics_dashboard',
      properties: {
        timestamp: new Date().toISOString(),
        section: 'analytics'
      }
    });

    return () => {
      // Clean up any analytics listeners or subscriptions
      trackEvent('analytics_dashboard_exit', {
        duration: Date.now() - performance.now()
      });
    };
  }, [trackPageView, trackEvent]);

  // Handle analytics error reporting
  const handleAnalyticsError = (error: Error) => {
    trackEvent('analytics_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <DashboardLayout>
      <Container 
        maxWidth={false}
        sx={{
          py: 3,
          px: { xs: 2, sm: 3 },
          minHeight: '100vh'
        }}
      >
        <ErrorBoundary
          fallback={
            <div>
              Error loading analytics dashboard. Please try again later.
            </div>
          }
        >
          <PageHeader
            title="Analytics Dashboard"
            subtitle="Monitor key performance metrics and operational analytics"
          />

          <AnalyticsDashboard
            className="analytics-dashboard"
            refreshInterval={30000} // 30 seconds refresh
            onError={handleAnalyticsError}
            style={{
              marginTop: 3
            }}
          />
        </ErrorBoundary>
      </Container>
    </DashboardLayout>
  );
};

export default AnalyticsPage;