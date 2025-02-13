/**
 * Redux reducer for managing comprehensive policy state in the MGA OS web application.
 * Implements type-safe state management for policy operations with optimistic updates.
 * @version 1.0.0
 */

import { createReducer } from '@reduxjs/toolkit'; // ^1.9.5
import { IPolicy, PolicyStatus } from '../../types/policy.types';
import { PolicyActionTypes } from '../actions/policy.actions';

/**
 * Interface for policy filters used in list views
 */
interface PolicyFilters {
  type?: string;
  status?: PolicyStatus;
  startDate?: string;
  endDate?: string;
  underwriter?: string;
}

/**
 * Interface defining the comprehensive policy state structure
 */
export interface PolicyState {
  policies: IPolicy[];
  selectedPolicy: IPolicy | null;
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
  lastUpdated: number;
  filters: PolicyFilters;
  sortOrder: 'asc' | 'desc';
  sortBy: keyof IPolicy;
}

/**
 * Initial state configuration for policy management
 */
const initialState: PolicyState = {
  policies: [],
  selectedPolicy: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
  lastUpdated: 0,
  filters: {},
  sortOrder: 'desc',
  sortBy: 'effectiveDate'
};

/**
 * Policy reducer implementing comprehensive state management for policy operations
 */
export const policyReducer = createReducer(initialState, (builder) => {
  builder
    // Handle policy list fetching
    .addCase(PolicyActionTypes.FETCH_POLICIES_REQUEST, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(PolicyActionTypes.FETCH_POLICIES_SUCCESS, (state, action) => {
      state.loading = false;
      state.policies = action.payload.policies;
      state.total = action.payload.total;
      state.lastUpdated = Date.now();
      state.error = null;
    })
    .addCase(PolicyActionTypes.FETCH_POLICIES_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
    })

    // Handle single policy details
    .addCase(PolicyActionTypes.FETCH_POLICY_DETAILS_REQUEST, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(PolicyActionTypes.FETCH_POLICY_DETAILS_SUCCESS, (state, action) => {
      state.loading = false;
      state.selectedPolicy = action.payload;
      state.error = null;
      
      // Update policy in list if exists
      const index = state.policies.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.policies[index] = action.payload;
      }
    })
    .addCase(PolicyActionTypes.FETCH_POLICY_DETAILS_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
    })

    // Handle policy creation
    .addCase(PolicyActionTypes.CREATE_POLICY_REQUEST, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(PolicyActionTypes.CREATE_POLICY_SUCCESS, (state, action) => {
      state.loading = false;
      state.policies.unshift(action.payload);
      state.total += 1;
      state.lastUpdated = Date.now();
      state.error = null;
    })
    .addCase(PolicyActionTypes.CREATE_POLICY_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
    })

    // Handle policy updates
    .addCase(PolicyActionTypes.UPDATE_POLICY_REQUEST, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(PolicyActionTypes.UPDATE_POLICY_SUCCESS, (state, action) => {
      state.loading = false;
      
      // Update in policies list
      const index = state.policies.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.policies[index] = action.payload;
      }
      
      // Update selected policy if matches
      if (state.selectedPolicy?.id === action.payload.id) {
        state.selectedPolicy = action.payload;
      }
      
      state.lastUpdated = Date.now();
      state.error = null;
    })
    .addCase(PolicyActionTypes.UPDATE_POLICY_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
    })

    // Handle policy binding
    .addCase(PolicyActionTypes.BIND_POLICY_REQUEST, (state, action) => {
      state.loading = true;
      state.error = null;
      
      // Optimistic update
      const policyId = action.meta.arg;
      const index = state.policies.findIndex(p => p.id === policyId);
      if (index !== -1) {
        state.policies[index] = {
          ...state.policies[index],
          status: PolicyStatus.BOUND
        };
      }
    })
    .addCase(PolicyActionTypes.BIND_POLICY_SUCCESS, (state, action) => {
      state.loading = false;
      
      // Update with confirmed data
      const index = state.policies.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.policies[index] = action.payload;
      }
      
      if (state.selectedPolicy?.id === action.payload.id) {
        state.selectedPolicy = action.payload;
      }
      
      state.lastUpdated = Date.now();
      state.error = null;
    })
    .addCase(PolicyActionTypes.BIND_POLICY_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
      
      // Revert optimistic update on failure
      const policyId = action.meta.arg;
      const index = state.policies.findIndex(p => p.id === policyId);
      if (index !== -1) {
        state.policies[index] = {
          ...state.policies[index],
          status: PolicyStatus.APPROVED
        };
      }
    })

    // Handle error clearing
    .addCase(PolicyActionTypes.CLEAR_POLICY_ERRORS, (state) => {
      state.error = null;
    });
});

export default policyReducer;