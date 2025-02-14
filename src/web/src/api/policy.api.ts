/**
 * Policy API client module for MGA Operating System
 * Implements type-safe API operations for policy management with comprehensive error handling
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios';
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import { IPolicy, PolicyType, PolicyStatus, IEndorsement } from '../types/policy.types';
import { PaginationParams, ApiResponse } from '../types/common.types';

// Cache configuration
const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const policyCache = new Map<string, { data: IPolicy; timestamp: number }>();

// Types for policy filters
interface PolicyFilters {
  type?: PolicyType;
  status?: PolicyStatus;
  startDate?: string;
  endDate?: string;
  underwriter?: string;
}

/**
 * Retrieves a paginated list of policies with optional filtering
 * @param filters Optional filters for policy search
 * @param pagination Pagination parameters
 * @returns Promise resolving to paginated policy list
 */
export async function getPolicies(
  filters: PolicyFilters = {},
  pagination: PaginationParams
): Promise<AxiosResponse<ApiResponse<IPolicy[]>>> {
  const queryParams = new URLSearchParams({
    ...filters,
    page: pagination.page.toString(),
    limit: pagination.limit.toString(),
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder
  });

  return apiClient.get<ApiResponse<IPolicy[]>>(
    `${API_ENDPOINTS.POLICY.BASE}?${queryParams.toString()}`
  );
}

/**
 * Retrieves a single policy by ID with caching
 * @param policyId Unique policy identifier
 * @returns Promise resolving to policy details
 */
export async function getPolicyById(
  policyId: string
): Promise<AxiosResponse<ApiResponse<IPolicy>>> {
  // Check cache first
  const cached = policyCache.get(policyId);
  if (cached && Date.now() - cached.timestamp < POLICY_CACHE_TTL) {
    return {
      data: { success: true, data: cached.data, error: null },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    } as AxiosResponse<ApiResponse<IPolicy>>;
  }

  const response = await apiClient.get<ApiResponse<IPolicy>>(
    `${API_ENDPOINTS.POLICY.BASE}/${policyId}`
  );

  // Cache successful responses
  if (response.data.success) {
    policyCache.set(policyId, {
      data: response.data.data,
      timestamp: Date.now()
    });
  }

  return response;
}

/**
 * Creates a new policy
 * @param policy Policy data to create
 * @returns Promise resolving to created policy
 */
export async function createPolicy(
  policy: Omit<IPolicy, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AxiosResponse<ApiResponse<IPolicy>>> {
  return apiClient.post<ApiResponse<IPolicy>>(
    API_ENDPOINTS.POLICY.CREATE,
    policy
  );
}

/**
 * Updates an existing policy
 * @param policyId Policy identifier
 * @param updates Policy data to update
 * @returns Promise resolving to updated policy
 */
export async function updatePolicy(
  policyId: string,
  updates: Partial<IPolicy>
): Promise<AxiosResponse<ApiResponse<IPolicy>>> {
  // Invalidate cache
  policyCache.delete(policyId);

  return apiClient.put<ApiResponse<IPolicy>>(
    API_ENDPOINTS.POLICY.UPDATE.replace(':id', policyId),
    updates
  );
}

/**
 * Creates an endorsement for a policy
 * @param policyId Policy identifier
 * @param endorsement Endorsement data to add
 * @returns Promise resolving to updated policy with new endorsement
 */
export async function createEndorsement(
  policyId: string,
  endorsement: Omit<IEndorsement, 'id' | 'policyId'>
): Promise<AxiosResponse<ApiResponse<IPolicy>>> {
  // Invalidate cache
  policyCache.delete(policyId);

  return apiClient.post<ApiResponse<IPolicy>>(
    API_ENDPOINTS.POLICY.ENDORSEMENTS.replace(':id', policyId),
    endorsement
  );
}

/**
 * Binds a policy after approval
 * @param policyId Policy identifier
 * @returns Promise resolving to bound policy
 */
export async function bindPolicy(
  policyId: string
): Promise<AxiosResponse<ApiResponse<IPolicy>>> {
  // Invalidate cache
  policyCache.delete(policyId);

  return apiClient.put<ApiResponse<IPolicy>>(
    `${API_ENDPOINTS.POLICY.UPDATE.replace(':id', policyId)}/bind`,
    { status: PolicyStatus.BOUND }
  );
}

/**
 * Retrieves policy history
 * @param policyId Policy identifier
 * @returns Promise resolving to policy history
 */
export async function getPolicyHistory(
  policyId: string
): Promise<AxiosResponse<ApiResponse<Array<{ timestamp: string; changes: Record<string, any> }>>>> {
  return apiClient.get<ApiResponse<Array<{ timestamp: string; changes: Record<string, any> }>>>(
    API_ENDPOINTS.POLICY.HISTORY.replace(':id', policyId)
  );
}

/**
 * Cancels an active policy
 * @param policyId Policy identifier
 * @param reason Cancellation reason
 * @returns Promise resolving to cancelled policy
 */
export async function cancelPolicy(
  policyId: string,
  reason: string
): Promise<AxiosResponse<ApiResponse<IPolicy>>> {
  // Invalidate cache
  policyCache.delete(policyId);

  return apiClient.put<ApiResponse<IPolicy>>(
    `${API_ENDPOINTS.POLICY.UPDATE.replace(':id', policyId)}/cancel`,
    { reason, status: PolicyStatus.CANCELLED }
  );
}

/**
 * Retrieves policy documents
 * @param policyId Policy identifier
 * @returns Promise resolving to list of policy documents
 */
export async function getPolicyDocuments(
  policyId: string
): Promise<AxiosResponse<ApiResponse<IPolicy['documents']>>> {
  return apiClient.get<ApiResponse<IPolicy['documents']>>(
    `${API_ENDPOINTS.POLICY.BASE}/${policyId}/documents`
  );
}

/**
 * Clears the policy cache
 * Useful when needing to force fresh data
 */
export function clearPolicyCache(): void {
  policyCache.clear();
}