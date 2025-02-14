/**
 * Claims Management API Client
 * Implements API client functions for claims management in the MGA OS web application
 * @version 1.0.0
 */

import { AxiosError, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  Claim,
  CreateClaimRequest,
  UpdateClaimStatusRequest,
  ClaimDocument
} from '../types/claims.types';
import { CLAIM_STATUS, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES } from '../constants/claims.constants';

// Types for API responses
interface PaginatedResponse<T> {
  data: T;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ClaimQueryParams {
  page?: number;
  pageSize?: number;
  status?: keyof typeof CLAIM_STATUS;
  policyId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

/**
 * Retrieves a paginated list of claims with filtering and sorting
 * @param params Query parameters for filtering and pagination
 * @returns Promise resolving to paginated claims response
 */
async function getClaims(params: ClaimQueryParams = {}): Promise<PaginatedResponse<Claim[]>> {
  try {
    const response = await apiClient.get<PaginatedResponse<Claim[]>>(
      API_ENDPOINTS.CLAIMS.BASE,
      { params }
    );
    return response.data;
  } catch (error) {
    throw handleClaimsApiError(error as AxiosError);
  }
}

/**
 * Retrieves detailed information for a specific claim
 * @param claimId Unique identifier of the claim
 * @returns Promise resolving to claim details
 */
async function getClaimById(claimId: string): Promise<Claim> {
  try {
    const response = await apiClient.get<Claim>(
      API_ENDPOINTS.CLAIMS.DETAILS.replace(':id', claimId)
    );
    return response.data;
  } catch (error) {
    throw handleClaimsApiError(error as AxiosError);
  }
}

/**
 * Creates a new claim with validation and OneShield integration
 * @param claimData Data for creating new claim
 * @returns Promise resolving to created claim
 */
async function createClaim(claimData: CreateClaimRequest): Promise<Claim> {
  try {
    validateClaimData(claimData);
    
    const response = await apiClient.post<Claim>(
      API_ENDPOINTS.CLAIMS.CREATE,
      claimData,
      {
        headers: {
          'X-OneShield-Integration': 'true'
        }
      }
    );
    return response.data;
  } catch (error) {
    throw handleClaimsApiError(error as AxiosError);
  }
}

/**
 * Updates the status of an existing claim
 * @param claimId Unique identifier of the claim
 * @param updateData Status update data
 * @returns Promise resolving to updated claim
 */
async function updateClaimStatus(
  claimId: string,
  updateData: UpdateClaimStatusRequest
): Promise<Claim> {
  try {
    validateStatusTransition(claimId, updateData.status);
    
    const response = await apiClient.put<Claim>(
      API_ENDPOINTS.CLAIMS.UPDATE.replace(':id', claimId),
      updateData,
      {
        headers: {
          'X-OneShield-Integration': 'true',
          'X-Audit-User': 'true'
        }
      }
    );
    return response.data;
  } catch (error) {
    throw handleClaimsApiError(error as AxiosError);
  }
}

/**
 * Uploads documents related to a claim with progress tracking
 * @param claimId Unique identifier of the claim
 * @param documentData Form data containing document file and metadata
 * @param onProgress Optional callback for upload progress
 * @returns Promise resolving to uploaded document metadata
 */
async function uploadClaimDocument(
  claimId: string,
  documentData: FormData,
  onProgress?: (progress: number) => void
): Promise<ClaimDocument> {
  try {
    validateDocumentUpload(documentData);

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    };

    const response = await apiClient.post<ClaimDocument>(
      `${API_ENDPOINTS.CLAIMS.BASE}/${claimId}/documents`,
      documentData,
      config
    );
    return response.data;
  } catch (error) {
    throw handleClaimsApiError(error as AxiosError);
  }
}

// Validation helpers
function validateClaimData(data: CreateClaimRequest): void {
  if (!data.policyId || !data.incidentDate || !data.description) {
    throw new Error('Required claim fields missing');
  }

  if (data.description.length > 2000) {
    throw new Error('Claim description exceeds maximum length');
  }

  if (!data.location || !data.claimantInfo) {
    throw new Error('Location and claimant information required');
  }
}

async function validateStatusTransition(claimId: string, newStatus: keyof typeof CLAIM_STATUS): Promise<void> {
  const currentClaim = await getClaimById(claimId);
  const allowedTransitions = CLAIM_STATUS[currentClaim.status];
  
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${currentClaim.status} to ${newStatus}`);
  }
}

function validateDocumentUpload(formData: FormData): void {
  const file = formData.get('file') as File;
  
  if (!file) {
    throw new Error('No file provided');
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE_MB}MB`);
  }

  const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
    throw new Error('File type not supported');
  }
}

// Error handling helper
function handleClaimsApiError(error: AxiosError): Error {
  interface ErrorResponse {
    message?: string;
    code?: string;
  }

  const baseError = new Error(
    (error.response?.data as ErrorResponse)?.message || 'An error occurred while processing the claim'
  );
  
  baseError.name = 'ClaimsApiError';
  (baseError as any).status = error.response?.status;
  (baseError as any).code = (error.response?.data as ErrorResponse)?.code;
  
  return baseError;
}

// Export claims API interface
export const claimsApi = {
  getClaims,
  getClaimById,
  createClaim,
  updateClaimStatus,
  uploadClaimDocument
};