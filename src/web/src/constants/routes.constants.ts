/**
 * @fileoverview Route path constants for the MGA Operating System web application
 * Defines all route paths used throughout the application with strong typing and immutability
 * @version 1.0.0
 */

/**
 * Authentication and user management route paths
 * Supports OAuth 2.0 + OIDC integration flows
 */
export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  RESET_PASSWORD: '/auth/reset-password',
  FORGOT_PASSWORD: '/auth/forgot-password',
  MFA_VERIFICATION: '/auth/mfa-verification',
  PROFILE: '/auth/profile',
  SETTINGS: '/auth/settings'
} as const;

/**
 * Main dashboard route paths
 * Follows F-pattern layout design for optimal UX
 */
export const DASHBOARD_ROUTES = {
  HOME: '/dashboard',
  ANALYTICS: '/dashboard/analytics',
  REPORTS: '/dashboard/reports',
  TASKS: '/dashboard/tasks',
  NOTIFICATIONS: '/dashboard/notifications'
} as const;

/**
 * Policy management route paths
 * Supports complete policy lifecycle operations
 */
export const POLICY_ROUTES = {
  ROOT: '/policies',
  LIST: '/policies/list',
  DETAILS: '/policies/:id',
  NEW: '/policies/new',
  EDIT: '/policies/:id/edit',
  ENDORSEMENT: '/policies/:id/endorsement',
  RENEWAL: '/policies/:id/renewal',
  DOCUMENTS: '/policies/:id/documents',
  HISTORY: '/policies/:id/history',
  QUOTES: '/policies/:id/quotes'
} as const;

/**
 * Claims management route paths
 * Supports end-to-end claims processing workflow
 */
export const CLAIMS_ROUTES = {
  ROOT: '/claims',
  LIST: '/claims/list',
  DETAILS: '/claims/:id',
  NEW: '/claims/new',
  EDIT: '/claims/:id/edit',
  DOCUMENTS: '/claims/:id/documents',
  ASSESSMENT: '/claims/:id/assessment',
  PAYMENTS: '/claims/:id/payments',
  HISTORY: '/claims/:id/history'
} as const;

/**
 * Underwriting workflow route paths
 * Supports both automated and manual underwriting processes
 */
export const UNDERWRITING_ROUTES = {
  ROOT: '/underwriting',
  QUEUE: '/underwriting/queue',
  ASSESSMENT: '/underwriting/:id/assessment',
  WORKFLOW: '/underwriting/:id/workflow',
  REVIEW: '/underwriting/:id/review',
  DECISION: '/underwriting/:id/decision',
  HISTORY: '/underwriting/:id/history',
  ANALYTICS: '/underwriting/analytics'
} as const;

/**
 * Document management route paths
 * Supports document lifecycle and template management
 */
export const DOCUMENT_ROUTES = {
  ROOT: '/documents',
  LIST: '/documents/list',
  UPLOAD: '/documents/upload',
  PREVIEW: '/documents/:id',
  EDIT: '/documents/:id/edit',
  SHARE: '/documents/:id/share',
  HISTORY: '/documents/:id/history',
  TEMPLATES: '/documents/templates'
} as const;

// Type definitions for route parameters
type RouteParams = {
  id: string;
};

// Type definitions for each route group
type AuthRoutes = typeof AUTH_ROUTES;
type DashboardRoutes = typeof DASHBOARD_ROUTES;
type PolicyRoutes = typeof POLICY_ROUTES;
type ClaimsRoutes = typeof CLAIMS_ROUTES;
type UnderwritingRoutes = typeof UNDERWRITING_ROUTES;
type DocumentRoutes = typeof DOCUMENT_ROUTES;

// Export type definitions for use in route handling components
export type {
  RouteParams,
  AuthRoutes,
  DashboardRoutes,
  PolicyRoutes,
  ClaimsRoutes,
  UnderwritingRoutes,
  DocumentRoutes
};