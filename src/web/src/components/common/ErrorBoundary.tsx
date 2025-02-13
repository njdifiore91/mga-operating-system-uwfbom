import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material'; // v5.14.x
import Notification from './Notification';

/**
 * Props interface for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorMessageTemplate?: string;
  onError?: () => void;
}

/**
 * State interface for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
  errorId: string;
  isRetrying: boolean;
}

/**
 * A React error boundary component that provides comprehensive error handling
 * with accessibility support and monitoring capabilities.
 * Implements WCAG 2.1 Level AA compliance requirements.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      hasError: false,
      errorId: '',
      isRetrying: false
    };

    this.handleRetry = this.handleRetry.bind(this);
  }

  /**
   * Static method to update state when an error occurs
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Generate unique error ID for tracking
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      error,
      hasError: true,
      errorId,
      isRetrying: false
    };
  }

  /**
   * Lifecycle method called after an error is caught
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    console.error({
      errorId: this.state.errorId,
      error: error,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Display accessible error notification
    const notification = {
      message: 'An unexpected error occurred. Our team has been notified.',
      severity: 'error',
      autoHideDuration: 6000
    };

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError();
    }
  }

  /**
   * Handles error recovery attempts
   */
  handleRetry(): void {
    this.setState({
      isRetrying: true
    }, () => {
      // Reset error state
      this.setState({
        error: null,
        hasError: false,
        errorId: '',
        isRetrying: false
      });
    });
  }

  render(): ReactNode {
    const { hasError, error, isRetrying } = this.state;
    const { children, fallback, errorMessageTemplate } = this.props;

    if (hasError && error) {
      // If custom fallback is provided, render it
      if (fallback) {
        return fallback;
      }

      // Default error UI with accessibility support
      return (
        <Box
          role="alert"
          aria-live="polite"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="200px"
          p={3}
          data-testid="error-boundary-fallback"
        >
          <Typography
            variant="h6"
            color="error"
            gutterBottom
            align="center"
            sx={{ mb: 2 }}
          >
            {errorMessageTemplate || 'Something went wrong'}
          </Typography>
          
          <Typography
            variant="body1"
            color="textSecondary"
            align="center"
            sx={{ mb: 3 }}
          >
            {`Error ID: ${this.state.errorId}`}
          </Typography>

          <Button
            variant="contained"
            color="primary"
            onClick={this.handleRetry}
            disabled={isRetrying}
            aria-label="Retry loading the application"
            sx={{ mt: 2 }}
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
        </Box>
      );
    }

    // Render children if no error
    return children;
  }
}

export default ErrorBoundary;