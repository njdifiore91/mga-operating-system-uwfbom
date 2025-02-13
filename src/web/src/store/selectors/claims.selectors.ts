/**
 * Redux selectors for claims management in MGA Operating System
 * Implements memoized selectors for optimized claims state access and derived data
 * @version 1.0.0
 */

import { createSelector } from '@reduxjs/toolkit'; // v1.9.x
import type { RootState } from '../reducers';
import type { Claim } from '../../types/claims.types';

/**
 * Base selector to access the claims slice of state
 */
export const selectClaimsState = (state: RootState) => state.claims;

/**
 * Memoized selector to get all claims as an array
 * Optimized for high-performance UI rendering
 */
export const selectAllClaims = createSelector(
  [selectClaimsState],
  (claimsState) => {
    // Return claims array with type safety
    return claimsState.claims;
  }
);

/**
 * Memoized selector factory for retrieving a specific claim by ID
 * Implements caching for repeated lookups
 */
export const selectClaimById = (claimId: string) =>
  createSelector(
    [selectClaimsState],
    (claimsState) => {
      // Check cache first
      const cacheKey = `claim_${claimId}`;
      const cachedClaim = claimsState.cache[cacheKey];
      
      if (cachedClaim && Date.now() - cachedClaim.timestamp < cachedClaim.expiresIn) {
        return cachedClaim.data;
      }

      // Fallback to claims array if not in cache
      return claimsState.claims.find(claim => claim.id === claimId);
    }
  );

/**
 * Memoized selector for currently selected claim
 * Returns null if no claim is selected
 */
export const selectSelectedClaim = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.selectedClaim
);

/**
 * Memoized selector for claims loading state
 * Used for UI loading indicators
 */
export const selectClaimsLoading = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.loading
);

/**
 * Memoized selector for claims error state
 * Used for error handling and display
 */
export const selectClaimsError = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.error
);

/**
 * Memoized selector for filtered claims based on current filters
 * Optimized for real-time filtering performance
 */
export const selectFilteredClaims = createSelector(
  [selectClaimsState],
  (claimsState) => {
    const { claims, filters } = claimsState;
    return claims.filter(claim => {
      if (filters.status && claim.status !== filters.status) return false;
      if (filters.policyId && claim.policyId !== filters.policyId) return false;
      if (filters.startDate && new Date(claim.incidentDate) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(claim.incidentDate) > new Date(filters.endDate)) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          claim.claimNumber.toLowerCase().includes(searchLower) ||
          claim.description.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }
);

/**
 * Memoized selector for claims pagination state
 * Used for paginated list views
 */
export const selectClaimsPagination = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.pagination
);

/**
 * Memoized selector for document upload progress
 * Used for progress indicators during file uploads
 */
export const selectDocumentUploadProgress = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.documentUploadProgress
);

/**
 * Memoized selector for last synchronization timestamp
 * Used for tracking OneShield integration status
 */
export const selectLastSyncTimestamp = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.lastSync
);

/**
 * Memoized selector for pending claim updates
 * Used for optimistic UI updates
 */
export const selectPendingUpdates = createSelector(
  [selectClaimsState],
  (claimsState) => claimsState.pendingUpdates
);