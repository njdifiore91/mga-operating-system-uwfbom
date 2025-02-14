/**
 * Policy Service for MGA Operating System Web Frontend
 * Handles policy management operations with comprehensive error handling, caching, and data transformation
 * @version 1.0.0
 */

import {
  getPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  addPolicyEndorsement,
  cancelPolicy
} from '../api/policy.api';
import {
  IPolicy,
  PolicyType,
  PolicyStatus,
  IEndorsement
} from '../types/policy.types';

// Cache configuration
const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const policyCache = new Map<string, { data: IPolicy; timestamp: number }>();
const listCache = new Map<string, { data: IPolicy[]; total: number; timestamp: number }>();

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Policy Service class implementing core policy management functionality
 */
export class PolicyService {
  /**
   * Validates policy data with OneShield integration
   * @param policyData Policy data to validate
   * @returns Promise resolving to validation result
   */
  static async validateWithOneShield(policyData: Partial<IPolicy>): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      // Call OneShield validation API
      const response = await fetch(`${process.env.REACT_APP_ONESHIELD_API_URL}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_ONESHIELD_API_KEY || ''
        },
        body: JSON.stringify(policyData)
      });

      const result = await response.json();

      return {
        isValid: result.valid,
        errors: result.errors || []
      };
    } catch (error) {
      console.error('OneShield validation error:', error);
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of policies with optional filtering
   * @param filters Optional filters for policy search
   * @param page Page number for pagination
   * @param limit Items per page
   * @returns Promise resolving to policy list with pagination info
   */
  static async fetchPolicies(
    filters: Partial<{ type: PolicyType; status: PolicyStatus }> = {},
    page = 1,
    limit = 10
  ): Promise<{ policies: IPolicy[]; total: number }> {
    try {
      // Generate cache key based on filters and pagination
      const cacheKey = `${JSON.stringify(filters)}-${page}-${limit}`;
      const cached = listCache.get(cacheKey);

      // Return cached data if valid
      if (cached && Date.now() - cached.timestamp < POLICY_CACHE_TTL) {
        return { policies: cached.data, total: cached.total };
      }

      // Fetch policies with retry logic
      let attempt = 0;
      let error: Error | null = null;

      while (attempt < MAX_RETRIES) {
        try {
          const response = await getPolicies(filters, { page, limit, sortBy: 'updatedAt', sortOrder: 'desc' });
          const { data, success } = response.data;

          if (!success) throw new Error('Failed to fetch policies');

          // Cache successful response
          listCache.set(cacheKey, {
            data,
            total: data.length,
            timestamp: Date.now()
          });

          return {
            policies: data,
            total: data.length
          };
        } catch (e) {
          error = e as Error;
          attempt++;
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }
        }
      }

      throw error || new Error('Failed to fetch policies after retries');
    } catch (error) {
      console.error('Policy fetch error:', error);
      throw error;
    }
  }

  /**
   * Retrieves detailed information for a single policy
   * @param policyId Unique policy identifier
   * @returns Promise resolving to policy details
   */
  static async fetchPolicyDetails(policyId: string): Promise<IPolicy> {
    try {
      // Check cache first
      const cached = policyCache.get(policyId);
      if (cached && Date.now() - cached.timestamp < POLICY_CACHE_TTL) {
        return cached.data;
      }

      const response = await getPolicyById(policyId);
      const { data, success } = response.data;

      if (!success || !data) {
        throw new Error('Failed to fetch policy details');
      }

      // Cache successful response
      policyCache.set(policyId, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Policy details fetch error:', error);
      throw error;
    }
  }

  /**
   * Creates and submits a new policy application
   * @param policyData Policy data to create
   * @returns Promise resolving to created policy
   */
  static async submitNewPolicy(policyData: Omit<IPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPolicy> {
    try {
      // Validate required fields
      if (!policyData.type || !policyData.effectiveDate || !policyData.coverages) {
        throw new Error('Missing required policy fields');
      }

      const response = await createPolicy(policyData);
      const { data, success } = response.data;

      if (!success || !data) {
        throw new Error('Failed to create policy');
      }

      // Invalidate list cache
      listCache.clear();

      return data;
    } catch (error) {
      console.error('Policy creation error:', error);
      throw error;
    }
  }

  /**
   * Updates an existing policy's information
   * @param policyId Policy identifier
   * @param policyData Policy data to update
   * @returns Promise resolving to updated policy
   */
  static async updatePolicyDetails(
    policyId: string,
    policyData: Partial<IPolicy>
  ): Promise<IPolicy> {
    try {
      // Optimistic cache update
      const currentPolicy = policyCache.get(policyId)?.data;
      if (currentPolicy) {
        policyCache.set(policyId, {
          data: { ...currentPolicy, ...policyData },
          timestamp: Date.now()
        });
      }

      const response = await updatePolicy(policyId, policyData);
      const { data, success } = response.data;

      if (!success || !data) {
        // Revert cache on failure
        if (currentPolicy) {
          policyCache.set(policyId, {
            data: currentPolicy,
            timestamp: Date.now()
          });
        }
        throw new Error('Failed to update policy');
      }

      // Update cache with confirmed data
      policyCache.set(policyId, {
        data,
        timestamp: Date.now()
      });

      // Invalidate list cache
      listCache.clear();

      return data;
    } catch (error) {
      console.error('Policy update error:', error);
      throw error;
    }
  }

  /**
   * Creates and submits a new policy endorsement
   * @param policyId Policy identifier
   * @param endorsementData Endorsement data to add
   * @returns Promise resolving to updated policy with new endorsement
   */
  static async submitEndorsement(
    policyId: string,
    endorsementData: Omit<IEndorsement, 'id' | 'policyId'>
  ): Promise<IEndorsement> {
    try {
      const response = await addPolicyEndorsement(policyId, endorsementData);
      const { data, success } = response.data;

      if (!success || !data) {
        throw new Error('Failed to create endorsement');
      }

      // Invalidate policy cache
      policyCache.delete(policyId);

      return data;
    } catch (error) {
      console.error('Endorsement creation error:', error);
      throw error;
    }
  }

  /**
   * Binds an approved policy to make it active
   * @param policyId Policy identifier
   * @returns Promise resolving to bound policy
   */
  static async bindApprovedPolicy(policyId: string): Promise<IPolicy> {
    try {
      // Verify policy is in approved status
      const currentPolicy = await PolicyService.fetchPolicyDetails(policyId);
      if (currentPolicy.status !== PolicyStatus.APPROVED) {
        throw new Error('Policy must be approved before binding');
      }

      // Optimistic cache update
      policyCache.set(policyId, {
        data: { ...currentPolicy, status: PolicyStatus.BOUND },
        timestamp: Date.now()
      });

      const response = await updatePolicy(policyId, { status: PolicyStatus.BOUND });
      const { data, success } = response.data;

      if (!success || !data) {
        // Revert cache on failure
        policyCache.set(policyId, {
          data: currentPolicy,
          timestamp: Date.now()
        });
        throw new Error('Failed to bind policy');
      }

      // Update cache with confirmed data
      policyCache.set(policyId, {
        data,
        timestamp: Date.now()
      });

      // Invalidate list cache
      listCache.clear();

      return data;
    } catch (error) {
      console.error('Policy binding error:', error);
      throw error;
    }
  }

  /**
   * Clears all policy-related caches
   * Useful when needing to force fresh data
   */
  static clearCache(): void {
    policyCache.clear();
    listCache.clear();
  }
}

export default PolicyService;