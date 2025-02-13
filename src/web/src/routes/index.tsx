import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { SecurityMonitor } from '@mga/security';

// Internal route components
import AuthRoutes from './AuthRoutes';
import PrivateRoutes from './PrivateRoutes';
import PublicRoutes from './PublicRoutes';

// Hooks and utilities
import { useAuth } from '../hooks/useAuth';

/**
 * Enhanced loading component with accessibility support
 */
const LoadingScreen: React.FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    role="progressbar"
    aria-label="Loading application"
    aria-live="polite"
  >
    <CircularProgress size={40} />
  </Box>
);

/**
 * Route announcer component for screen readers
 */
const RouteAnnouncer: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = document.title;
    const announcement = `Navigated to ${pageTitle}`;
    
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = announcement;
    
    document.body.appendChild(announcer);
    
    return () => {
      document.body.removeChild(announcer);
    };
  }, [location]);

  return null;
};

/**
 * Error fallback component with retry functionality
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box
    role="alert"
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    minHeight="100vh"
    p={3}
  >
    <h2>Something went wrong</h2>
    <pre style={{ maxWidth: '100%', overflow: 'auto' }}>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </Box>
);

/**
 * Root router component that manages the application's routing structure
 * with enhanced security, accessibility, and performance features
 */
const AppRouter: React.FC = () => {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  // Handle loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset application state
        window.location.href = '/';
      }}
    >
      <BrowserRouter>
        {/* Route announcer for accessibility */}
        <RouteAnnouncer />

        {/* Security monitoring wrapper */}
        <SecurityMonitor>
          <Routes>
            {/* Public routes (login, reset password, etc.) */}
            <Route
              path="/auth/*"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <PublicRoutes />
                )
              }
            />

            {/* Authentication routes (login, MFA, etc.) */}
            <Route
              path="/auth/*"
              element={<AuthRoutes />}
            />

            {/* Protected routes requiring authentication */}
            <Route
              path="/*"
              element={
                isAuthenticated ? (
                  <PrivateRoutes />
                ) : (
                  <Navigate to="/auth/login" replace />
                )
              }
            />

            {/* Catch-all route */}
            <Route
              path="*"
              element={
                <Navigate
                  to={isAuthenticated ? '/dashboard' : '/auth/login'}
                  replace
                />
              }
            />
          </Routes>
        </SecurityMonitor>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default AppRouter;