/**
 * API Utilities for MGA Operating System
 * Provides comprehensive request/response handling, error management, and retry logic
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
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

// Custom type for retry tracking
interface RequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Creates an Axios request interceptor for authentication and request preparation
 * @param axiosInstance Axios instance to attach interceptor to
 * @returns Interceptor reference number
 */
export function createRequestInterceptor(axiosInstance: AxiosInstance): number {
  return axiosInstance.interceptors.request.use(
    async (config) => {
      try {
        // Get authentication tokens
        const tokens = await StorageUtils.getAuthTokens();
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }

        const headers = new AxiosHeaders({
          ...API_HEADERS,
          'X-Correlation-ID': uuidv4(),
          'X-Request-Time': new Date().toISOString()
        });

        if (config.headers.Authorization) {
          headers.set('Authorization', config.headers.Authorization);
        }

        config.headers = headers;

        // Add rate limiting metadata
        const endpoint = config.url?.split('/')[1] || 'DEFAULT';
        const rateLimit = API_RATE_LIMITS[endpoint as keyof typeof API_RATE_LIMITS] || API_RATE_LIMITS.DEFAULT;
        config.headers.set('X-Rate-Limit', rateLimit.toString());

        // Validate request payload
        if (config.data) {
          const payloadSize = new Blob([JSON.stringify(config.data)]).size;
          if (payloadSize > 10 * 1024 * 1024) { // 10MB limit
            throw new Error('Request payload size exceeds limit');
          }
        }

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
 * @param axiosInstance Axios instance to attach interceptor to
 * @returns Interceptor reference number
 */
export function createResponseInterceptor(axiosInstance: AxiosInstance): number {
  return axiosInstance.interceptors.response.use(
    (response) => {
      // Process successful response
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
      const originalRequest = error.config as RequestConfig;

      // Handle token refresh for 401 errors
      if (error.response?.status === HTTP_STATUS.UNAUTHORIZED && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        const tokens = await StorageUtils.getAuthTokens();
        
        if (tokens?.refreshToken) {
          try {
            const response = await axiosInstance.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken: tokens.refreshToken
            });
            
            if (response.data?.accessToken) {
              return axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }
      }

      // Handle retryable errors
      if (
        originalRequest &&
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
 * @param error AxiosError instance
 * @returns Standardized ApiError object
 */
export function handleApiError(error: AxiosError): ApiError {
  const correlationId = error.config?.headers?.['X-Correlation-ID'] || uuidv4();
  
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

  // Log error for monitoring
  console.error('API Error:', {
    correlationId,
    error: apiError,
    originalError: error
  });

  return apiError;
}

/**
 * Implements retry logic with exponential backoff
 * @param error AxiosError that triggered retry
 * @param retryCount Current retry attempt number
 * @returns Promise resolving to retry response
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

  // Handle rate limiting with specific delay
  if (error.response?.status === HTTP_STATUS.RATE_LIMIT) {
    const retryAfter = parseInt(error.response.headers['retry-after'] || '0', 10);
    retryConfig.delay = (retryAfter || 60) * 1000; // Convert to milliseconds
  }

  // Log retry attempt
  console.info('Retrying request:', {
    url: config.url,
    attempt: retryConfig.attempt,
    delay: retryConfig.delay,
    correlationId: config.headers?.['X-Correlation-ID']
  });

  // Wait for backoff delay
  await new Promise(resolve => setTimeout(resolve, retryConfig.delay));

  // Update retry metadata
  const headers = new AxiosHeaders({
    ...config.headers,
    'X-Retry-Count': retryConfig.attempt.toString(),
    'X-Request-Time': new Date().toISOString()
  });

  config.headers = headers;

  // Attempt retry
  try {
    return await axios(config);
  } catch (retryError) {
    return retryRequest(retryError as AxiosError, retryConfig.attempt);
  }
}