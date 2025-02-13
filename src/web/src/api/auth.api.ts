/**
 * Authentication API implementation for MGA Operating System
 * Provides secure authentication endpoints with OAuth 2.0 + OIDC, MFA support,
 * and comprehensive security measures
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios'; // ^1.4.0
import { apiClient } from '../config/api.config';
import { SecurityLogger } from '@mga/security-logger'; // ^2.0.0
import { SecurityUtils } from '@mga/security-utils'; // ^1.0.0
import {
  LoginCredentials,
  MFAVerification,
  PasswordReset,
  AuthResponse,
  AuthTokens,
  AuthError
} from '../types/auth.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// Initialize security logger
const securityLogger = new SecurityLogger({
  service: 'auth-api',
  version: '1.0.0'
});

/**
 * Authentication API interface with comprehensive security features
 */
export const AuthAPI = {
  /**
   * Authenticates user with email/password and handles MFA flow
   * @param credentials User login credentials
   * @returns Authentication response with tokens and MFA status
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate and sanitize credentials
      SecurityUtils.validateLoginCredentials(credentials);
      
      // Encrypt sensitive data
      const encryptedPayload = SecurityUtils.encryptPayload(credentials);

      // Attempt authentication
      const response: AxiosResponse<AuthResponse> = await apiClient.post(
        API_ENDPOINTS.AUTH.LOGIN,
        encryptedPayload,
        {
          headers: {
            'X-Request-Source': 'web-client',
            'X-Client-Version': process.env.REACT_APP_VERSION
          }
        }
      );

      // Log successful authentication attempt
      securityLogger.logAuthEvent({
        type: 'LOGIN_ATTEMPT',
        success: true,
        email: credentials.email,
        requiresMFA: response.data.requiresMFA
      });

      return response.data;
    } catch (error) {
      // Log failed authentication attempt
      securityLogger.logAuthEvent({
        type: 'LOGIN_ATTEMPT',
        success: false,
        email: credentials.email,
        error: error as AuthError
      });

      throw error;
    }
  },

  /**
   * Verifies MFA code using configured verification method
   * @param verification MFA verification details
   * @returns Final authentication response after MFA
   */
  async verifyMFA(verification: MFAVerification): Promise<AuthResponse> {
    try {
      // Validate MFA code format
      SecurityUtils.validateMFACode(verification.code);

      const response: AxiosResponse<AuthResponse> = await apiClient.post(
        API_ENDPOINTS.AUTH.VERIFY_MFA,
        verification,
        {
          headers: {
            'X-Session-Token': verification.sessionToken
          }
        }
      );

      // Log successful MFA verification
      securityLogger.logAuthEvent({
        type: 'MFA_VERIFICATION',
        success: true,
        method: verification.method
      });

      return response.data;
    } catch (error) {
      // Log failed MFA verification
      securityLogger.logAuthEvent({
        type: 'MFA_VERIFICATION',
        success: false,
        method: verification.method,
        error: error as AuthError
      });

      throw error;
    }
  },

  /**
   * Refreshes access token using refresh token with rotation
   * @param refreshToken Current refresh token
   * @returns New token pair
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Validate refresh token format
      SecurityUtils.validateToken(refreshToken);

      const response: AxiosResponse<AuthTokens> = await apiClient.post(
        API_ENDPOINTS.AUTH.REFRESH,
        { refreshToken }
      );

      // Log token refresh
      securityLogger.logAuthEvent({
        type: 'TOKEN_REFRESH',
        success: true
      });

      return response.data;
    } catch (error) {
      // Log failed token refresh
      securityLogger.logAuthEvent({
        type: 'TOKEN_REFRESH',
        success: false,
        error: error as AuthError
      });

      throw error;
    }
  },

  /**
   * Securely logs out user and invalidates tokens
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);

      // Log successful logout
      securityLogger.logAuthEvent({
        type: 'LOGOUT',
        success: true
      });
    } catch (error) {
      // Log failed logout attempt
      securityLogger.logAuthEvent({
        type: 'LOGOUT',
        success: false,
        error: error as AuthError
      });

      throw error;
    }
  },

  /**
   * Initiates password reset process with rate limiting
   * @param email User email address
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      // Validate email format
      SecurityUtils.validateEmail(email);

      await apiClient.post(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        { email },
        {
          headers: {
            'X-Rate-Limit-Policy': 'password-reset'
          }
        }
      );

      // Log password reset request
      securityLogger.logAuthEvent({
        type: 'PASSWORD_RESET_REQUEST',
        success: true,
        email
      });
    } catch (error) {
      // Log failed password reset request
      securityLogger.logAuthEvent({
        type: 'PASSWORD_RESET_REQUEST',
        success: false,
        email,
        error: error as AuthError
      });

      throw error;
    }
  },

  /**
   * Resets user password with security token
   * @param resetData Password reset data with token
   */
  async resetPassword(resetData: PasswordReset): Promise<void> {
    try {
      // Validate password complexity
      SecurityUtils.validatePasswordComplexity(resetData.newPassword);

      // Validate token
      SecurityUtils.validateToken(resetData.token);

      await apiClient.put(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        resetData,
        {
          headers: {
            'X-Reset-Token': resetData.token
          }
        }
      );

      // Log successful password reset
      securityLogger.logAuthEvent({
        type: 'PASSWORD_RESET',
        success: true
      });
    } catch (error) {
      // Log failed password reset
      securityLogger.logAuthEvent({
        type: 'PASSWORD_RESET',
        success: false,
        error: error as AuthError
      });

      throw error;
    }
  }
};