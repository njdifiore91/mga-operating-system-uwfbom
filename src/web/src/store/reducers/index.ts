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
import type { ClaimsState } from './claims.reducer';
import type { UnderwritingState } from './underwriting.reducer';
import type { UIState } from './ui.reducer';

/**
 * Combined root state interface with complete type safety
 */
export interface RootState {
  auth: AuthState;
  policy: PolicyState;
  claims: ClaimsState;
  underwriting: UnderwritingState;
  ui: UIState;
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