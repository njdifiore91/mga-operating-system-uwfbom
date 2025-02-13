/**
 * API Configuration for MGA Operating System
 * Configures the API client with enhanced security, monitoring, and reliability features
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // ^1.4.0
import {
  API_VERSION,
  API_BASE_URL,
  API_TIMEOUT,
  API_HEADERS,
  API_RATE_LIMITS
} from '../constants/api.constants';
import {
  createRequestInterceptor,
  createResponseInterceptor,
  handleApiError,
  retryRequest,
  validateResponse,
  createCircuitBreaker,
  generateCorrelationId,
  deduplicateRequest
} from '../utils/api.utils';

// Circuit breaker configuration
const circuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 60 seconds
  monitorInterval: 30000 // 30 seconds
} as const;

// Enhanced security headers
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
} as const;

/**
 * Creates and configures the API client with enhanced features
 * @returns Configured Axios instance
 */
function createApiClient(): AxiosInstance {
  // Create base axios instance
  const apiClient = axios.create({
    baseURL: `${API_BASE_URL}/v${API_VERSION}`,
    timeout: API_TIMEOUT,
    headers: {
      ...API_HEADERS,
      ...securityHeaders
    },
    // Response validation
    validateStatus: (status) => status >= 200 && status < 300,
    // Maximum redirects
    maxRedirects: 5,
    // Enable compression
    decompress: true,
    // Enable credentials
    withCredentials: true,
    // Response type
    responseType: 'json',
    // Request transformations
    transformRequest: [
      (data, headers) => {
        // Add correlation ID
        headers['X-Correlation-ID'] = generateCorrelationId();
        // Add timestamp
        headers['X-Request-Time'] = new Date().toISOString();
        // Transform request data
        return JSON.stringify(data);
      }
    ],
    // Response transformations
    transformResponse: [
      (data) => {
        // Parse response
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        // Validate response structure
        return validateResponse(parsedData);
      }
    ]
  });

  // Add request interceptor
  createRequestInterceptor(apiClient);

  // Add response interceptor
  createResponseInterceptor(apiClient);

  // Add request deduplication
  apiClient.interceptors.request.use(
    (config) => deduplicateRequest(config),
    (error) => Promise.reject(error)
  );

  // Add circuit breaker
  const circuitBreaker = createCircuitBreaker(circuitBreakerConfig);
  apiClient.interceptors.request.use(
    (config) => circuitBreaker.isOpen() ? Promise.reject(new Error('Circuit breaker open')) : config,
    (error) => Promise.reject(error)
  );

  // Add performance monitoring
  apiClient.interceptors.request.use(
    (config) => {
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error) => Promise.reject(error)
  );

  apiClient.interceptors.response.use(
    (response) => {
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      response.headers['X-Response-Time'] = duration.toString();
      return response;
    },
    (error) => Promise.reject(error)
  );

  // Add request/response logging in non-production
  if (process.env.NODE_ENV !== 'production') {
    apiClient.interceptors.request.use(
      (config) => {
        console.debug('API Request:', {
          url: config.url,
          method: config.method,
          headers: config.headers,
          data: config.data
        });
        return config;
      },
      (error) => Promise.reject(error)
    );

    apiClient.interceptors.response.use(
      (response) => {
        console.debug('API Response:', {
          url: response.config.url,
          status: response.status,
          headers: response.headers,
          data: response.data
        });
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  return apiClient;
}

// Create and export configured API client instance
export const apiClient = createApiClient();

// Export type-safe request methods
export const {
  get,
  post,
  put,
  delete: del,
  patch,
  head,
  options
} = apiClient;