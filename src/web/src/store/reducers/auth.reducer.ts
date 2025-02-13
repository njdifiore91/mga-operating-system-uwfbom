/**
 * Redux reducer for authentication state management in MGA Operating System
 * Implements secure state handling with MFA support and cross-tab synchronization
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  AuthState,
  User,
  AuthResponse,
  AuthError,
  AuthStatus
} from '../../types/auth.types';
import {
  loginUser,
  verifyMFACode,
  refreshUserSession,
  logoutUser
} from '../actions/auth.actions';

// Security event interface for audit logging
interface SecurityEvent {
  timestamp: number;
  type: string;
  details: Record<string, unknown>;
}

// Initial state with security monitoring
const initialState: AuthState & { 
  sessionTimeout: number | null;
  securityEvents: SecurityEvent[];
} = {
  status: 'unauthenticated',
  user: null,
  loading: false,
  error: null,
  sessionTimeout: null,
  lastActivity: Date.now(),
  securityEvents: []
};

/**
 * Enhanced authentication slice with security features and audit logging
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Clear authentication error state with audit logging
     */
    clearError: (state) => {
      state.error = null;
      state.securityEvents.push({
        timestamp: Date.now(),
        type: 'ERROR_CLEARED',
        details: { previousError: state.error }
      });
    },

    /**
     * Update user activity timestamp and check session timeout
     */
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
      
      if (state.sessionTimeout && 
          Date.now() - state.lastActivity > state.sessionTimeout) {
        state.status = 'unauthenticated';
        state.user = null;
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'SESSION_TIMEOUT',
          details: { userId: state.user?.id }
        });
      }
    },

    /**
     * Synchronize authentication state across browser tabs
     */
    syncTabState: (state, action: PayloadAction<AuthState>) => {
      const newState = action.payload;
      // Validate state before sync
      if (newState.status && typeof newState.loading === 'boolean') {
        state.status = newState.status;
        state.user = newState.user;
        state.error = newState.error;
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'STATE_SYNCED',
          details: { newStatus: newState.status }
        });
      }
    }
  },
  extraReducers: (builder) => {
    // Login flow
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'LOGIN_ATTEMPTED',
          details: {}
        });
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.status = action.payload.requiresMFA ? 'mfa_required' : 'authenticated';
        state.sessionTimeout = 3600000; // 1 hour
        state.lastActivity = Date.now();
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'LOGIN_SUCCESSFUL',
          details: {
            userId: action.payload.user.id,
            requiresMFA: action.payload.requiresMFA
          }
        });
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'Authentication failed'
        };
        state.status = 'unauthenticated';
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'LOGIN_FAILED',
          details: { error: state.error }
        });
      })

    // MFA verification flow
    builder
      .addCase(verifyMFACode.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'MFA_VERIFICATION_ATTEMPTED',
          details: {}
        });
      })
      .addCase(verifyMFACode.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.status = 'authenticated';
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'MFA_VERIFICATION_SUCCESSFUL',
          details: { userId: action.payload.user.id }
        });
      })
      .addCase(verifyMFACode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || {
          code: 'MFA_ERROR',
          message: 'MFA verification failed'
        };
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'MFA_VERIFICATION_FAILED',
          details: { error: state.error }
        });
      })

    // Session refresh flow
    builder
      .addCase(refreshUserSession.pending, (state) => {
        state.loading = true;
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'SESSION_REFRESH_ATTEMPTED',
          details: {}
        });
      })
      .addCase(refreshUserSession.fulfilled, (state) => {
        state.loading = false;
        state.lastActivity = Date.now();
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'SESSION_REFRESH_SUCCESSFUL',
          details: { userId: state.user?.id }
        });
      })
      .addCase(refreshUserSession.rejected, (state, action) => {
        state.loading = false;
        state.status = 'unauthenticated';
        state.user = null;
        state.error = action.payload || {
          code: 'REFRESH_ERROR',
          message: 'Session refresh failed'
        };
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'SESSION_REFRESH_FAILED',
          details: { error: state.error }
        });
      })

    // Logout flow
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'unauthenticated';
        state.user = null;
        state.sessionTimeout = null;
        state.error = null;
        state.securityEvents.push({
          timestamp: Date.now(),
          type: 'LOGOUT_SUCCESSFUL',
          details: {}
        });
      });
  }
});

// Export actions for component consumption
export const { clearError, updateLastActivity, syncTabState } = authSlice.actions;

// Export reducer for store configuration
export default authSlice.reducer;