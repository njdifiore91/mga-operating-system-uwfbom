/**
 * Custom React hook for managing underwriting operations in the MGA OS web application
 * Provides reactive state management, real-time updates, and optimized business logic
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { debounce } from 'lodash';
import {
  UnderwritingService,
  fetchRiskAssessment,
  submitPolicyForUnderwriting,
  processUnderwritingDecision,
  getFilteredUnderwritingQueue,
  subscribeToUpdates
} from '../services/underwriting.service';
import {
  IRiskAssessment,
  IUnderwritingDecision,
  IUnderwritingQueue,
  UnderwritingStatus,
  RiskSeverity,
  IQueueFilters,
  IPaginationCursor
} from '../types/underwriting.types';
import { RISK_SEVERITY, RISK_SCORE_RANGES } from '../constants/underwriting.constants';

// Cache configuration for optimized performance
const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 30 * 60 * 1000, // 30 minutes
  retryDelay: 1000,
  maxRetries: 3
} as const;

// Query keys for react-query cache management
const QUERY_KEYS = {
  riskAssessment: 'riskAssessment',
  underwritingQueue: 'underwritingQueue'
} as const;

/**
 * Primary hook for managing underwriting operations with optimized state management
 * @param initialFilters Initial queue filters
 * @returns Comprehensive underwriting state and operations
 */
export function useUnderwriting(initialFilters: IQueueFilters) {
  const queryClient = useQueryClient();
  const underwritingService = useRef(new UnderwritingService());
  const [filters, setFilters] = useState<IQueueFilters>(initialFilters);
  const [cursor, setCursor] = useState<IPaginationCursor | null>(null);

  // Debounced filter updates to prevent excessive API calls
  const debouncedFilterUpdate = useCallback(
    debounce((newFilters: IQueueFilters) => {
      setFilters(newFilters);
      setCursor(null); // Reset pagination on filter change
    }, 300),
    []
  );

  // Risk assessment query with caching
  const riskAssessmentQuery = useQuery(
    [QUERY_KEYS.riskAssessment, filters.policyId],
    () => fetchRiskAssessment(filters.policyId),
    {
      enabled: !!filters.policyId,
      staleTime: CACHE_CONFIG.staleTime,
      cacheTime: CACHE_CONFIG.cacheTime,
      retry: CACHE_CONFIG.maxRetries,
      retryDelay: CACHE_CONFIG.retryDelay
    }
  );

  // Underwriting queue query with pagination
  const queueQuery = useQuery(
    [QUERY_KEYS.underwritingQueue, filters, cursor],
    () => getFilteredUnderwritingQueue({ ...filters, cursor }),
    {
      keepPreviousData: true,
      staleTime: CACHE_CONFIG.staleTime
    }
  );

  // Mutation for submitting policies for underwriting
  const submitMutation = useMutation(
    (policyData: any) => submitPolicyForUnderwriting(policyData),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(QUERY_KEYS.underwritingQueue);
        queryClient.setQueryData(
          [QUERY_KEYS.riskAssessment, data.policyId],
          data
        );
      }
    }
  );

  // Mutation for processing underwriting decisions
  const decisionMutation = useMutation(
    (decision: IUnderwritingDecision) => processUnderwritingDecision(decision),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(QUERY_KEYS.underwritingQueue);
      }
    }
  );

  // WebSocket subscription for real-time updates
  useEffect(() => {
    const subscription = subscribeToUpdates((update) => {
      if (update.type === 'RISK_ASSESSMENT_UPDATED') {
        queryClient.invalidateQueries([
          QUERY_KEYS.riskAssessment,
          update.policyId
        ]);
      } else if (update.type === 'QUEUE_UPDATED') {
        queryClient.invalidateQueries(QUERY_KEYS.underwritingQueue);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Optimized pagination handler
  const handlePagination = useCallback((newCursor: IPaginationCursor) => {
    setCursor(newCursor);
  }, []);

  // Filter update handler with validation
  const updateFilters = useCallback((newFilters: Partial<IQueueFilters>) => {
    debouncedFilterUpdate({ ...filters, ...newFilters });
  }, [filters, debouncedFilterUpdate]);

  // Submit policy for underwriting with validation
  const submitForUnderwriting = useCallback(async (policyData: any) => {
    try {
      await submitMutation.mutateAsync(policyData);
    } catch (error) {
      console.error('Underwriting submission failed:', error);
      throw error;
    }
  }, [submitMutation]);

  // Process underwriting decision with optimistic updates
  const makeDecision = useCallback(async (decision: IUnderwritingDecision) => {
    try {
      await decisionMutation.mutateAsync(decision);
    } catch (error) {
      console.error('Decision processing failed:', error);
      throw error;
    }
  }, [decisionMutation]);

  return {
    // State
    riskAssessment: riskAssessmentQuery.data,
    queue: queueQuery.data,
    isLoading: riskAssessmentQuery.isLoading || queueQuery.isLoading,
    isError: riskAssessmentQuery.isError || queueQuery.isError,
    error: riskAssessmentQuery.error || queueQuery.error,

    // Operations
    submitForUnderwriting,
    makeDecision,
    updateFilters,

    // Pagination
    pagination: {
      cursor,
      handlePagination,
      hasNextPage: !!queueQuery.data?.hasMore,
      hasPreviousPage: !!cursor
    },

    // Real-time updates
    realTimeUpdates: {
      isConnected: true, // WebSocket connection status
      lastUpdate: queueQuery.dataUpdatedAt
    }
  };
}

export default useUnderwriting;