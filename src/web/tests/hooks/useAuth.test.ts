import { renderHook, act } from '@testing-library/react'; // v14.0.0
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.5.0
import { useAuth } from '../../src/hooks/useAuth';
import { AuthService } from '../../src/services/auth.service';
import * as Types from '../../src/types/auth.types';

// Mock AuthService
jest.mock('../../src/services/auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    authenticateUser: jest.fn(),
    completeMFAVerification: jest.fn(),
    refreshAccessToken: jest.fn(),
    validatePermission: jest.fn(),
    logSecurityEvent: jest.fn(),
    handleLogout: jest.fn()
  }))
}));

// Mock test data
const mockUser: Types.User = {
  id: 'test-user-id' as Types.UserId,
  email: 'test@example.com' as Types.Email,
  firstName: 'Test',
  lastName: 'User',
  role: 'MGA_ADMIN',
  permissions: ['CREATE_POLICY', 'APPROVE_CLAIMS'],
  mfaEnabled: true,
  mfaMethod: 'totp',
  lastLogin: new Date()
};

const mockTokens: Types.AuthTokens = {
  accessToken: 'mock-access-token' as Types.AccessToken,
  refreshToken: 'mock-refresh-token' as Types.RefreshToken,
  expiresIn: 3600,
  tokenType: 'Bearer',
  issuedAt: Date.now()
};

const mockAuthResponse: Types.AuthResponse = {
  user: mockUser,
  tokens: mockTokens,
  requiresMFA: true,
  sessionToken: 'mock-session-token' as Types.SessionToken,
  mfaOptions: ['totp', 'sms']
};

describe('useAuth Hook', () => {
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clean up event listeners
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('Authentication Flow', () => {
    test('should handle successful login with MFA requirement', async () => {
      mockAuthService.authenticateUser.mockResolvedValueOnce(mockAuthResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.login({
          email: 'test@example.com' as Types.Email,
          password: 'TestPassword123!' as Types.Password
        });

        expect(response).toEqual(mockAuthResponse);
        expect(result.current.authState.status).toBe('mfa_required');
        expect(result.current.authState.user).toEqual(mockUser);
      });
    });

    test('should handle successful MFA verification', async () => {
      const mfaResponse = { ...mockAuthResponse, requiresMFA: false };
      mockAuthService.completeMFAVerification.mockResolvedValueOnce(mfaResponse);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.verifyMFA({
          code: '123456',
          sessionToken: 'mock-session-token' as Types.SessionToken,
          method: 'totp'
        });

        expect(response).toEqual(mfaResponse);
        expect(result.current.authState.status).toBe('authenticated');
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    test('should handle automatic token refresh', async () => {
      const newTokens = { ...mockTokens, accessToken: 'new-access-token' as Types.AccessToken };
      mockAuthService.refreshAccessToken.mockResolvedValueOnce(newTokens);

      const { result } = renderHook(() => useAuth());

      // Fast-forward until token refresh
      await act(async () => {
        jest.advanceTimersByTime(3300000); // 55 minutes
      });

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalled();
    });

    test('should handle logout correctly', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.authState.status).toBe('unauthenticated');
      expect(result.current.authState.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Security Features', () => {
    test('should validate permissions correctly', async () => {
      mockAuthService.validatePermission.mockReturnValueOnce(true);

      const { result } = renderHook(() => useAuth());

      // Set authenticated state
      await act(async () => {
        Object.defineProperty(result.current, 'authState', {
          value: { status: 'authenticated', user: mockUser }
        });
      });

      expect(result.current.checkPermission('CREATE_POLICY')).toBe(true);
      expect(mockAuthService.validatePermission).toHaveBeenCalledWith('CREATE_POLICY');
    });

    test('should handle session timeout', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // Simulate session timeout
        jest.advanceTimersByTime(3600000); // 1 hour
      });

      expect(result.current.authState.status).toBe('unauthenticated');
    });

    test('should handle invalid credentials', async () => {
      const errorMessage = 'Invalid credentials';
      mockAuthService.authenticateUser.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com' as Types.Email,
            password: 'wrong-password' as Types.Password
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe(errorMessage);
        }
      });

      expect(result.current.authState.error).toBeTruthy();
    });
  });

  describe('Activity Monitoring', () => {
    test('should update last activity on user interaction', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // Simulate user activity
        window.dispatchEvent(new MouseEvent('mousemove'));
      });

      expect(result.current.lastActivity).toBeTruthy();
      expect(result.current.authState.lastActivity).toBe(Date.now());
    });

    test('should handle cross-tab communication', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // Simulate storage event from another tab
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'mga_auth_tokens',
            newValue: JSON.stringify(mockTokens)
          })
        );
      });

      expect(result.current.authState.status).toBe('unauthenticated');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      mockAuthService.authenticateUser.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.login({
            email: 'test@example.com' as Types.Email,
            password: 'TestPassword123!' as Types.Password
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Network error');
        }
      });
    });

    test('should handle MFA verification failures', async () => {
      mockAuthService.completeMFAVerification.mockRejectedValueOnce(
        new Error('Invalid MFA code')
      );

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.verifyMFA({
            code: '000000',
            sessionToken: 'mock-session-token' as Types.SessionToken,
            method: 'totp'
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Invalid MFA code');
        }
      });
    });
  });
});