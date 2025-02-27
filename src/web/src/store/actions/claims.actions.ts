/**
 * Claims Management Redux Actions
 * Implements secure, real-time claims operations with OneShield integration
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import retry from 'axios-retry';
import {
  Claim,
  CreateClaimRequest,
  UpdateClaimStatusRequest,
  ClaimDocument,
  ClaimValidationError
} from '../../types/claims.types';
import { claimsService } from '../../services/claims.service';
import {
  CLAIM_STATUS,
  CLAIM_DOCUMENT_TYPES,
  SECURITY_CONSTANTS
} from '../../constants/claims.constants';

// Action type constants
const ACTION_PREFIX = 'claims';

// Pagination interface
interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: keyof Claim;
  sortOrder?: 'asc' | 'desc';
}

// Filter interface
interface ClaimFilters {
  status?: keyof typeof CLAIM_STATUS;
  policyId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Fetches claims with pagination, filtering, and real-time OneShield sync
 */
export const fetchClaimsAsync = createAsyncThunk(
  `${ACTION_PREFIX}/fetchClaims`,
  async (params: {
    filters?: ClaimFilters;
    pagination: PaginationParams;
    forceSync?: boolean;
  }, { rejectWithValue }) => {
    try {
      const { filters = {}, pagination, forceSync = false } = params;

      if (forceSync) {
        await claimsService.syncWithOneShield();
      }

      const response = await claimsService.fetchClaims(
        filters,
        pagination.page,
        pagination.pageSize,
        {
          sortBy: pagination.sortBy,
          sortOrder: pagination.sortOrder
        }
      );

      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Fetches detailed claim information with document history
 */
export const fetchClaimDetailsAsync = createAsyncThunk(
  `${ACTION_PREFIX}/fetchClaimDetails`,
  async (claimId: string, { rejectWithValue }) => {
    try {
      const response = await claimsService.fetchClaimDetails(claimId);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Creates a new claim with OneShield integration and validation
 */
export const createClaimAsync = createAsyncThunk(
  `${ACTION_PREFIX}/createClaim`,
  async (claimData: CreateClaimRequest, { rejectWithValue }) => {
    try {
      const response = await claimsService.submitClaim(claimData);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Updates claim status with workflow validation and OneShield sync
 */
export const updateClaimStatusAsync = createAsyncThunk(
  `${ACTION_PREFIX}/updateStatus`,
  async (
    params: { claimId: string; updateData: UpdateClaimStatusRequest },
    { rejectWithValue }
  ) => {
    try {
      const { claimId, updateData } = params;
      const response = await claimsService.updateStatus(claimId, updateData);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Uploads claim documents with security scanning and validation
 */
export const uploadClaimDocumentAsync = createAsyncThunk(
  `${ACTION_PREFIX}/uploadDocument`,
  async (
    params: {
      claimId: string;
      file: File;
      documentType: keyof typeof CLAIM_DOCUMENT_TYPES;
      onProgress?: (progress: number) => void;
    },
    { rejectWithValue }
  ) => {
    try {
      const { claimId, file, documentType, onProgress } = params;
      const response = await claimsService.uploadDocument(
        claimId,
        file,
        documentType,
        onProgress
      );
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Forces synchronization with OneShield system
 */
export const syncWithOneShieldAsync = createAsyncThunk(
  `${ACTION_PREFIX}/syncOneShield`,
  async (claimId: string, { rejectWithValue }) => {
    try {
      const response = await claimsService.syncWithOneShield(claimId);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Export action types for reducer consumption
export type ClaimsActionTypes = {
  fetchClaims: typeof fetchClaimsAsync;
  fetchClaimDetails: typeof fetchClaimDetailsAsync;
  createClaim: typeof createClaimAsync;
  updateClaimStatus: typeof updateClaimStatusAsync;
  uploadClaimDocument: typeof uploadClaimDocumentAsync;
  syncWithOneShield: typeof syncWithOneShieldAsync;
};

// Export thunk action creators
export const claimsActions = {
  fetchClaims: fetchClaimsAsync,
  fetchClaimDetails: fetchClaimDetailsAsync,
  createClaim: createClaimAsync,
  updateClaimStatus: updateClaimStatusAsync,
  uploadClaimDocument: uploadClaimDocumentAsync,
  syncWithOneShield: syncWithOneShieldAsync
};