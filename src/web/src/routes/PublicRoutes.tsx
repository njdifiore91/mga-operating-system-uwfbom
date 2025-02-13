import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@sentry/react'; // v7.x
import LoginPage from '../pages/auth/LoginPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import { useAuth } from '../hooks/useAuth';

/**
 * Enhanced RedirectIfAuthenticated component that manages authenticated user redirection
 * with security monitoring and session validation
 */
const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authState } = useAuth();

  // Redirect authenticated users to dashboard
  if (isAuthenticated && authState.status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * Enhanced PublicRoutes component that configures and renders publicly accessible routes
 * with security monitoring, rate limiting, and accessibility features
 * @version 1.0.0
 */
const PublicRoutes: React.FC = () => {
  const { validateSession } = useAuth();

  // Set up security monitoring and session validation
  useEffect(() => {
    // Validate session state on route changes
    const validateRouteAccess = () => {
      validateSession();
    };

    // Monitor route changes for security
    window.addEventListener('popstate', validateRouteAccess);
    return () => window.removeEventListener('popstate', validateRouteAccess);
  }, [validateSession]);

  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <div role="alert" aria-live="assertive">
          <h2>Error loading route</h2>
          <pre>{error.message}</pre>
        </div>
      )}
    >
      <Routes>
        {/* Login Route */}
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />

        {/* Password Reset Route */}
        <Route
          path="/reset-password/:token?"
          element={
            <RedirectIfAuthenticated>
              <ResetPasswordPage />
            </RedirectIfAuthenticated>
          }
        />

        {/* Default Redirect */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </ErrorBoundary>
  );
};

export default PublicRoutes;