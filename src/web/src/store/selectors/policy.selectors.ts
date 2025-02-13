/**
 * Redux selectors for policy-related state in the MGA OS web application.
 * Implements memoized selectors for efficient policy data retrieval and filtering.
 * @version 1.0.0
 */

import { createSelector } from '@reduxjs/toolkit';
import { IPolicy, PolicyStatus } from '../../types/policy.types';
import type { RootState } from '../store';

/**
 * Interface for the policy state slice
 */
interface IPolicyState {
  policies: IPolicy[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    currentPage: number;
    pageSize: number;
  };
}

/**
 * Base selector to access the policy state slice
 */
export const selectPolicyState = (state: RootState): IPolicyState => state.policy;

/**
 * Memoized selector to retrieve all policies
 * Performance optimized through memoization to prevent unnecessary recomputations
 */
export const selectPolicies = createSelector(
  [selectPolicyState],
  (policyState): IPolicy[] => policyState.policies
);

/**
 * Memoized selector factory to retrieve a specific policy by ID
 * Returns undefined if policy is not found
 */
export const selectPolicyById = (policyId: string) =>
  createSelector([selectPolicies], (policies): IPolicy | undefined =>
    policies.find((policy) => policy.id === policyId)
  );

/**
 * Memoized selector to filter policies by status
 * Leverages enum type safety for status values
 */
export const selectPoliciesByStatus = (status: PolicyStatus) =>
  createSelector([selectPolicies], (policies): IPolicy[] =>
    policies.filter((policy) => policy.status === status)
  );

/**
 * Selector to retrieve the loading state for policy operations
 */
export const selectPolicyLoading = createSelector(
  [selectPolicyState],
  (policyState): boolean => policyState.loading
);

/**
 * Selector to retrieve any error state for policy operations
 */
export const selectPolicyError = createSelector(
  [selectPolicyState],
  (policyState): string | null => policyState.error
);

/**
 * Memoized selector to retrieve and compute pagination metadata
 * Includes derived calculations for total pages
 */
export const selectPolicyPagination = createSelector(
  [selectPolicyState],
  (policyState): {
    total: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
  } => ({
    total: policyState.pagination.total,
    currentPage: policyState.pagination.currentPage,
    pageSize: policyState.pagination.pageSize,
    totalPages: Math.ceil(
      policyState.pagination.total / policyState.pagination.pageSize
    ),
  })
);

/**
 * Memoized selector to retrieve active policies
 * Optimized for common filtering use case
 */
export const selectActivePolicies = createSelector(
  [selectPolicies],
  (policies): IPolicy[] =>
    policies.filter((policy) => policy.status === PolicyStatus.ACTIVE)
);

/**
 * Memoized selector to retrieve policies pending review
 * Combines multiple status checks efficiently
 */
export const selectPendingReviewPolicies = createSelector(
  [selectPolicies],
  (policies): IPolicy[] =>
    policies.filter(
      (policy) =>
        policy.status === PolicyStatus.SUBMITTED ||
        policy.status === PolicyStatus.IN_REVIEW
    )
);

/**
 * Memoized selector to check if any policies are in a specific status
 * Useful for conditional UI rendering
 */
export const selectHasPoliciesInStatus = (status: PolicyStatus) =>
  createSelector(
    [selectPolicies],
    (policies): boolean => policies.some((policy) => policy.status === status)
  );

/**
 * Memoized selector to get the total count of policies in each status
 * Useful for dashboard metrics and filtering
 */
export const selectPolicyStatusCounts = createSelector(
  [selectPolicies],
  (policies): Record<PolicyStatus, number> => {
    const initialCounts = Object.values(PolicyStatus).reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<PolicyStatus, number>
    );

    return policies.reduce((counts, policy) => {
      counts[policy.status]++;
      return counts;
    }, initialCounts);
  }
);