import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { AuthError } from '../../types/auth.types';

/**
 * Enhanced login page component implementing OAuth 2.0 authentication,
 * MFA verification, security monitoring, and WCAG 2.1 AA compliance
 * @version 1.0.0
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    authState
  } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Set up security monitoring and session validation
  useEffect(() => {
    // Update document title for accessibility
    document.title = 'Sign In - MGA Operating System';

    // Monitor suspicious activities
    const securityMonitor = (event: Event) => {
      if (event.type === 'securityEvent') {
        handleSecurityEvent({
          type: event.type,
          severity: 'medium',
          message: 'Security event detected'
        });
      }
    };

    window.addEventListener('securityEvent', securityMonitor);
    return () => window.removeEventListener('securityEvent', securityMonitor);
  }, []);

  /**
   * Handles successful login with enhanced security validation
   */
  const handleLoginSuccess = useCallback(async () => {
    try {
      // Validate session integrity
      if (authState.status === 'authenticated') {
        // Navigate to dashboard with security context
        navigate('/dashboard', { 
          state: { 
            authenticated: true,
            sessionStart: Date.now() 
          }
        });
      } else if (authState.status === 'mfa_required') {
        // Handle MFA flow
        navigate('/mfa', { 
          state: { 
            sessionId: authState.user?.id 
          }
        });
      }
    } catch (error) {
      console.error('Login success handler failed:', error);
      handleSecurityEvent({
        type: 'AUTH_ERROR',
        severity: 'high',
        message: 'Session validation failed'
      });
    }
  }, [authState.status, authState.user?.id, navigate]);

  /**
   * Processes security events and triggers appropriate responses
   */
  const handleSecurityEvent = useCallback((event: { type: string; severity: string; message: string }) => {
    // Log security event
    console.warn('Security event detected:', event);

    // Handle different security scenarios
    switch (event.type) {
      case 'SUSPICIOUS_ACTIVITY':
        // Trigger additional verification
        navigate('/verify', { 
          state: { 
            reason: 'suspicious_activity' 
          }
        });
        break;

      case 'SESSION_EXPIRED':
        // Clear session and redirect to login
        navigate('/login', { 
          state: { 
            reason: 'session_expired' 
          }
        });
        break;

      case 'AUTH_ERROR':
        // Handle authentication errors
        console.error('Authentication error:', event.message);
        break;

      default:
        // Log unknown security events
        console.warn('Unknown security event:', event);
    }
  }, [navigate]);

  /**
   * Handles authentication errors with proper user feedback
   */
  const handleLoginError = useCallback((error: AuthError) => {
    console.error('Login error:', error);

    // Log security event for monitoring
    handleSecurityEvent({
      type: 'AUTH_ERROR',
      severity: 'medium',
      message: error.message
    });
  }, []);

  return (
    <AuthLayout>
      <LoginForm
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
      />
    </AuthLayout>
  );
};

export default LoginPage;