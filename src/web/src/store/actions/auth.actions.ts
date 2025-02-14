/**
 * Redux action creators for authentication operations in MGA Operating System
 * Implements OAuth 2.0 with JWT tokens, MFA verification, and enhanced security features
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  LoginCredentials,
  MFAVerification,
  AuthResponse,
  AuthTokens,
  AuthError
} from '../../types/auth.types';
import { authService } from '../../services/auth.service';

// Action type constants
const AUTH_ACTION_TYPES = {
  LOGIN: 'auth/login',
  VERIFY_MFA: 'auth/verifyMFA',
  REFRESH_SESSION: 'auth/refreshSession',
  LOGOUT: 'auth/logout'
} as const;

/**
 * Enhanced async thunk for user authentication with security monitoring
 */
export const loginUser = createAsyncThunk<
  AuthResponse,
  LoginCredentials,
  { rejectValue: AuthError }
>(
  AUTH_ACTION_TYPES.LOGIN,
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      // Attempt user authentication with enhanced security
      const response = await authService.authenticateUser(credentials);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          code: 'AUTH_ERROR',
          message: error.message
        });
      }
      throw error;
    }
  }
);

/**
 * Enhanced async thunk for MFA verification with security validation
 */
export const verifyMFACode = createAsyncThunk<
  AuthResponse,
  MFAVerification,
  { rejectValue: AuthError }
>(
  AUTH_ACTION_TYPES.VERIFY_MFA,
  async (verification: MFAVerification, { rejectWithValue }) => {
    try {
      // Complete MFA verification with enhanced security context
      const response = await authService.verifyMFA(verification);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          code: 'MFA_ERROR',
          message: error.message
        });
      }
      throw error;
    }
  }
);

/**
 * Enhanced async thunk for secure token refresh with validation
 */
export const refreshUserSession = createAsyncThunk<
  AuthTokens,
  void,
  { rejectValue: AuthError }
>(
  AUTH_ACTION_TYPES.REFRESH_SESSION,
  async (_, { rejectWithValue }) => {
    try {
      await authService.handleTokenRefresh();
      const tokens = authService.getCurrentTokens();
      if (!tokens) {
        throw new Error('Token refresh failed');
      }
      return tokens;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          code: 'REFRESH_ERROR',
          message: error.message
        });
      }
      throw error;
    }
  }
);

/**
 * Enhanced async thunk for secure user logout
 */
export const logoutUser = createAsyncThunk<
  void,
  void,
  { rejectValue: AuthError }
>(
  AUTH_ACTION_TYPES.LOGOUT,
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          code: 'LOGOUT_ERROR',
          message: error.message
        });
      }
      throw error;
    }
  }
);

// Export action type constants for reducer consumption
export const AUTH_ACTIONS = {
  LOGIN: loginUser.typePrefix,
  VERIFY_MFA: verifyMFACode.typePrefix,
  REFRESH_SESSION: refreshUserSession.typePrefix,
  LOGOUT: logoutUser.typePrefix
} as const;

// Export action status types for component consumption
export const AUTH_STATUS = {
  LOGIN_PENDING: loginUser.pending.type,
  LOGIN_FULFILLED: loginUser.fulfilled.type,
  LOGIN_REJECTED: loginUser.rejected.type,
  MFA_PENDING: verifyMFACode.pending.type,
  MFA_FULFILLED: verifyMFACode.fulfilled.type,
  MFA_REJECTED: verifyMFACode.rejected.type,
  REFRESH_PENDING: refreshUserSession.pending.type,
  REFRESH_FULFILLED: refreshUserSession.fulfilled.type,
  REFRESH_REJECTED: refreshUserSession.rejected.type,
  LOGOUT_PENDING: logoutUser.pending.type,
  LOGOUT_FULFILLED: logoutUser.fulfilled.type,
  LOGOUT_REJECTED: logoutUser.rejected.type
} as const;