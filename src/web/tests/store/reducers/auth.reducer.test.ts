import { describe, it, expect, beforeEach } from '@jest/globals';
import authReducer from '../../../src/store/reducers/auth.reducer';
import { 
  loginUser, 
  verifyMFACode, 
  refreshUserSession, 
  logoutUser,
  trackSecurityEvent,
  validateDeviceFingerprint
} from '../../../src/store/actions/auth.actions';
import { 
  AuthState, 
  User, 
  AuthResponse, 
  SecurityEvent,
  DeviceContext 
} from '../../../src/types/auth.types';

describe('Auth Reducer', () => {
  // Mock data setup
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'MGA_ADMIN',
    permissions: ['READ_POLICY', 'WRITE_POLICY'],
    mfaEnabled: true,
    lastLoginAt: new Date().toISOString(),
    securityPreferences: {
      mfaMethod: 'APP',
      sessionTimeout: 3600
    }
  };

  const mockDeviceContext: DeviceContext = {
    fingerprint: 'mock-device-fingerprint',
    userAgent: 'mock-user-agent',
    ipAddress: '127.0.0.1',
    lastVerifiedAt: new Date().toISOString(),
    trustStatus: 'VERIFIED'
  };

  const mockSecurityEvent: SecurityEvent = {
    type: 'LOGIN_ATTEMPT',
    timestamp: new Date().toISOString(),
    status: 'SUCCESS',
    deviceContext: mockDeviceContext,
    metadata: {
      attemptNumber: 1,
      location: 'US-East'
    }
  };

  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600
    },
    requiresMFA: false,
    deviceContext: mockDeviceContext,
    securityEvents: [mockSecurityEvent]
  };

  let initialState: AuthState;

  beforeEach(() => {
    initialState = {
      status: 'unauthenticated',
      user: null,
      loading: false,
      error: null,
      lastActivity: Date.now(),
      securityEvents: [],
      deviceContext: null
    };
  });

  // Login flow tests
  describe('Login Flow', () => {
    it('should handle loginUser.pending', () => {
      const nextState = authReducer(initialState, loginUser.pending);
      expect(nextState.loading).toBe(true);
      expect(nextState.error).toBeNull();
      expect(nextState.securityEvents).toHaveLength(1);
      expect(nextState.securityEvents[0].type).toBe('LOGIN_ATTEMPTED');
    });

    it('should handle loginUser.fulfilled without MFA', () => {
      const nextState = authReducer(initialState, loginUser.fulfilled(mockAuthResponse, '', { email: 'test@example.com', password: 'password' }));
      expect(nextState.loading).toBe(false);
      expect(nextState.user).toEqual(mockUser);
      expect(nextState.status).toBe('authenticated');
      expect(nextState.deviceContext).toEqual(mockDeviceContext);
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'LOGIN_SUCCESSFUL' }));
    });

    it('should handle loginUser.fulfilled with MFA required', () => {
      const mfaResponse = { ...mockAuthResponse, requiresMFA: true };
      const nextState = authReducer(initialState, loginUser.fulfilled(mfaResponse, '', { email: 'test@example.com', password: 'password' }));
      expect(nextState.status).toBe('mfa_required');
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'LOGIN_SUCCESSFUL', details: { requiresMFA: true } }));
    });

    it('should handle loginUser.rejected', () => {
      const error = { code: 'AUTH_ERROR', message: 'Invalid credentials' };
      const nextState = authReducer(initialState, loginUser.rejected(null, '', { email: 'test@example.com', password: 'password' }, error));
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toEqual(error);
      expect(nextState.status).toBe('unauthenticated');
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'LOGIN_FAILED' }));
    });
  });

  // MFA verification tests
  describe('MFA Verification', () => {
    const mfaState = {
      ...initialState,
      status: 'mfa_required',
      user: mockUser
    };

    it('should handle verifyMFACode.pending', () => {
      const nextState = authReducer(mfaState, verifyMFACode.pending);
      expect(nextState.loading).toBe(true);
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'MFA_VERIFICATION_ATTEMPTED' }));
    });

    it('should handle verifyMFACode.fulfilled', () => {
      const nextState = authReducer(mfaState, verifyMFACode.fulfilled(mockAuthResponse, '', { code: '123456', method: 'APP', sessionToken: 'session-token' }));
      expect(nextState.status).toBe('authenticated');
      expect(nextState.user).toEqual(mockUser);
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'MFA_VERIFICATION_SUCCESSFUL' }));
    });

    it('should handle verifyMFACode.rejected', () => {
      const error = { code: 'MFA_ERROR', message: 'Invalid MFA code' };
      const nextState = authReducer(mfaState, verifyMFACode.rejected(null, '', { code: '123456', method: 'APP', sessionToken: 'session-token' }, error));
      expect(nextState.error).toEqual(error);
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'MFA_VERIFICATION_FAILED' }));
    });
  });

  // Session management tests
  describe('Session Management', () => {
    const authenticatedState = {
      ...initialState,
      status: 'authenticated',
      user: mockUser,
      deviceContext: mockDeviceContext
    };

    it('should handle refreshUserSession.pending', () => {
      const nextState = authReducer(authenticatedState, refreshUserSession.pending);
      expect(nextState.loading).toBe(true);
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'SESSION_REFRESH_ATTEMPTED' }));
    });

    it('should handle refreshUserSession.fulfilled', () => {
      const nextState = authReducer(authenticatedState, refreshUserSession.fulfilled(mockAuthResponse.tokens, '', 'refresh-token'));
      expect(nextState.lastActivity).toBeDefined();
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'SESSION_REFRESH_SUCCESSFUL' }));
    });

    it('should handle refreshUserSession.rejected', () => {
      const error = { code: 'REFRESH_ERROR', message: 'Session expired' };
      const nextState = authReducer(authenticatedState, refreshUserSession.rejected(null, '', 'refresh-token', error));
      expect(nextState.status).toBe('unauthenticated');
      expect(nextState.user).toBeNull();
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'SESSION_REFRESH_FAILED' }));
    });
  });

  // Security event tracking tests
  describe('Security Event Tracking', () => {
    it('should track security events', () => {
      const nextState = authReducer(initialState, trackSecurityEvent(mockSecurityEvent));
      expect(nextState.securityEvents).toContainEqual(mockSecurityEvent);
    });

    it('should maintain security event history', () => {
      let state = authReducer(initialState, trackSecurityEvent(mockSecurityEvent));
      const secondEvent = { ...mockSecurityEvent, type: 'DEVICE_VERIFIED' };
      state = authReducer(state, trackSecurityEvent(secondEvent));
      expect(state.securityEvents).toHaveLength(2);
      expect(state.securityEvents).toContainEqual(secondEvent);
    });
  });

  // Device fingerprint validation tests
  describe('Device Fingerprint Validation', () => {
    it('should handle device fingerprint validation', () => {
      const nextState = authReducer(initialState, validateDeviceFingerprint(mockDeviceContext));
      expect(nextState.deviceContext).toEqual(mockDeviceContext);
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'DEVICE_VALIDATED' }));
    });

    it('should handle untrusted device detection', () => {
      const untrustedDevice = { ...mockDeviceContext, trustStatus: 'UNTRUSTED' };
      const nextState = authReducer(initialState, validateDeviceFingerprint(untrustedDevice));
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'UNTRUSTED_DEVICE_DETECTED' }));
    });
  });

  // Logout tests
  describe('Logout', () => {
    const authenticatedState = {
      ...initialState,
      status: 'authenticated',
      user: mockUser,
      deviceContext: mockDeviceContext
    };

    it('should handle logoutUser.fulfilled', () => {
      const nextState = authReducer(authenticatedState, logoutUser.fulfilled);
      expect(nextState.status).toBe('unauthenticated');
      expect(nextState.user).toBeNull();
      expect(nextState.deviceContext).toBeNull();
      expect(nextState.securityEvents).toContainEqual(expect.objectContaining({ type: 'LOGOUT_SUCCESSFUL' }));
    });
  });
});