/**
 * API Utilities for MGA Operating System
 * Provides comprehensive request/response handling, error management, and retry logic
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import {
  API_BASE_URL,
  API_HEADERS,
  API_RATE_LIMITS,
  HTTP_STATUS
} from '../constants/api.constants';
import { StorageUtils } from '../utils/storage.utils';
import { v4 as uuidv4 } from 'uuid';

// Global constants for retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Types for error handling
interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
  timestamp?: number;
}

interface RetryConfig {
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: AxiosError;
}

interface RequestWithRetry extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

interface RequestDeduplicationConfig {
  cacheKey: string;
  ttl: number;
}

/**
 * Validates API response data against expected schema
 */
export function validateResponse(response: AxiosResponse): boolean {
  if (!response || !response.data) {
    return false;
  }

  // Basic validation checks
  const hasValidStatus = response.status >= 200 && response.status < 300;
  const hasValidData = typeof response.data === 'object';
  const hasRequiredHeaders = response.headers['content-type']?.includes('application/json');

  return hasValidStatus && hasValidData && hasRequiredHeaders;
}

/**
 * Creates a circuit breaker for API endpoints
 */
export function createCircuitBreaker(config: CircuitBreakerConfig) {
  let failures = 0;
  let lastFailureTime: number | null = null;
  const { failureThreshold, resetTimeout } = config;

  return {
    recordFailure() {
      failures++;
      lastFailureTime = Date.now();
    },
    isOpen() {
      if (failures >= failureThreshold) {
        if (lastFailureTime && Date.now() - lastFailureTime >= resetTimeout) {
          failures = 0;
          lastFailureTime = null;
          return false;
        }
        return true;
      }
      return false;
    },
    reset() {
      failures = 0;
      lastFailureTime = null;
    }
  };
}

/**
 * Generates a unique correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Implements request deduplication to prevent duplicate API calls
 */
export function deduplicateRequest(config: RequestDeduplicationConfig) {
  const cache = new Map<string, { data: any; timestamp: number }>();
  const { cacheKey, ttl } = config;

  return {
    set(data: any) {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    },
    get() {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
      cache.delete(cacheKey);
      return null;
    },
    clear() {
      cache.delete(cacheKey);
    }
  };
}

/**
 * Creates an Axios request interceptor for authentication and request preparation
 */
export function createRequestInterceptor(axiosInstance: AxiosInstance): number {
  return axiosInstance.interceptors.request.use(
    async (config) => {
      try {
        const tokens = await StorageUtils.getAuthTokens();
        if (tokens?.accessToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }

        const headers = new AxiosHeaders({
          ...API_HEADERS,
          'X-Correlation-ID': uuidv4(),
          'X-Request-Time': new Date().toISOString()
        });

        const endpoint = (config.url?.split('/')[1] || 'DEFAULT') as keyof typeof API_RATE_LIMITS;
        const rateLimit = API_RATE_LIMITS[endpoint] ?? API_RATE_LIMITS.DEFAULT;
        headers.set('X-Rate-Limit', rateLimit.toString());

        if (config.data) {
          const payloadSize = new Blob([JSON.stringify(config.data)]).size;
          if (payloadSize > 10 * 1024 * 1024) {
            throw new Error('Request payload size exceeds limit');
          }
        }

        config.headers = headers;
        return config;
      } catch (error) {
        return Promise.reject(error);
      }
    },
    (error) => Promise.reject(error)
  );
}

/**
 * Creates an Axios response interceptor for error handling and response processing
 */
export function createResponseInterceptor(axiosInstance: AxiosInstance): number {
  return axiosInstance.interceptors.response.use(
    (response) => {
      const processedResponse = {
        ...response,
        metadata: {
          correlationId: response.headers['x-correlation-id'],
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - new Date(response.config.headers['X-Request-Time'] as string).getTime()
        }
      };

      return processedResponse;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as RequestWithRetry | undefined;
      if (!originalRequest) {
        return Promise.reject(error);
      }

      if (error.response?.status === HTTP_STATUS.UNAUTHORIZED && !originalRequest._retry) {
        originalRequest._retry = true;
        const tokens = await StorageUtils.getAuthTokens();
        
        if (tokens?.refreshToken) {
          try {
            const response = await axiosInstance.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken: tokens.refreshToken
            });
            
            if (response.data?.accessToken) {
              return axiosInstance(originalRequest as AxiosRequestConfig);
            }
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }
      }

      if (
        !originalRequest._retry &&
        RETRYABLE_STATUS_CODES.includes(error.response?.status || 0)
      ) {
        return retryRequest(error);
      }

      return Promise.reject(handleApiError(error));
    }
  );
}

/**
 * Processes API errors into a standardized format
 */
export function handleApiError(error: AxiosError): ApiError {
  const correlationId = error.config?.headers?.['X-Correlation-ID'] as string || uuidv4();
  
  const apiError: ApiError = {
    code: 'API_ERROR',
    message: 'An unexpected error occurred',
    correlationId,
    timestamp: Date.now(),
    details: {}
  };

  if (error.response) {
    apiError.code = `HTTP_${error.response.status}`;
    apiError.message = (error.response.data as { message?: string })?.message || error.message;
    apiError.details = {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      headers: error.response.headers
    };
  } else if (error.request) {
    apiError.code = 'NETWORK_ERROR';
    apiError.message = 'Network error occurred';
    apiError.details = {
      request: error.request,
      config: error.config
    };
  }

  console.error('API Error:', {
    correlationId,
    error: apiError,
    originalError: error
  });

  return apiError;
}

/**
 * Implements retry logic with exponential backoff
 */
export async function retryRequest(
  error: AxiosError,
  retryCount = 0
): Promise<AxiosResponse> {
  const config = error.config;
  
  if (!config || retryCount >= MAX_RETRY_ATTEMPTS) {
    return Promise.reject(error);
  }

  const retryConfig: RetryConfig = {
    attempt: retryCount + 1,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    delay: RETRY_DELAY_MS * Math.pow(2, retryCount),
    error
  };

  if (error.response?.status === HTTP_STATUS.RATE_LIMIT) {
    const retryAfter = parseInt(error.response.headers['retry-after'] || '0', 10);
    retryConfig.delay = (retryAfter || 60) * 1000;
  }

  console.info('Retrying request:', {
    url: config.url,
    attempt: retryConfig.attempt,
    delay: retryConfig.delay,
    correlationId: config.headers?.['X-Correlation-ID']
  });

  await new Promise(resolve => setTimeout(resolve, retryConfig.delay));

  const headers = new AxiosHeaders({
    ...config.headers,
    'X-Retry-Count': retryConfig.attempt.toString(),
    'X-Request-Time': new Date().toISOString()
  });

  config.headers = headers;

  try {
    return await axios(config);
  } catch (retryError) {
    return retryRequest(retryError as AxiosError, retryConfig.attempt);
  }
}