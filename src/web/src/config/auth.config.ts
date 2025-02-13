/**
 * Authentication configuration for MGA Operating System web application
 * Defines Okta SSO settings, token management, and security parameters
 * @version 1.0.0
 */

import { OktaAuth } from '@okta/okta-auth-js'; // v7.4.1
import type { AuthTokens } from '../types/auth.types';

/**
 * Interface for environment-specific Okta configuration
 */
interface OktaConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  responseType: string[];
  pkce: boolean;
  tokenManager: {
    storage: 'cookie' | 'memory';
    autoRenew: boolean;
    expireEarlySeconds: number;
    storageKey: string;
    secure: boolean;
  };
  cookies: {
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
  };
}

/**
 * Interface for enhanced authentication configuration
 */
interface AuthConfig {
  tokenExpiryBuffer: number;
  refreshTokenExpiryBuffer: number;
  mfaEnabled: boolean;
  sessionTimeout: number;
  maxRetries: number;
  lockoutDuration: number;
}

/**
 * Returns environment-specific Okta client configuration with enhanced security
 */
export const getOktaConfig = (): OktaConfig => {
  const env = process.env.NODE_ENV || 'development';
  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.OKTA_CLIENT_ID;
  const redirectUri = process.env.OKTA_REDIRECT_URI;

  if (!domain || !clientId || !redirectUri) {
    throw new Error('Required Okta configuration values are missing');
  }

  const baseConfig: OktaConfig = {
    issuer: `https://${domain}/oauth2/default`,
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    responseType: ['code'],
    pkce: true,
    tokenManager: {
      storage: 'cookie',
      autoRenew: true,
      expireEarlySeconds: 120,
      storageKey: 'mga_os_tokens',
      secure: true
    },
    cookies: {
      secure: true,
      sameSite: 'strict'
    }
  };

  // Environment-specific overrides
  switch (env) {
    case 'production':
      baseConfig.cookies.domain = '.mgaos.com';
      break;
    case 'staging':
      baseConfig.cookies.domain = '.staging.mgaos.com';
      break;
    case 'development':
      baseConfig.cookies.secure = false;
      baseConfig.cookies.sameSite = 'lax';
      break;
  }

  return baseConfig;
};

/**
 * Returns enhanced authentication configuration with security parameters
 */
export const getAuthConfig = (): AuthConfig => {
  const env = process.env.NODE_ENV || 'development';

  const baseConfig: AuthConfig = {
    tokenExpiryBuffer: 300, // 5 minutes in seconds
    refreshTokenExpiryBuffer: 86400, // 24 hours in seconds
    mfaEnabled: true,
    sessionTimeout: 3600, // 1 hour in seconds
    maxRetries: 3,
    lockoutDuration: 900 // 15 minutes in seconds
  };

  // Environment-specific overrides
  switch (env) {
    case 'production':
      baseConfig.sessionTimeout = 1800; // 30 minutes in seconds
      break;
    case 'staging':
      baseConfig.sessionTimeout = 3600; // 1 hour in seconds
      break;
    case 'development':
      baseConfig.sessionTimeout = 86400; // 24 hours in seconds
      baseConfig.mfaEnabled = false;
      break;
  }

  return baseConfig;
};

// Export configuration instances
export const OKTA_CONFIG = getOktaConfig();
export const AUTH_CONFIG = getAuthConfig();

/**
 * Initialize Okta Auth client with configuration
 * Note: This should be instantiated only once in the application
 */
export const oktaAuth = new OktaAuth(OKTA_CONFIG);

/**
 * Utility function to check if access token needs refresh
 * @param tokens Current authentication tokens
 * @returns boolean indicating if refresh is needed
 */
export const needsTokenRefresh = (tokens: AuthTokens): boolean => {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime + AUTH_CONFIG.tokenExpiryBuffer >= tokens.expiresIn;
};

/**
 * Constants for authentication-related values
 */
export const AUTH_CONSTANTS = {
  TOKEN_STORAGE_KEY: 'mga_os_tokens',
  SESSION_STORAGE_KEY: 'mga_os_session',
  MFA_TIMEOUT: 300, // 5 minutes in seconds
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_COMPLEXITY_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
  LOCKOUT_KEY: 'mga_os_lockout',
  RETRY_COUNT_KEY: 'mga_os_retry_count'
} as const;