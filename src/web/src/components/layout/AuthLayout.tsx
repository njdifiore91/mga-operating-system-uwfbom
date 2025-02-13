import React, { useEffect } from 'react';
import { Box, Container, Paper, Typography, useTheme } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoginForm from '../auth/LoginForm';
import MFAVerification from '../auth/MFAVerification';
import PasswordReset from '../auth/PasswordReset';
import LoadingSpinner from '../common/LoadingSpinner';

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Authentication layout component providing consistent structure and styling for auth flows
 * Implements Material Design 3.0 principles and WCAG 2.1 AA accessibility standards
 * @version 1.0.0
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({ children, className }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, isLoading } = useAuth();

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (authState.status === 'authenticated') {
      navigate('/dashboard');
    }
  }, [authState.status, navigate]);

  // Get page title based on current route
  const getPageTitle = (pathname: string): string => {
    switch (pathname) {
      case '/login':
        return 'Sign In - MGA Operating System';
      case '/mfa':
        return 'Two-Factor Authentication - MGA Operating System';
      case '/reset-password':
        return 'Reset Password - MGA Operating System';
      default:
        return 'Authentication - MGA Operating System';
    }
  };

  // Update document title for accessibility
  useEffect(() => {
    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
        [theme.breakpoints.down('sm')]: {
          padding: theme.spacing(2),
        },
        [theme.breakpoints.up('sm')]: {
          padding: theme.spacing(4),
        },
      }}
      className={className}
    >
      {/* Header with logo */}
      <Box
        component="header"
        sx={{
          textAlign: 'center',
          mb: 4,
          [theme.breakpoints.down('sm')]: {
            mb: 2,
          },
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            fontWeight: theme.typography.fontWeightBold,
            color: theme.palette.primary.main,
          }}
        >
          MGA Operating System
        </Typography>
      </Box>

      {/* Main content area */}
      <Container
        maxWidth="sm"
        component="section"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Dynamic content rendering based on auth state */}
          {authState.status === 'mfa_required' ? (
            <MFAVerification
              sessionToken={authState.sessionToken || ''}
              onSuccess={() => navigate('/dashboard')}
              onError={(error) => console.error('MFA Error:', error)}
            />
          ) : location.pathname === '/reset-password' ? (
            <PasswordReset />
          ) : (
            children || (
              <LoginForm
                onSuccess={() => navigate('/dashboard')}
                onError={(error) => console.error('Login Error:', error)}
              />
            )
          )}
        </Paper>
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          mt: 4,
          textAlign: 'center',
          color: theme.palette.text.secondary,
          [theme.breakpoints.down('sm')]: {
            mt: 2,
          },
        }}
      >
        <Typography variant="body2">
          © {new Date().getFullYear()} MGA Operating System. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default AuthLayout;