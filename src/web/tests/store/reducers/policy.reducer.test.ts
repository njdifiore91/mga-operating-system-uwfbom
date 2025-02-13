/**
 * Comprehensive test suite for policy reducer
 * Validates state management, transitions, and type safety for policy operations
 * @version 1.0.0
 */

import { policyReducer } from '../../../src/store/reducers/policy.reducer';
import { PolicyActionTypes } from '../../../src/store/actions/policy.actions';
import { IPolicy, PolicyType, PolicyStatus } from '../../../src/types/policy.types';
import { Timestamp } from '../../../src/types/common.types';

// Mock policy data for testing
const mockPolicies: IPolicy[] = [
  {
    id: 'test-policy-1',
    policyNumber: 'POL-001',
    type: PolicyType.COMMERCIAL_PROPERTY,
    status: PolicyStatus.DRAFT,
    effectiveDate: '2023-01-01T00:00:00Z' as Timestamp,
    expirationDate: '2024-01-01T00:00:00Z' as Timestamp,
    premium: 5000,
    coverages: [],
    underwritingInfo: {
      riskScore: 85,
      underwriterNotes: '',
      approvalStatus: 'PENDING',
      reviewedBy: '',
      reviewDate: null as unknown as Timestamp
    },
    endorsements: [],
    documents: [],
    createdAt: '2023-01-01T00:00:00Z' as Timestamp,
    updatedAt: '2023-01-01T00:00:00Z' as Timestamp
  }
];

// Initial state for testing
const initialState = {
  policies: [],
  selectedPolicy: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
  lastUpdated: 0,
  filters: {},
  sortOrder: 'desc' as const,
  sortBy: 'effectiveDate' as const
};

describe('policyReducer', () => {
  test('should return initial state', () => {
    const state = policyReducer(undefined, { type: '@@INIT' });
    expect(state).toEqual(initialState);
  });

  test('should handle FETCH_POLICIES_REQUEST', () => {
    const state = policyReducer(initialState, {
      type: PolicyActionTypes.FETCH_POLICIES_REQUEST
    });

    expect(state).toEqual({
      ...initialState,
      loading: true,
      error: null
    });
  });

  test('should handle FETCH_POLICIES_SUCCESS', () => {
    const state = policyReducer(
      { ...initialState, loading: true },
      {
        type: PolicyActionTypes.FETCH_POLICIES_SUCCESS,
        payload: {
          policies: mockPolicies,
          total: 1
        }
      }
    );

    expect(state).toEqual({
      ...initialState,
      loading: false,
      policies: mockPolicies,
      total: 1,
      error: null,
      lastUpdated: expect.any(Number)
    });
  });

  test('should handle FETCH_POLICIES_FAILURE', () => {
    const errorMessage = 'Failed to fetch policies';
    const state = policyReducer(
      { ...initialState, loading: true },
      {
        type: PolicyActionTypes.FETCH_POLICIES_FAILURE,
        payload: { message: errorMessage }
      }
    );

    expect(state).toEqual({
      ...initialState,
      loading: false,
      error: errorMessage
    });
  });

  test('should handle FETCH_POLICY_DETAILS_REQUEST', () => {
    const state = policyReducer(initialState, {
      type: PolicyActionTypes.FETCH_POLICY_DETAILS_REQUEST
    });

    expect(state).toEqual({
      ...initialState,
      loading: true,
      error: null
    });
  });

  test('should handle FETCH_POLICY_DETAILS_SUCCESS', () => {
    const state = policyReducer(
      { ...initialState, loading: true },
      {
        type: PolicyActionTypes.FETCH_POLICY_DETAILS_SUCCESS,
        payload: mockPolicies[0]
      }
    );

    expect(state).toEqual({
      ...initialState,
      loading: false,
      selectedPolicy: mockPolicies[0],
      error: null
    });
  });

  test('should handle CREATE_POLICY_REQUEST', () => {
    const state = policyReducer(initialState, {
      type: PolicyActionTypes.CREATE_POLICY_REQUEST
    });

    expect(state).toEqual({
      ...initialState,
      loading: true,
      error: null
    });
  });

  test('should handle CREATE_POLICY_SUCCESS', () => {
    const state = policyReducer(
      { ...initialState, loading: true },
      {
        type: PolicyActionTypes.CREATE_POLICY_SUCCESS,
        payload: mockPolicies[0]
      }
    );

    expect(state).toEqual({
      ...initialState,
      loading: false,
      policies: [mockPolicies[0]],
      total: 1,
      error: null,
      lastUpdated: expect.any(Number)
    });
  });

  test('should handle UPDATE_POLICY_REQUEST', () => {
    const state = policyReducer(initialState, {
      type: PolicyActionTypes.UPDATE_POLICY_REQUEST
    });

    expect(state).toEqual({
      ...initialState,
      loading: true,
      error: null
    });
  });

  test('should handle UPDATE_POLICY_SUCCESS', () => {
    const updatedPolicy = {
      ...mockPolicies[0],
      premium: 6000
    };

    const state = policyReducer(
      {
        ...initialState,
        loading: true,
        policies: mockPolicies,
        selectedPolicy: mockPolicies[0]
      },
      {
        type: PolicyActionTypes.UPDATE_POLICY_SUCCESS,
        payload: updatedPolicy
      }
    );

    expect(state).toEqual({
      ...initialState,
      loading: false,
      policies: [updatedPolicy],
      selectedPolicy: updatedPolicy,
      error: null,
      lastUpdated: expect.any(Number)
    });
  });

  test('should handle BIND_POLICY_REQUEST with optimistic update', () => {
    const state = policyReducer(
      {
        ...initialState,
        policies: mockPolicies
      },
      {
        type: PolicyActionTypes.BIND_POLICY_REQUEST,
        meta: { arg: mockPolicies[0].id }
      }
    );

    expect(state.policies[0].status).toBe(PolicyStatus.BOUND);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  test('should handle BIND_POLICY_SUCCESS', () => {
    const boundPolicy = {
      ...mockPolicies[0],
      status: PolicyStatus.BOUND
    };

    const state = policyReducer(
      {
        ...initialState,
        loading: true,
        policies: [{ ...mockPolicies[0], status: PolicyStatus.BOUND }],
        selectedPolicy: mockPolicies[0]
      },
      {
        type: PolicyActionTypes.BIND_POLICY_SUCCESS,
        payload: boundPolicy
      }
    );

    expect(state).toEqual({
      ...initialState,
      loading: false,
      policies: [boundPolicy],
      selectedPolicy: boundPolicy,
      error: null,
      lastUpdated: expect.any(Number)
    });
  });

  test('should handle BIND_POLICY_FAILURE with rollback', () => {
    const state = policyReducer(
      {
        ...initialState,
        loading: true,
        policies: [{ ...mockPolicies[0], status: PolicyStatus.BOUND }]
      },
      {
        type: PolicyActionTypes.BIND_POLICY_FAILURE,
        payload: { message: 'Failed to bind policy' },
        meta: { arg: mockPolicies[0].id }
      }
    );

    expect(state.policies[0].status).toBe(PolicyStatus.APPROVED);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Failed to bind policy');
  });

  test('should handle CLEAR_POLICY_ERRORS', () => {
    const state = policyReducer(
      {
        ...initialState,
        error: 'Previous error'
      },
      {
        type: PolicyActionTypes.CLEAR_POLICY_ERRORS
      }
    );

    expect(state.error).toBeNull();
  });
});