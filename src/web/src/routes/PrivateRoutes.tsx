import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import DashboardLayout from '../components/layout/DashboardLayout';
import ErrorBoundary from '../components/common/ErrorBoundary';
import {
  DASHBOARD_ROUTES,
  POLICY_ROUTES,
  CLAIMS_ROUTES,
  UNDERWRITING_ROUTES,
  DOCUMENT_ROUTES
} from '../constants/routes.constants';

// Lazy-loaded route components for code splitting
const Dashboard = React.lazy(() => import('../pages/Dashboard'));
const PolicyList = React.lazy(() => import('../pages/policy/PolicyList'));
const PolicyDetails = React.lazy(() => import('../pages/policy/PolicyDetails'));
const NewPolicy = React.lazy(() => import('../pages/policy/NewPolicy'));
const UnderwritingQueue = React.lazy(() => import('../pages/underwriting/UnderwritingQueue'));
const UnderwritingAnalytics = React.lazy(() => import('../pages/underwriting/UnderwritingAnalytics'));
const Claims = React.lazy(() => import('../pages/claims/Claims'));
const Documents = React.lazy(() => import('../pages/documents/Documents'));

/**
 * Loading spinner component with accessibility support
 */
const LoadingSpinner: React.FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    role="progressbar"
    aria-label="Loading content"
  >
    <CircularProgress size={40} />
  </Box>
);

/**
 * Higher-order component for protected routes with role-based access control
 */
const ProtectedRoute: React.FC<{
  element: React.ReactElement;
  requiredRoles?: string[];
}> = ({ element, requiredRoles = [] }) => {
  const { isAuthenticated, user } = useAuth();

  // Check authentication and role-based access
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user?.role || '')) {
    return <Navigate to="/unauthorized" replace />;
  }

  return element;
};

/**
 * Private routes configuration component implementing secure route-based access control
 * and layout integration with WCAG 2.1 Level AA compliance
 */
const PrivateRoutes: React.FC = () => {
  const { isAuthenticated, isLoading, sessionTimeout } = useAuth();

  // Handle session timeout
  useEffect(() => {
    if (sessionTimeout) {
      const timeoutId = setTimeout(() => {
        window.location.href = '/auth/login?timeout=true';
      }, sessionTimeout);

      return () => clearTimeout(timeoutId);
    }
  }, [sessionTimeout]);

  // Show loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          element={
            <DashboardLayout>
              <React.Suspense fallback={<LoadingSpinner />}>
                <Outlet />
              </React.Suspense>
            </DashboardLayout>
          }
        >
          {/* Dashboard Routes */}
          <Route
            path={DASHBOARD_ROUTES.HOME}
            element={<ProtectedRoute element={<Dashboard />} />}
          />

          {/* Policy Routes */}
          <Route path={POLICY_ROUTES.ROOT}>
            <Route
              path={POLICY_ROUTES.LIST}
              element={
                <ProtectedRoute
                  element={<PolicyList />}
                  requiredRoles={['MGA_ADMIN', 'UNDERWRITER']}
                />
              }
            />
            <Route
              path={POLICY_ROUTES.DETAILS}
              element={
                <ProtectedRoute
                  element={<PolicyDetails />}
                  requiredRoles={['MGA_ADMIN', 'UNDERWRITER']}
                />
              }
            />
            <Route
              path={POLICY_ROUTES.NEW}
              element={
                <ProtectedRoute
                  element={<NewPolicy />}
                  requiredRoles={['MGA_ADMIN', 'UNDERWRITER']}
                />
              }
            />
          </Route>

          {/* Underwriting Routes */}
          <Route path={UNDERWRITING_ROUTES.ROOT}>
            <Route
              path={UNDERWRITING_ROUTES.QUEUE}
              element={
                <ProtectedRoute
                  element={<UnderwritingQueue />}
                  requiredRoles={['MGA_ADMIN', 'UNDERWRITER']}
                />
              }
            />
            <Route
              path={UNDERWRITING_ROUTES.ANALYTICS}
              element={
                <ProtectedRoute
                  element={<UnderwritingAnalytics />}
                  requiredRoles={['MGA_ADMIN']}
                />
              }
            />
          </Route>

          {/* Claims Routes */}
          <Route
            path={CLAIMS_ROUTES.ROOT}
            element={
              <ProtectedRoute
                element={<Claims />}
                requiredRoles={['MGA_ADMIN', 'CLAIMS_HANDLER']}
              />
            }
          />

          {/* Document Routes */}
          <Route
            path={DOCUMENT_ROUTES.ROOT}
            element={
              <ProtectedRoute
                element={<Documents />}
                requiredRoles={['MGA_ADMIN', 'UNDERWRITER', 'CLAIMS_HANDLER', 'AUDITOR']}
              />
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to={DASHBOARD_ROUTES.HOME} replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
};

export default PrivateRoutes;