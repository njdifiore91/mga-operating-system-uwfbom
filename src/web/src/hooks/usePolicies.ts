/**
 * Custom React hook providing comprehensive policy management functionality
 * with enhanced pagination, filtering, caching, and error handling capabilities.
 * @version 1.0.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IPolicy, PolicyType, PolicyStatus, IEndorsement } from '../types/policy.types';
import { fetchPolicies, createPolicy, updatePolicy, bindPolicy } from '../store/actions/policy.actions';
import { selectPolicies, selectPolicyLoading, selectPolicyError, selectPolicyPagination } from '../store/selectors/policy.selectors';

// Cache configuration
const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_RETRY_ATTEMPTS = 3;

interface UsePoliciesOptions {
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  status?: PolicyStatus;
  type?: PolicyType;
  retryAttempts?: number;
  cacheTimeout?: number;
}

/**
 * Enhanced custom hook for policy management with caching and pagination
 */
export const usePolicies = (options: UsePoliciesOptions = {}) => {
  const {
    autoFetch = true,
    page = 1,
    limit = 10,
    status,
    type,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
    cacheTimeout = DEFAULT_CACHE_TIMEOUT,
  } = options;

  const dispatch = useDispatch();
  const policies = useSelector(selectPolicies);
  const loading = useSelector(selectPolicyLoading);
  const error = useSelector(selectPolicyError);
  const pagination = useSelector(selectPolicyPagination);

  // Local state for request tracking
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Memoized filters
  const filters = useMemo(() => {
    const filterObj: Partial<IPolicy> = {};
    if (status) filterObj.status = status;
    if (type) filterObj.type = type;
    return filterObj;
  }, [status, type]);

  /**
   * Fetches policies with retry logic and caching
   */
  const fetchPoliciesList = useCallback(
    async (params?: { page?: number; limit?: number }) => {
      try {
        const currentTime = Date.now();
        if (currentTime - lastFetchTime < cacheTimeout) {
          return; // Use cached data
        }

        const response = await dispatch(
          fetchPolicies({
            filters,
            page: params?.page || page,
            limit: params?.limit || limit,
          })
        ).unwrap();

        setLastFetchTime(currentTime);
        setRetryCount(0);
        return response;
      } catch (error) {
        if (retryCount < retryAttempts) {
          setRetryCount((prev) => prev + 1);
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchPoliciesList(params);
        }
        throw error;
      }
    },
    [dispatch, filters, page, limit, lastFetchTime, retryCount, retryAttempts, cacheTimeout]
  );

  /**
   * Creates a new policy with optimistic updates
   */
  const createNewPolicy = useCallback(
    async (data: Omit<IPolicy, 'id'>) => {
      const response = await dispatch(createPolicy(data)).unwrap();
      await fetchPoliciesList(); // Refresh list after creation
      return response;
    },
    [dispatch, fetchPoliciesList]
  );

  /**
   * Updates an existing policy
   */
  const updateExistingPolicy = useCallback(
    async (id: string, data: Partial<IPolicy>) => {
      const response = await dispatch(
        updatePolicy({ policyId: id, updates: data })
      ).unwrap();
      await fetchPoliciesList(); // Refresh list after update
      return response;
    },
    [dispatch, fetchPoliciesList]
  );

  /**
   * Binds an approved policy
   */
  const bindExistingPolicy = useCallback(
    async (id: string) => {
      const response = await dispatch(bindPolicy(id)).unwrap();
      await fetchPoliciesList(); // Refresh list after binding
      return response;
    },
    [dispatch, fetchPoliciesList]
  );

  /**
   * Adds an endorsement to a policy
   */
  const addEndorsement = useCallback(
    async (policyId: string, data: Omit<IEndorsement, 'id'>) => {
      const response = await dispatch(
        updatePolicy({ policyId, updates: { endorsements: data } })
      ).unwrap();
      await fetchPoliciesList(); // Refresh list after endorsement
      return response;
    },
    [dispatch, fetchPoliciesList]
  );

  /**
   * Forces a refresh of the policy list
   */
  const refreshPolicies = useCallback(async () => {
    setLastFetchTime(0); // Reset cache
    return fetchPoliciesList();
  }, [fetchPoliciesList]);

  /**
   * Clears the policy cache
   */
  const clearCache = useCallback(() => {
    setLastFetchTime(0);
  }, []);

  // Auto-fetch effect
  useEffect(() => {
    if (autoFetch) {
      fetchPoliciesList();
    }
  }, [autoFetch, fetchPoliciesList, page, limit, status, type]);

  return {
    // Data
    policies,
    loading,
    error,
    totalPolicies: pagination.total,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    hasNextPage: pagination.currentPage < pagination.totalPages,
    hasPreviousPage: pagination.currentPage > 1,

    // Actions
    fetchPolicies: fetchPoliciesList,
    createPolicy: createNewPolicy,
    updatePolicy: updateExistingPolicy,
    bindPolicy: bindExistingPolicy,
    addEndorsement,
    refreshPolicies,
    clearCache,
  };
};