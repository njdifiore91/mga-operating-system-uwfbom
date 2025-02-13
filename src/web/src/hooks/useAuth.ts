/**
 * Custom React hook providing comprehensive authentication functionality and state management
 * Implements OAuth 2.0 with OIDC, MFA enforcement, and security monitoring
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import {
  AuthService,
  login,
  verifyMFA,
  logout,
  refreshSession,
  resetPassword,
  checkPermission,
  logSecurityEvent
} from '../services/auth.service';
import {
  LoginCredentials,
  MFAVerification,
  PasswordReset,
  AuthResponse,
  User,
  AuthState,
  SecurityEvent,
  AuthStatus
} from '../types/auth.types';

// Constants for session management
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const ACTIVITY_CHECK_INTERVAL = 60000; // Check activity every minute

export function useAuth() {
  // State management
  const [authState, setAuthState] = useState<AuthState>({
    status: 'unauthenticated',
    user: null,
    loading: true,
    error: null,
    lastActivity: Date.now()
  });

  // Refs for service instances and timers
  const authService = useRef(new AuthService());
  const activityCheckTimer = useRef<NodeJS.Timeout>();
  const sessionTimeoutTimer = useRef<NodeJS.Timeout>();

  // Track user activity
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Updates the last activity timestamp and resets session timeout
   */
  const updateActivity = useCallback(() => {
    const currentTime = new Date();
    setLastActivity(currentTime);
    setAuthState(prev => ({ ...prev, lastActivity: currentTime.getTime() }));

    // Reset session timeout
    if (sessionTimeoutTimer.current) {
      clearTimeout(sessionTimeoutTimer.current);
    }
    sessionTimeoutTimer.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT);
  }, []);

  /**
   * Handles user login with credentials
   */
  const handleLogin = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.current.login(credentials);
      setAuthState({
        status: response.requiresMFA ? 'mfa_required' : 'authenticated',
        user: response.user,
        loading: false,
        error: null,
        lastActivity: Date.now()
      });
      updateActivity();
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      setAuthState(prev => ({ ...prev, error: { code: 'LOGIN_ERROR', message: errorMessage } }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles MFA verification
   */
  const handleMFAVerification = async (verification: MFAVerification): Promise<AuthResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.current.verifyMFA(verification);
      setAuthState({
        status: 'authenticated',
        user: response.user,
        loading: false,
        error: null,
        lastActivity: Date.now()
      });
      updateActivity();
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MFA verification failed';
      setError(errorMessage);
      setAuthState(prev => ({ ...prev, error: { code: 'MFA_ERROR', message: errorMessage } }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles user logout
   */
  const handleLogout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.current.logout();
      setAuthState({
        status: 'unauthenticated',
        user: null,
        loading: false,
        error: null,
        lastActivity: Date.now()
      });
      clearTimers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles password reset
   */
  const handlePasswordReset = async (resetData: PasswordReset): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.current.resetPassword(resetData);
      setAuthState(prev => ({ ...prev, status: 'unauthenticated' }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Checks user permission
   */
  const checkUserPermission = useCallback((permission: string): boolean => {
    return authState.user ? authService.current.checkPermission(permission) : false;
  }, [authState.user]);

  /**
   * Cleans up timers
   */
  const clearTimers = useCallback(() => {
    if (activityCheckTimer.current) {
      clearInterval(activityCheckTimer.current);
    }
    if (sessionTimeoutTimer.current) {
      clearTimeout(sessionTimeoutTimer.current);
    }
  }, []);

  // Initialize activity monitoring
  useEffect(() => {
    const handleUserActivity = () => {
      if (authState.status === 'authenticated') {
        updateActivity();
      }
    };

    // Set up activity listeners
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    // Start activity check timer
    activityCheckTimer.current = setInterval(() => {
      const inactiveTime = Date.now() - authState.lastActivity;
      if (inactiveTime >= SESSION_TIMEOUT) {
        handleLogout();
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      clearTimers();
    };
  }, [authState.status, authState.lastActivity, updateActivity, clearTimers]);

  return {
    authState,
    user: authState.user,
    login: handleLogin,
    verifyMFA: handleMFAVerification,
    logout: handleLogout,
    resetPassword: handlePasswordReset,
    checkPermission: checkUserPermission,
    isAuthenticated: authState.status === 'authenticated',
    isLoading,
    error,
    lastActivity,
    sessionTimeout: SESSION_TIMEOUT
  };
}