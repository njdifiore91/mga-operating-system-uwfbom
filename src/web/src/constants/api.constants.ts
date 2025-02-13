/**
 * API Constants for MGA OS Web Application
 * Defines configuration, endpoints and settings for API communication
 * @version 1.0.0
 */

// API Version
export const API_VERSION = 'v1';

// Base URL with environment fallback
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

// Default API timeout in milliseconds
export const API_TIMEOUT = 30000;

// Standard API Headers including security headers
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-API-Version': 'v1',
  'X-Request-ID': 'uuid()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
} as const;

// Rate limits per endpoint (requests per minute)
export const API_RATE_LIMITS = {
  DEFAULT: 1000,
  POLICY_CREATION: 100,
  POLICY_UPDATE: 200,
  UNDERWRITING_ASSESSMENT: 150,
  UNDERWRITING_DECISION: 50,
  CLAIMS_SUBMISSION: 300,
  CLAIMS_UPDATE: 200,
  DOCUMENT_UPLOAD: 500,
  DOCUMENT_DOWNLOAD: 1000
} as const;

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout', 
    REFRESH: '/auth/refresh',
    VERIFY_MFA: '/auth/verify-mfa',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password'
  },
  POLICY: {
    BASE: '/policies',
    CREATE: '/policies/create',
    UPDATE: '/policies/:id',
    DELETE: '/policies/:id',
    DETAILS: '/policies/:id/details',
    HISTORY: '/policies/:id/history',
    ENDORSEMENTS: '/policies/:id/endorsements',
    RENEWALS: '/policies/:id/renewals',
    QUOTES: '/policies/:id/quotes'
  },
  UNDERWRITING: {
    BASE: '/underwriting',
    ASSESS: '/underwriting/assess',
    APPROVE: '/underwriting/:id/approve',
    REJECT: '/underwriting/:id/reject',
    REFER: '/underwriting/:id/refer',
    RULES: '/underwriting/rules',
    RISK_FACTORS: '/underwriting/:id/risk-factors',
    HISTORY: '/underwriting/:id/history'
  },
  CLAIMS: {
    BASE: '/claims',
    CREATE: '/claims/create',
    UPDATE: '/claims/:id',
    DETAILS: '/claims/:id/details',
    FNOL: '/claims/fnol',
    ASSESSMENT: '/claims/:id/assessment',
    PAYMENTS: '/claims/:id/payments',
    HISTORY: '/claims/:id/history'
  },
  DOCUMENTS: {
    BASE: '/documents',
    UPLOAD: '/documents/upload',
    DOWNLOAD: '/documents/:id/download',
    DELETE: '/documents/:id',
    METADATA: '/documents/:id/metadata',
    VERSIONS: '/documents/:id/versions',
    SHARE: '/documents/:id/share'
  },
  ANALYTICS: {
    BASE: '/analytics',
    DASHBOARD: '/analytics/dashboard',
    REPORTS: '/analytics/reports',
    METRICS: '/analytics/metrics',
    EXPORT: '/analytics/export'
  }
} as const;

// Type exports for endpoints
export type ApiEndpoints = typeof API_ENDPOINTS;
export type AuthEndpoints = typeof API_ENDPOINTS.AUTH;
export type PolicyEndpoints = typeof API_ENDPOINTS.POLICY;
export type UnderwritingEndpoints = typeof API_ENDPOINTS.UNDERWRITING;
export type ClaimsEndpoints = typeof API_ENDPOINTS.CLAIMS;
export type DocumentEndpoints = typeof API_ENDPOINTS.DOCUMENTS;
export type AnalyticsEndpoints = typeof API_ENDPOINTS.ANALYTICS;

// Type exports for status codes and rate limits
export type HttpStatus = typeof HTTP_STATUS;
export type ApiRateLimits = typeof API_RATE_LIMITS;