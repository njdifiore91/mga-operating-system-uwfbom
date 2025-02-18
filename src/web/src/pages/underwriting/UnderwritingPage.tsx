import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Box, Paper, Skeleton, Alert } from '@mui/material';
import { useApm } from '@elastic/apm-rum-react';
import useWebSocket from 'react-use-websocket';
import { Analytics } from '@segment/analytics-next';

import UnderwritingDashboard from '../../components/underwriting/UnderwritingDashboard';
import UnderwritingWorkflow from '../../components/underwriting/UnderwritingWorkflow';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useUnderwriting } from '../../hooks/useUnderwriting';
import { IUnderwritingDecisionForm } from '../../types/underwriting.types';

// WebSocket endpoint for real-time updates
const WS_ENDPOINT = `${process.env.REACT_APP_WS_URL}/underwriting`;

/**
 * Main underwriting page component that serves as the container for the MGA OS underwriting interface
 * Implements real-time updates, performance monitoring, and comprehensive error handling
 */
const UnderwritingPage: React.FC = React.memo(() => {
  // Router hooks
  const { policyId } = useParams<{ policyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Custom hooks
  const { apm } = useApm();
  const analytics = Analytics();
  const {
    makeDecision,
    updateFilters
  } = useUnderwriting({
    status: null,
    severity: null,
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  });

  // WebSocket setup for real-time updates
  const { sendMessage, lastMessage } = useWebSocket(WS_ENDPOINT, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10,
    onOpen: () => {
      console.debug('WebSocket connected');
      if (policyId) {
        sendMessage(JSON.stringify({ type: 'SUBSCRIBE', policyId }));
      }
    }
  });

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const update = JSON.parse(lastMessage.data);
        if (update.type === 'RISK_ASSESSMENT_UPDATE') {
          // Trigger queue refresh
          updateFilters({});
        }
      } catch (err) {
        console.error('WebSocket message parsing failed:', err);
      }
    }
  }, [lastMessage, updateFilters]);

  // Performance monitoring
  useEffect(() => {
    const transaction = apm?.startTransaction('underwriting-page-load', 'page-load');
    setIsLoading(true);

    return () => {
      transaction?.end();
    };
  }, [apm]);

  // Handle workflow completion
  const handleWorkflowComplete = useCallback(async (decision: IUnderwritingDecisionForm) => {
    try {
      await makeDecision(decision);
      
      // Track completion event
      analytics.track('underwriting_workflow_completed', {
        policyId: decision.policyId,
        decision: decision.decision,
        timestamp: new Date().toISOString()
      });

      // Navigate back to dashboard
      navigate('/underwriting');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Workflow completion failed'));
    }
  }, [makeDecision, navigate, analytics]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    setError(error);
    apm?.captureError(error);
  }, [apm]);

  // Determine current view
  const isWorkflowView = useMemo(() => {
    return location.pathname.includes('/workflow');
  }, [location]);

  // Loading state
  if (isLoading && !error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Skeleton variant="rectangular" height={200} />
          <Box sx={{ mt: 2 }}>
            <Skeleton variant="rectangular" height={400} />
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={
        <Alert 
          severity="error"
          sx={{ m: 2 }}
        >
          An error occurred while loading the underwriting interface. Please try again later.
        </Alert>
      }
    >
      <Container 
        maxWidth="lg"
        sx={{ py: 4 }}
        component="main"
        role="main"
        aria-label="Underwriting Management"
      >
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ mb: 2 }}
          >
            {error.message}
          </Alert>
        )}

        <Paper elevation={0} sx={{ p: 3 }}>
          {isWorkflowView && policyId ? (
            <UnderwritingWorkflow
              policyId={policyId}
              onComplete={handleWorkflowComplete}
              onError={handleError}
            />
          ) : (
            <UnderwritingDashboard />
          )}
        </Paper>
      </Container>
    </ErrorBoundary>
  );
});

UnderwritingPage.displayName = 'UnderwritingPage';

export default UnderwritingPage;