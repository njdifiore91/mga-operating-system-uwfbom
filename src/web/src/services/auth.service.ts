/**
 * Authentication Service for MGA Operating System
 * Implements secure authentication with OAuth 2.0 + OIDC, MFA support, and comprehensive security monitoring
 * @version 1.0.0
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs'; // v3.4.0
import { createLogger, format, transports } from 'winston'; // v3.8.2
import {
  LoginCredentials,
  MFAVerification,
  AuthResponse,
  User,
  AuthTokens,
  AuthError,
  AuthStatus
} from '../types/auth.types';
import { StorageUtils, STORAGE_KEYS } from '../utils/storage.utils';

// Security configuration constants
const AUTH_CONFIG = {
  TOKEN_REFRESH_THRESHOLD: 300, // Refresh tokens 5 minutes before expiry
  MAX_LOGIN_ATTEMPTS: 5,
  MFA_CODE_LENGTH: 6,
  PASSWORD_MIN_LENGTH: 12,
  SESSION_TIMEOUT: 3600000, // 1 hour in milliseconds
  API_BASE_URL: process.env.API_BASE_URL
} as const;

/**
 * Comprehensive authentication service implementing secure user authentication,
 * MFA verification, token management, and security monitoring
 */
export class AuthService {
  private currentTokens: AuthTokens | null = null;
  private currentUser: User | null = null;
  private deviceFingerprint: string = '';
  private loginAttempts: Map<string, number> = new Map();
  private tokenRefreshTimeout?: NodeJS.Timeout;
  private readonly storageUtils: typeof StorageUtils;

  // Security logger for audit tracking
  private readonly securityLogger = createLogger({
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
    transports: [
      new transports.File({ filename: 'security.log' }),
      new transports.Console({ level: 'warn' })
    ]
  });

  constructor() {
    this.storageUtils = StorageUtils;
    this.initializeService();
  }

  /**
   * Initializes the authentication service with security features
   */
  private async initializeService(): Promise<void> {
    try {
      // Generate device fingerprint for enhanced security
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      this.deviceFingerprint = result.visitorId;

      // Load existing session if available
      const storedTokens = this.storageUtils.getAuthTokens();
      if (storedTokens) {
        this.currentTokens = storedTokens;
        this.setupTokenRefresh();
      }

      // Set up storage monitoring
      this.storageUtils.initializeStorageMonitoring();

      this.securityLogger.info('AuthService initialized successfully', {
        deviceFingerprint: this.deviceFingerprint
      });
    } catch (error) {
      this.securityLogger.error('AuthService initialization failed', { error });
      throw error;
    }
  }

  /**
   * Authenticates user with credentials and handles MFA flow
   * @param credentials User login credentials
   * @returns Authentication response with tokens and MFA status
   */
  public async authenticateUser(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate login attempts
      this.validateLoginAttempts(credentials.email);

      // Validate credential format
      this.validateCredentials(credentials);

      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': this.deviceFingerprint
        },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        this.handleLoginFailure(credentials.email);
        throw await this.handleAuthError(response);
      }

      const authResponse: AuthResponse = await response.json();

      // Handle MFA if required
      if (authResponse.requiresMFA) {
        this.securityLogger.info('MFA required for user', {
          email: credentials.email,
          mfaOptions: authResponse.mfaOptions
        });
        return authResponse;
      }

      // Store tokens securely
      this.storageUtils.setAuthTokens(authResponse.tokens);
      this.currentTokens = authResponse.tokens;
      this.currentUser = authResponse.user;

      // Setup token refresh
      this.setupTokenRefresh();

      this.securityLogger.info('User authenticated successfully', {
        userId: authResponse.user.id,
        role: authResponse.user.role
      });

      return authResponse;
    } catch (error) {
      this.securityLogger.error('Authentication failed', { error });
      throw error;
    }
  }

  /**
   * Verifies MFA code and completes authentication
   * @param verification MFA verification details
   * @returns Complete authentication response
   */
  public async verifyMFA(verification: MFAVerification): Promise<AuthResponse> {
    try {
      this.validateMFACode(verification.code);

      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': verification.sessionToken,
          'X-Device-Fingerprint': this.deviceFingerprint
        },
        body: JSON.stringify(verification)
      });

      if (!response.ok) {
        throw await this.handleAuthError(response);
      }

      const authResponse: AuthResponse = await response.json();
      this.storageUtils.setAuthTokens(authResponse.tokens);
      this.currentTokens = authResponse.tokens;
      this.currentUser = authResponse.user;

      this.setupTokenRefresh();

      this.securityLogger.info('MFA verification successful', {
        userId: authResponse.user.id,
        method: verification.method
      });

      return authResponse;
    } catch (error) {
      this.securityLogger.error('MFA verification failed', { error });
      throw error;
    }
  }

  /**
   * Handles secure token refresh process
   */
  private async handleTokenRefresh(): Promise<void> {
    try {
      if (!this.currentTokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': this.deviceFingerprint
        },
        body: JSON.stringify({
          refreshToken: this.currentTokens.refreshToken
        })
      });

      if (!response.ok) {
        throw await this.handleAuthError(response);
      }

      const newTokens: AuthTokens = await response.json();
      this.storageUtils.setAuthTokens(newTokens);
      this.currentTokens = newTokens;

      this.setupTokenRefresh();

      this.securityLogger.info('Token refresh successful', {
        userId: this.currentUser?.id
      });
    } catch (error) {
      this.securityLogger.error('Token refresh failed', { error });
      this.handleLogout();
    }
  }

  /**
   * Sets up automatic token refresh before expiry
   */
  private setupTokenRefresh(): void {
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }

    if (!this.currentTokens?.expiresIn) return;

    const refreshTime = (this.currentTokens.expiresIn - AUTH_CONFIG.TOKEN_REFRESH_THRESHOLD) * 1000;
    this.tokenRefreshTimeout = setTimeout(() => {
      this.handleTokenRefresh();
    }, refreshTime);
  }

  /**
   * Handles user logout with token revocation
   */
  public async handleLogout(): Promise<void> {
    try {
      if (this.currentTokens?.accessToken) {
        await fetch(`${AUTH_CONFIG.API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.currentTokens.accessToken}`,
            'X-Device-Fingerprint': this.deviceFingerprint
          }
        });
      }

      if (this.tokenRefreshTimeout) {
        clearTimeout(this.tokenRefreshTimeout);
      }

      sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
      const userId = this.currentUser?.id;
      this.currentTokens = null;
      this.currentUser = null;

      this.securityLogger.info('User logged out successfully', {
        userId
      });
    } catch (error) {
      this.securityLogger.error('Logout failed', { error });
      throw error;
    }
  }

  // Utility methods
  private validateLoginAttempts(email: string): void {
    const attempts = this.loginAttempts.get(email) || 0;
    if (attempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
      throw new Error('Account temporarily locked due to multiple failed attempts');
    }
  }

  private handleLoginFailure(email: string): void {
    const attempts = (this.loginAttempts.get(email) || 0) + 1;
    this.loginAttempts.set(email, attempts);
  }

  private validateCredentials(credentials: LoginCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw new Error('Invalid credentials format');
    }
    if (credentials.password.length < AUTH_CONFIG.PASSWORD_MIN_LENGTH) {
      throw new Error('Password does not meet minimum requirements');
    }
  }

  private validateMFACode(code: string): void {
    if (!code || code.length !== AUTH_CONFIG.MFA_CODE_LENGTH) {
      throw new Error('Invalid MFA code format');
    }
  }

  private async handleAuthError(response: Response): Promise<AuthError> {
    const error = await response.json();
    return {
      code: error.code || 'AUTH_ERROR',
      message: error.message || 'Authentication failed'
    };
  }

  // Public getters
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return !!this.currentTokens && !!this.currentUser;
  }

  public getAuthStatus(): AuthStatus {
    if (!this.currentTokens) return 'unauthenticated';
    if (!this.currentUser) return 'mfa_required';
    return 'authenticated';
  }
}

export const authService = new AuthService();