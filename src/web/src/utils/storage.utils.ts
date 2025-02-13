/**
 * Storage utility functions for managing browser storage in MGA Operating System
 * Provides secure, type-safe operations for storing authentication tokens and application state
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import { AuthTokens } from '../types/auth.types';

// Storage key constants
export const STORAGE_KEYS = {
  AUTH_TOKENS: 'mga_auth_tokens',
  USER_PREFERENCES: 'mga_user_prefs',
  THEME: 'mga_theme',
  LANGUAGE: 'mga_lang',
} as const;

// Custom events for storage monitoring
const STORAGE_EVENTS = {
  STORAGE_CHANGED: 'mga_storage_changed',
  TOKEN_EXPIRED: 'mga_token_expired',
  QUOTA_EXCEEDED: 'mga_quota_exceeded',
} as const;

// Environment variables
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY as string;

// Storage quota thresholds (in bytes)
const QUOTA_WARNING_THRESHOLD = 0.8; // 80% of available space
const MAX_ITEM_SIZE = 5 * 1024 * 1024; // 5MB limit per item

export namespace StorageUtils {
  /**
   * Sets an item in browser storage with optional encryption and compression
   * @param key Storage key
   * @param value Value to store
   * @param encrypt Whether to encrypt the data
   * @param useSession Use sessionStorage instead of localStorage
   * @param compress Whether to compress the data
   */
  export function setStorageItem<T>(
    key: string,
    value: T,
    encrypt = false,
    useSession = false,
    compress = false
  ): void {
    try {
      // Validate inputs
      if (!key || value === undefined) {
        throw new Error('Invalid storage parameters');
      }

      // Serialize value
      let serializedValue = JSON.stringify(value);

      // Compress if requested
      if (compress) {
        serializedValue = btoa(serializedValue);
      }

      // Encrypt if requested
      if (encrypt) {
        if (!ENCRYPTION_KEY) {
          throw new Error('Encryption key not configured');
        }
        serializedValue = CryptoJS.AES.encrypt(serializedValue, ENCRYPTION_KEY).toString();
      }

      // Check item size
      if (new Blob([serializedValue]).size > MAX_ITEM_SIZE) {
        throw new Error('Storage item exceeds size limit');
      }

      // Store the value
      const storage = useSession ? sessionStorage : localStorage;
      storage.setItem(key, serializedValue);

      // Emit storage change event
      window.dispatchEvent(
        new CustomEvent(STORAGE_EVENTS.STORAGE_CHANGED, {
          detail: { key, encrypted: encrypt }
        })
      );

    } catch (error) {
      console.error('Storage operation failed:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        window.dispatchEvent(new Event(STORAGE_EVENTS.QUOTA_EXCEEDED));
      }
      throw error;
    }
  }

  /**
   * Retrieves and optionally decrypts an item from storage with type safety
   * @param key Storage key
   * @param decrypt Whether to decrypt the data
   * @param useSession Use sessionStorage instead of localStorage
   * @returns Retrieved value with type T or null if not found
   */
  export function getStorageItem<T>(
    key: string,
    decrypt = false,
    useSession = false
  ): T | null {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const value = storage.getItem(key);

      if (!value) return null;

      let processedValue = value;

      // Decrypt if requested
      if (decrypt) {
        if (!ENCRYPTION_KEY) {
          throw new Error('Encryption key not configured');
        }
        const bytes = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
        processedValue = bytes.toString(CryptoJS.enc.Utf8);
      }

      // Decompress if value is base64 encoded
      if (processedValue.match(/^[A-Za-z0-9+/=]+$/)) {
        try {
          processedValue = atob(processedValue);
        } catch {
          // Value wasn't base64 encoded, continue with original
        }
      }

      return JSON.parse(processedValue) as T;
    } catch (error) {
      console.error('Storage retrieval failed:', error);
      return null;
    }
  }

  /**
   * Securely stores authentication tokens with automatic expiration handling
   * @param tokens Authentication tokens to store
   */
  export function setAuthTokens(tokens: AuthTokens): void {
    try {
      // Validate token structure
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.expiresIn) {
        throw new Error('Invalid token structure');
      }

      // Add metadata for expiration tracking
      const tokenData = {
        ...tokens,
        storedAt: Date.now(),
      };

      // Store encrypted tokens in session storage
      setStorageItem(
        STORAGE_KEYS.AUTH_TOKENS,
        tokenData,
        true, // encrypt
        true, // use session storage
        false // no compression
      );

      // Set up expiration timer
      setTimeout(() => {
        window.dispatchEvent(new Event(STORAGE_EVENTS.TOKEN_EXPIRED));
      }, tokens.expiresIn * 1000);

    } catch (error) {
      console.error('Token storage failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves and validates authentication tokens with expiration check
   * @returns Decrypted and validated auth tokens or null if expired/invalid
   */
  export function getAuthTokens(): AuthTokens | null {
    try {
      const tokenData = getStorageItem<AuthTokens & { storedAt: number }>(
        STORAGE_KEYS.AUTH_TOKENS,
        true, // decrypt
        true // use session storage
      );

      if (!tokenData) return null;

      // Check token expiration
      const elapsedTime = (Date.now() - tokenData.storedAt) / 1000;
      if (elapsedTime >= tokenData.expiresIn) {
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
        window.dispatchEvent(new Event(STORAGE_EVENTS.TOKEN_EXPIRED));
        return null;
      }

      // Return tokens without metadata
      const { storedAt, ...tokens } = tokenData;
      return tokens;

    } catch (error) {
      console.error('Token retrieval failed:', error);
      return null;
    }
  }

  /**
   * Sets up storage monitoring and cross-tab synchronization
   */
  export function initializeStorageMonitoring(): void {
    // Monitor storage changes across tabs
    window.addEventListener('storage', (event) => {
      if (event.key && Object.values(STORAGE_KEYS).includes(event.key)) {
        window.dispatchEvent(
          new CustomEvent(STORAGE_EVENTS.STORAGE_CHANGED, {
            detail: { key: event.key }
          })
        );
      }
    });

    // Monitor storage quota
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        if (quota && usage && usage / quota > QUOTA_WARNING_THRESHOLD) {
          window.dispatchEvent(new Event(STORAGE_EVENTS.QUOTA_EXCEEDED));
        }
      });
    }

    // Clean up expired tokens on initialization
    getAuthTokens(); // This will trigger cleanup if tokens are expired
  }
}