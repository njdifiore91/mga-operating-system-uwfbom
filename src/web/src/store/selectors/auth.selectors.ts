/**
 * Redux selectors for accessing authentication state in the MGA Operating System
 * Implements memoized selectors for user data, authentication status, tokens, and error states
 * @version 1.0.0
 */

import { createSelector } from '@reduxjs/toolkit'; // v1.9.5
import type { RootState } from '../store';
import type { AuthState, User, AuthStatus } from '../../types/auth.types';

/**
 * Base selector for accessing the complete authentication state slice
 */
export const selectAuthState = (state: RootState): AuthState => state.auth;

/**
 * Memoized selector for current authentication status including MFA state
 */
export const selectAuthStatus = createSelector(
  [selectAuthState],
  (auth): AuthStatus => auth.status
);

/**
 * Memoized selector for accessing current user data with null safety
 */
export const selectCurrentUser = createSelector(
  [selectAuthState],
  (auth): User | null => auth.user
);

/**
 * Memoized selector for accessing current user's role
 * Used for role-based access control (RBAC)
 */
export const selectUserRole = createSelector(
  [selectCurrentUser],
  (user): string | null => user?.role || null
);

/**
 * Memoized selector for accessing current user's permissions array
 * Used for granular access control
 */
export const selectUserPermissions = createSelector(
  [selectCurrentUser],
  (user): readonly string[] => user?.permissions || []
);

/**
 * Memoized selector for authentication loading state
 * Used for displaying loading indicators during auth operations
 */
export const selectAuthLoading = createSelector(
  [selectAuthState],
  (auth): boolean => auth.loading
);

/**
 * Memoized selector for authentication error state
 * Used for displaying error messages and handling error states
 */
export const selectAuthError = createSelector(
  [selectAuthState],
  (auth): string | null => auth.error?.message || null
);

/**
 * Memoized selector for checking if user has specific permission
 * @param permission Permission code to check
 */
export const createPermissionSelector = (permission: string) =>
  createSelector(
    [selectUserPermissions],
    (permissions): boolean => permissions.includes(permission)
  );

/**
 * Memoized selector for last activity timestamp
 * Used for session timeout monitoring
 */
export const selectLastActivity = createSelector(
  [selectAuthState],
  (auth): number => auth.lastActivity
);

/**
 * Memoized selector for session timeout value
 * Used for configuring session timeout warnings
 */
export const selectSessionTimeout = createSelector(
  [selectAuthState],
  (auth): number | null => (auth as any).sessionTimeout || null
);

/**
 * Memoized selector for checking if MFA is required
 * Used for conditional rendering of MFA verification UI
 */
export const selectMFARequired = createSelector(
  [selectAuthStatus],
  (status): boolean => status === 'mfa_required'
);

/**
 * Memoized selector for checking if user is fully authenticated
 * Includes both token and MFA verification checks
 */
export const selectIsFullyAuthenticated = createSelector(
  [selectAuthStatus],
  (status): boolean => status === 'authenticated'
);

/**
 * Memoized selector for checking if session is active
 * Combines authentication and timeout checks
 */
export const selectIsSessionActive = createSelector(
  [selectIsFullyAuthenticated, selectLastActivity, selectSessionTimeout],
  (isAuthenticated, lastActivity, timeout): boolean => {
    if (!isAuthenticated || !timeout) return false;
    return Date.now() - lastActivity < timeout;
  }
);