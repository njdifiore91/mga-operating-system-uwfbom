/**
 * Root reducer configuration for MGA Operating System
 * Combines all individual reducers with performance optimizations and real-time synchronization
 * @version 1.0.0
 */

import { combineReducers } from '@reduxjs/toolkit'; // v1.9.5

// Import individual reducers
import authReducer from './auth.reducer';
import policyReducer from './policy.reducer';
import claimsReducer from './claims.reducer';
import underwritingReducer from './underwriting.reducer';
import uiReducer from './ui.reducer';

// Import state types
import type { AuthState } from '../../types/auth.types';
import type { PolicyState } from './policy.reducer';
import type { Claim } from '../../types/claims.types';
import type { IRiskAssessmentDisplay, IUnderwritingQueueItem } from '../../types/underwriting.types';
import type { ThemeMode, Breakpoint, Notification, Modal } from '../actions/ui.actions';

/**
 * Combined root state interface with complete type safety
 */
export interface RootState {
  auth: AuthState & {
    sessionTimeout: number | null;
    securityEvents: Array<{
      timestamp: number;
      type: string;
      details: Record<string, unknown>;
    }>;
  };
  policy: PolicyState;
  claims: {
    claims: Claim[];
    selectedClaim: Claim | null;
    loading: boolean;
    error: {
      code: string;
      message: string;
      details?: unknown;
      timestamp: number;
    } | null;
    lastSync: Date | null;
    pendingUpdates: Record<string, Partial<Claim>>;
    documentUploadProgress: Record<string, number>;
    filters: {
      status?: string;
      policyId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    cache: Record<string, {
      data: any;
      timestamp: number;
      expiresIn: number;
    }>;
  };
  underwriting: {
    riskAssessment: IRiskAssessmentDisplay | null;
    queueItems: IUnderwritingQueueItem[];
    loading: boolean;
    error: {
      message: string;
      code?: string;
      context?: string;
      timestamp: number;
      recoveryAttempts: number;
    } | null;
    cache: {
      assessments: Record<string, {
        data: IRiskAssessmentDisplay;
        timestamp: number;
        expiresAt: number;
      }>;
      queue: {
        data: IUnderwritingQueueItem[];
        timestamp: number;
        expiresAt: number;
      } | null;
    };
    metadata: {
      lastUpdated: number;
      version: string;
      pendingOperations: string[];
    };
  };
  ui: {
    loading: boolean;
    notificationQueue: Array<Notification & {
      createdAt: Date;
      isPersistent: boolean;
    }>;
    sidebarOpen: boolean;
    themeMode: ThemeMode;
    currentBreakpoint: Breakpoint;
    breakpointHistory: Breakpoint[];
    isTransitioning: boolean;
    themeTransition: {
      status: 'none' | 'pending' | 'complete';
      from: ThemeMode | null;
      to: ThemeMode | null;
    };
    activeModals: Modal[];
  };
}

/**
 * Root reducer combining all feature reducers with performance optimizations
 * Implements real-time synchronization and optimistic updates
 */
const rootReducer = combineReducers<RootState>({
  auth: authReducer,
  policy: policyReducer,
  claims: claimsReducer,
  underwriting: underwritingReducer,
  ui: uiReducer
});

/**
 * Type-safe selector for accessing root state
 * Enables type inference in connected components
 */
export type AppState = ReturnType<typeof rootReducer>;

/**
 * Export root reducer with complete type safety
 * Enables Redux DevTools integration and state persistence
 */
export default rootReducer;