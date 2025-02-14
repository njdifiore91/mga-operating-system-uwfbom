/**
 * UnderwritingWorkflow Component
 * Implements a comprehensive underwriting workflow interface with real-time updates,
 * accessibility features, and audit logging capabilities.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  CircularProgress,
  Alert,
  Box,
  Paper,
  Typography
} from '@mui/material';
import { useUnderwriting } from '../../hooks/useUnderwriting';
import { useAuditLogger } from '@mga/audit-logger'; // ^1.0.0
import {
  UnderwritingStatus,
  IUnderwritingDecisionForm
} from '../../types/underwriting.types';

// Workflow step definitions
const WORKFLOW_STEPS = [
  'Initial Review',
  'Risk Assessment',
  'Document Verification',
  'Decision Making',
  'Final Review'
] as const;

interface UnderwritingWorkflowProps {
  policyId: string;
  initialStep?: number;
  onComplete?: (decision: IUnderwritingDecisionForm) => void;
  onError?: (error: Error) => void;
}

/**
 * Enhanced UnderwritingWorkflow component implementing the core underwriting process
 */
export const UnderwritingWorkflow: React.FC<UnderwritingWorkflowProps> = ({
  policyId,
  initialStep = 0,
  onComplete,
  onError
}) => {
  // State management
  const [activeStep, setActiveStep] = useState(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [decision] = useState<Partial<IUnderwritingDecisionForm>>({});

  // Refs for WebSocket and cleanup
  const webSocketRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Custom hooks
  const {
    riskAssessment,
    submitForUnderwriting,
    makeDecision
  } = useUnderwriting({
    policyId,
    status: UnderwritingStatus.IN_REVIEW
  });

  const auditLogger = useAuditLogger();

  // Memoized validation checks
  const isStepValid = useMemo(() => {
    switch (activeStep) {
      case 0:
        return !!policyId;
      case 1:
        return !!riskAssessment?.riskScore;
      case 2:
        return !!decision.notes;
      case 3:
        return !!decision.decision;
      case 4:
        return true;
      default:
        return false;
    }
  }, [activeStep, policyId, riskAssessment, decision]);

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const setupWebSocket = () => {
      if (webSocketRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/underwriting/${policyId}`);

      ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        if (update.type === 'RISK_ASSESSMENT_UPDATE') {
          // Handle real-time risk assessment updates
          auditLogger.log('underwriting_update_received', {
            policyId,
            updateType: update.type,
            timestamp: new Date().toISOString()
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(new Error('Real-time update connection failed'));
      };

      webSocketRef.current = ws;
      cleanupRef.current = () => ws.close();
    };

    setupWebSocket();

    return () => {
      cleanupRef.current?.();
    };
  }, [policyId, onError, auditLogger]);

  // Enhanced step change handler with validation and logging
  const handleStepChange = useCallback(async (newStep: number) => {
    try {
      setIsLoading(true);

      // Validate current step before proceeding
      if (!isStepValid) {
        throw new Error('Please complete all required fields before proceeding');
      }

      // Log step transition
      await auditLogger.log('underwriting_step_change', {
        policyId,
        fromStep: activeStep,
        toStep: newStep,
        timestamp: new Date().toISOString()
      });

      // Handle step-specific logic
      switch (newStep) {
        case 1:
          // Initialize risk assessment
          await submitForUnderwriting({
            policyId,
            status: UnderwritingStatus.IN_REVIEW
          });
          break;
        case 3:
          // Validate risk assessment completion
          if (!riskAssessment) {
            throw new Error('Risk assessment must be completed before proceeding');
          }
          break;
        case 4:
          // Submit final decision
          if (decision.decision) {
            await makeDecision(decision as IUnderwritingDecisionForm);
            onComplete?.(decision as IUnderwritingDecisionForm);
          }
          break;
      }

      setActiveStep(newStep);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Step change failed');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [
    policyId,
    activeStep,
    isStepValid,
    decision,
    riskAssessment,
    submitForUnderwriting,
    makeDecision,
    onComplete,
    onError,
    auditLogger
  ]);

  // Render step content with accessibility enhancements
  const renderStepContent = useCallback((step: number) => {
    switch (step) {
      case 0:
        return (
          <Box role="region" aria-label="Initial Review">
            <Typography variant="h6">Initial Policy Review</Typography>
            {/* Initial review content */}
          </Box>
        );
      case 1:
        return (
          <Box role="region" aria-label="Risk Assessment">
            <Typography variant="h6">Risk Assessment</Typography>
            {riskAssessment && (
              <Box>
                <Typography>
                  Risk Score: {riskAssessment.riskScore}
                </Typography>
                <Typography>
                  Severity: {riskAssessment.severity}
                </Typography>
              </Box>
            )}
          </Box>
        );
      // Additional step content...
      default:
        return null;
    }
  }, [riskAssessment]);

  return (
    <Paper
      elevation={3}
      sx={{ p: 3, my: 2 }}
      role="main"
      aria-label="Underwriting Workflow"
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

      <Stepper
        activeStep={activeStep}
        alternativeLabel
        aria-label="Underwriting Progress"
      >
        {WORKFLOW_STEPS.map((label, index) => (
          <Step
            key={label}
            completed={index < activeStep}
          >
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mt: 4, mb: 2 }}>
        {renderStepContent(activeStep)}
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 3
        }}
      >
        <Button
          variant="outlined"
          onClick={() => handleStepChange(activeStep - 1)}
          disabled={activeStep === 0 || isLoading}
          aria-label="Previous Step"
        >
          Back
        </Button>

        <Button
          variant="contained"
          onClick={() => handleStepChange(activeStep + 1)}
          disabled={!isStepValid || isLoading}
          aria-label="Next Step"
        >
          {isLoading ? (
            <CircularProgress size={24} />
          ) : activeStep === WORKFLOW_STEPS.length - 1 ? (
            'Complete'
          ) : (
            'Next'
          )}
        </Button>
      </Box>
    </Paper>
  );
};

export default UnderwritingWorkflow;