/**
 * Claims Management Redux Reducer
 * Implements comprehensive state management for claims operations with OneShield integration
 * @version 1.0.0
 */

import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Claim } from '../../types/claims.types';
import {
  fetchClaimsAsync,
  fetchClaimDetailsAsync,
  createClaimAsync,
  updateClaimStatusAsync,
  uploadClaimDocumentAsync,
  syncWithOneShieldAsync
} from '../actions/claims.actions';

// Cache entry type for memoization
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number;
}

// Error state interface
interface ErrorState {
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
}

// Filters interface
interface ClaimFilters {
  status?: string;
  policyId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// Pagination interface
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Claims state interface
interface ClaimsState {
  claims: Claim[];
  selectedClaim: Claim | null;
  loading: boolean;
  error: ErrorState | null;
  lastSync: Date | null;
  pendingUpdates: Record<string, Partial<Claim>>;
  documentUploadProgress: Record<string, number>;
  filters: ClaimFilters;
  pagination: PaginationState;
  cache: Record<string, CacheEntry>;
}

// Initial state
const initialState: ClaimsState = {
  claims: [],
  selectedClaim: null,
  loading: false,
  error: null,
  lastSync: null,
  pendingUpdates: {},
  documentUploadProgress: {},
  filters: {
    status: undefined,
    policyId: undefined,
    startDate: undefined,
    endDate: undefined,
    search: undefined
  },
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  },
  cache: {}
};

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Claims reducer slice with comprehensive state management
 */
const claimsSlice = createSlice({
  name: 'claims',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<ClaimFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // Reset pagination on filter change
    },
    setPagination: (state, action: PayloadAction<Partial<PaginationState>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    invalidateCache: (state) => {
      state.cache = {};
    },
    setDocumentUploadProgress: (
      state,
      action: PayloadAction<{ claimId: string; progress: number }>
    ) => {
      state.documentUploadProgress[action.payload.claimId] = action.payload.progress;
    }
  },
  extraReducers: (builder) => {
    // Fetch claims handling
    builder.addCase(fetchClaimsAsync.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchClaimsAsync.fulfilled, (state, action) => {
      state.loading = false;
      state.claims = action.payload.claims;
      state.pagination = {
        ...state.pagination,
        total: action.payload.total,
        totalPages: Math.ceil(action.payload.total / state.pagination.pageSize)
      };
      state.lastSync = new Date();
    });
    builder.addCase(fetchClaimsAsync.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code || 'FETCH_ERROR',
        message: action.error.message || 'Failed to fetch claims',
        details: action.error,
        timestamp: Date.now()
      };
    });

    // Fetch claim details handling
    builder.addCase(fetchClaimDetailsAsync.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchClaimDetailsAsync.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedClaim = action.payload;
      // Update cache
      state.cache[`claim_${action.payload.id}`] = {
        data: action.payload,
        timestamp: Date.now(),
        expiresIn: CACHE_TTL
      };
    });
    builder.addCase(fetchClaimDetailsAsync.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code || 'FETCH_DETAIL_ERROR',
        message: action.error.message || 'Failed to fetch claim details',
        details: action.error,
        timestamp: Date.now()
      };
    });

    // Create claim handling with optimistic updates
    builder.addCase(createClaimAsync.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createClaimAsync.fulfilled, (state, action) => {
      state.loading = false;
      state.claims.unshift(action.payload);
      state.pagination.total += 1;
      state.pagination.totalPages = Math.ceil(state.pagination.total / state.pagination.pageSize);
      state.lastSync = new Date();
    });
    builder.addCase(createClaimAsync.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code || 'CREATE_ERROR',
        message: action.error.message || 'Failed to create claim',
        details: action.error,
        timestamp: Date.now()
      };
    });

    // Update claim status handling
    builder.addCase(updateClaimStatusAsync.pending, (state, action) => {
      const { claimId, updateData } = action.meta.arg;
      // Optimistic update
      state.pendingUpdates[claimId] = { status: updateData.status };
    });
    builder.addCase(updateClaimStatusAsync.fulfilled, (state, action) => {
      const updatedClaim = action.payload;
      state.claims = state.claims.map(claim =>
        claim.id === updatedClaim.id ? updatedClaim : claim
      );
      if (state.selectedClaim?.id === updatedClaim.id) {
        state.selectedClaim = updatedClaim;
      }
      delete state.pendingUpdates[updatedClaim.id];
      state.lastSync = new Date();
    });
    builder.addCase(updateClaimStatusAsync.rejected, (state, action) => {
      const { claimId } = action.meta.arg;
      delete state.pendingUpdates[claimId];
      state.error = {
        code: action.error.code || 'UPDATE_STATUS_ERROR',
        message: action.error.message || 'Failed to update claim status',
        details: action.error,
        timestamp: Date.now()
      };
    });

    // Document upload handling
    builder.addCase(uploadClaimDocumentAsync.pending, (state, action) => {
      const { claimId } = action.meta.arg;
      state.documentUploadProgress[claimId] = 0;
    });
    builder.addCase(uploadClaimDocumentAsync.fulfilled, (state, action) => {
      const { claimId } = action.meta.arg;
      const updatedClaim = action.payload as Claim;
      state.claims = state.claims.map(claim =>
        claim.id === claimId ? updatedClaim : claim
      );
      if (state.selectedClaim?.id === claimId) {
        state.selectedClaim = updatedClaim;
      }
      delete state.documentUploadProgress[claimId];
    });
    builder.addCase(uploadClaimDocumentAsync.rejected, (state, action) => {
      const { claimId } = action.meta.arg;
      delete state.documentUploadProgress[claimId];
      state.error = {
        code: action.error.code || 'UPLOAD_ERROR',
        message: action.error.message || 'Failed to upload document',
        details: action.error,
        timestamp: Date.now()
      };
    });

    // OneShield synchronization handling
    builder.addCase(syncWithOneShieldAsync.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(syncWithOneShieldAsync.fulfilled, (state, action) => {
      state.loading = false;
      state.lastSync = new Date();
      // Update synchronized claim
      const syncedClaim = action.payload;
      state.claims = state.claims.map(claim =>
        claim.id === syncedClaim.id ? syncedClaim : claim
      );
      if (state.selectedClaim?.id === syncedClaim.id) {
        state.selectedClaim = syncedClaim;
      }
    });
    builder.addCase(syncWithOneShieldAsync.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.error.code || 'SYNC_ERROR',
        message: action.error.message || 'Failed to sync with OneShield',
        details: action.error,
        timestamp: Date.now()
      };
    });
  }
});

// Memoized selectors
export const selectClaimsState = (state: { claims: ClaimsState }) => state.claims;

export const selectFilteredClaims = createSelector(
  [selectClaimsState],
  (claimsState) => {
    const { claims, filters } = claimsState;
    return claims.filter(claim => {
      if (filters.status && claim.status !== filters.status) return false;
      if (filters.policyId && claim.policyId !== filters.policyId) return false;
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

export const selectClaimById = createSelector(
  [selectClaimsState, (_state, claimId: string) => claimId],
  (claimsState, claimId) => {
    const cacheKey = `claim_${claimId}`;
    const cachedClaim = claimsState.cache[cacheKey];
    if (cachedClaim && Date.now() - cachedClaim.timestamp < cachedClaim.expiresIn) {
      return cachedClaim.data;
    }
    return claimsState.claims.find(claim => claim.id === claimId);
  }
);

// Export actions and reducer
export const {
  setFilters,
  setPagination,
  clearError,
  invalidateCache,
  setDocumentUploadProgress
} = claimsSlice.actions;

export default claimsSlice.reducer;