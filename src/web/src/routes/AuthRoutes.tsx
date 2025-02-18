import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'; // v6.x
import { ErrorBoundary } from 'react-error-boundary'; // v4.x

// Internal imports
import LoginForm from '../components/auth/LoginForm';
import MFAVerification from '../components/auth/MFAVerification';
import PasswordReset from '../components/auth/PasswordReset';
import AuthLayout from '../components/layout/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { AuthError } from '../types/auth.types';

/**
 * Authentication routes configuration component implementing secure routing with
 * OAuth 2.0 + OIDC integration, MFA enforcement, and accessibility compliance
 * @version 1.0.0
 */
const AuthRoutes: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, authState } = useAuth();

  // Track route changes for analytics and security monitoring
  useEffect(() => {
    const trackRouteChange = () => {
      // Implement analytics tracking here
      const routeData = {
        path: location.pathname,
        timestamp: new Date().toISOString(),
        sessionId: authState.user?.id
      };
      console.info('Auth route changed:', routeData);
    };

    trackRouteChange();
  }, [location, authState.user?.id]);

  // Handle authentication errors
  const handleAuthError = (error: AuthError) => {
    console.error('Authentication error:', error);
    // Implement error tracking/logging here
  };

  // Fallback UI for error boundary
  const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
    <div role="alert">
      <h2>Authentication Error</h2>
      <pre>{error.message}</pre>
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthLayout>
        <Routes>
          {/* Login Route */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginForm
                  onSuccess={() => {
                    const destination = location.state?.from || '/dashboard';
                    return <Navigate to={destination} replace />;
                  }}
                  onError={handleAuthError}
                />
              )
            }
          />

          {/* MFA Verification Route */}
          <Route
            path="/mfa-verification"
            element={
              authState.status === 'mfa_required' ? (
                <MFAVerification
                  sessionToken={authState.user?.id || ''}
                  onSuccess={() => {
                    const destination = location.state?.from || '/dashboard';
                    return <Navigate to={destination} replace />;
                  }}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Password Reset Route */}
          <Route
            path="/reset-password/:token?"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <PasswordReset />
              )
            }
          />

          {/* Catch-all redirect for unknown auth routes */}
          <Route
            path="*"
            element={<Navigate to="/login" replace />}
          />
        </Routes>
      </AuthLayout>
    </ErrorBoundary>
  );
};

export default AuthRoutes;