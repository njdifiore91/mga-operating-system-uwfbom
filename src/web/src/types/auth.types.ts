/**
 * Type definitions for authentication-related interfaces and types
 * Used throughout the MGA Operating System web application
 * @version 1.0.0
 */

// Branded type utilities
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

// Branded types for enhanced type safety
type Email = Brand<string, 'Email'>;
type Password = Brand<string, 'Password'>;
type SessionToken = Brand<string, 'SessionToken'>;
type ResetToken = Brand<string, 'ResetToken'>;
type AccessToken = Brand<string, 'AccessToken'>;
type RefreshToken = Brand<string, 'RefreshToken'>;
type UserId = Brand<string, 'UserId'>;

// Utility functions to create branded types
export const createEmail = (value: string): Email => value as Email;
export const createPassword = (value: string): Password => value as Password;
export const createSessionToken = (value: string): SessionToken => value as SessionToken;
export const createResetToken = (value: string): ResetToken => value as ResetToken;
export const createAccessToken = (value: string): AccessToken => value as AccessToken;
export const createRefreshToken = (value: string): RefreshToken => value as RefreshToken;
export const createUserId = (value: string): UserId => value as UserId;

/**
 * Type-safe interface for user login credentials
 */
export interface LoginCredentials {
  email: Email;
  password: Password;
}

/**
 * Interface for MFA verification with support for multiple authentication methods
 */
export interface MFAVerification {
  code: string;
  sessionToken: SessionToken;
  method: 'totp' | 'sms' | 'email';
}

/**
 * Type-safe interface for password reset functionality
 */
export interface PasswordReset {
  token: ResetToken;
  newPassword: Password;
  confirmPassword: Password;
}

/**
 * Comprehensive interface for JWT token management with expiry tracking
 */
export interface AuthTokens {
  accessToken: AccessToken;
  refreshToken: RefreshToken;
  expiresIn: number;
  tokenType: 'Bearer';
  issuedAt: number;
}

/**
 * Type definition for available user roles based on RBAC requirements
 */
export type UserRole = 'MGA_ADMIN' | 'UNDERWRITER' | 'CLAIMS_HANDLER' | 'AUDITOR';

/**
 * Comprehensive interface for authenticated user data with RBAC support
 */
export interface User {
  id: UserId;
  email: Email;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: readonly string[];
  mfaEnabled: boolean;
  mfaMethod: 'totp' | 'sms' | 'email' | null;
  lastLogin: Date;
}

/**
 * Interface for authentication response with MFA support
 */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  requiresMFA: boolean;
  sessionToken: SessionToken;
  mfaOptions: readonly ('totp' | 'sms' | 'email')[];
}

/**
 * Authentication status types
 */
export type AuthStatus =
  | 'unauthenticated'
  | 'authenticated'
  | 'mfa_required'
  | 'mfa_setup_required'
  | 'password_reset_required';

/**
 * Error interface for authentication errors
 */
export interface AuthError {
  code: string;
  message: string;
}

/**
 * Interface for security event logging
 */
export interface SecurityEvent {
  timestamp: Date;
  eventType: 'login' | 'logout' | 'mfa_attempt' | 'password_reset' | 'access_denied';
  userId?: UserId;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, unknown>;
}

/**
 * Comprehensive type for authentication state management with activity tracking
 */
export interface AuthState {
  status: AuthStatus;
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  lastActivity: number;
}

// Type guard utilities
export const isAuthError = (error: unknown): error is AuthError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
};

export const isValidUserRole = (role: string): role is UserRole => {
  return ['MGA_ADMIN', 'UNDERWRITER', 'CLAIMS_HANDLER', 'AUDITOR'].includes(role);
};