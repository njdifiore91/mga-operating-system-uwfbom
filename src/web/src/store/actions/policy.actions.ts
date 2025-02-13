/**
 * Redux action creators for policy management in the MGA Operating System
 * Implements type-safe actions and thunks for policy operations with error handling
 * @version 1.0.0
 */

import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { IPolicy, PolicyStatus } from '../../types/policy.types';
import PolicyService from '../../services/policy.service';
import { ApiResponse, ErrorResponse } from '../../types/common.types';

// Action type constants
export enum PolicyActionTypes {
  FETCH_POLICIES_REQUEST = 'policy/fetchPolicies/pending',
  FETCH_POLICIES_SUCCESS = 'policy/fetchPolicies/fulfilled',
  FETCH_POLICIES_FAILURE = 'policy/fetchPolicies/rejected',
  
  FETCH_POLICY_DETAILS_REQUEST = 'policy/fetchPolicyDetails/pending',
  FETCH_POLICY_DETAILS_SUCCESS = 'policy/fetchPolicyDetails/fulfilled',
  FETCH_POLICY_DETAILS_FAILURE = 'policy/fetchPolicyDetails/rejected',
  
  CREATE_POLICY_REQUEST = 'policy/createPolicy/pending',
  CREATE_POLICY_SUCCESS = 'policy/createPolicy/fulfilled',
  CREATE_POLICY_FAILURE = 'policy/createPolicy/rejected',
  
  UPDATE_POLICY_REQUEST = 'policy/updatePolicy/pending',
  UPDATE_POLICY_SUCCESS = 'policy/updatePolicy/fulfilled',
  UPDATE_POLICY_FAILURE = 'policy/updatePolicy/rejected',
  
  BIND_POLICY_REQUEST = 'policy/bindPolicy/pending',
  BIND_POLICY_SUCCESS = 'policy/bindPolicy/fulfilled',
  BIND_POLICY_FAILURE = 'policy/bindPolicy/rejected',
  
  CLEAR_POLICY_ERRORS = 'policy/clearErrors'
}

// Request tracking for deduplication
const pendingRequests = new Map<string, Promise<any>>();

// Action creator for clearing errors
export const clearPolicyErrors = createAction(PolicyActionTypes.CLEAR_POLICY_ERRORS);

// Async thunk for fetching policies with pagination and filtering
export const fetchPolicies = createAsyncThunk<
  { policies: IPolicy[]; total: number },
  { filters?: Partial<IPolicy>; page: number; limit: number },
  { rejectValue: ErrorResponse }
>(
  'policy/fetchPolicies',
  async ({ filters, page, limit }, { rejectWithValue }) => {
    const requestKey = `fetchPolicies-${JSON.stringify(filters)}-${page}-${limit}`;
    
    try {
      // Check for pending request
      if (pendingRequests.has(requestKey)) {
        return await pendingRequests.get(requestKey);
      }

      // Create new request
      const request = PolicyService.fetchPolicies(filters, page, limit);
      pendingRequests.set(requestKey, request);

      const response = await request;
      pendingRequests.delete(requestKey);

      return response;
    } catch (error) {
      return rejectWithValue({
        code: 'FETCH_POLICIES_ERROR',
        message: error.message,
        details: error.response?.data
      });
    }
  }
);

// Async thunk for fetching single policy details
export const fetchPolicyDetails = createAsyncThunk<
  IPolicy,
  string,
  { rejectValue: ErrorResponse }
>(
  'policy/fetchPolicyDetails',
  async (policyId, { rejectWithValue }) => {
    try {
      return await PolicyService.fetchPolicyDetails(policyId);
    } catch (error) {
      return rejectWithValue({
        code: 'FETCH_POLICY_DETAILS_ERROR',
        message: error.message,
        details: error.response?.data
      });
    }
  }
);

// Async thunk for creating new policy with optimistic updates
export const createPolicy = createAsyncThunk<
  IPolicy,
  Partial<IPolicy>,
  { rejectValue: ErrorResponse }
>(
  'policy/createPolicy',
  async (policyData, { rejectWithValue }) => {
    try {
      // Validate required fields
      if (!policyData.type || !policyData.effectiveDate) {
        throw new Error('Missing required policy fields');
      }

      return await PolicyService.submitNewPolicy(policyData);
    } catch (error) {
      return rejectWithValue({
        code: 'CREATE_POLICY_ERROR',
        message: error.message,
        details: error.response?.data
      });
    }
  }
);

// Async thunk for updating policy details
export const updatePolicy = createAsyncThunk<
  IPolicy,
  { policyId: string; updates: Partial<IPolicy> },
  { rejectValue: ErrorResponse }
>(
  'policy/updatePolicy',
  async ({ policyId, updates }, { rejectWithValue }) => {
    try {
      return await PolicyService.updatePolicyDetails(policyId, updates);
    } catch (error) {
      return rejectWithValue({
        code: 'UPDATE_POLICY_ERROR',
        message: error.message,
        details: error.response?.data
      });
    }
  }
);

// Async thunk for binding approved policies
export const bindPolicy = createAsyncThunk<
  IPolicy,
  string,
  { rejectValue: ErrorResponse }
>(
  'policy/bindPolicy',
  async (policyId, { rejectWithValue, getState }) => {
    try {
      // Verify policy is in approved status before binding
      const policy = await PolicyService.fetchPolicyDetails(policyId);
      if (policy.status !== PolicyStatus.APPROVED) {
        throw new Error('Policy must be approved before binding');
      }

      return await PolicyService.bindApprovedPolicy(policyId);
    } catch (error) {
      return rejectWithValue({
        code: 'BIND_POLICY_ERROR',
        message: error.message,
        details: error.response?.data
      });
    }
  }
);

// Export action types for reducer
export type PolicyActions = 
  | ReturnType<typeof clearPolicyErrors>
  | ReturnType<typeof fetchPolicies.pending>
  | ReturnType<typeof fetchPolicies.fulfilled>
  | ReturnType<typeof fetchPolicies.rejected>
  | ReturnType<typeof fetchPolicyDetails.pending>
  | ReturnType<typeof fetchPolicyDetails.fulfilled>
  | ReturnType<typeof fetchPolicyDetails.rejected>
  | ReturnType<typeof createPolicy.pending>
  | ReturnType<typeof createPolicy.fulfilled>
  | ReturnType<typeof createPolicy.rejected>
  | ReturnType<typeof updatePolicy.pending>
  | ReturnType<typeof updatePolicy.fulfilled>
  | ReturnType<typeof updatePolicy.rejected>
  | ReturnType<typeof bindPolicy.pending>
  | ReturnType<typeof bindPolicy.fulfilled>
  | ReturnType<typeof bindPolicy.rejected>;