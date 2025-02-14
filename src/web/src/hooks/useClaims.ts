import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import useWebSocket from 'react-use-websocket';
import {
  claimsService,
} from '../services/claims.service';
import { Claim, ClaimFilterParams, ClaimFormData, ClaimUpdateFormData } from '../types/claims.types';
import { CLAIM_STATUS, CLAIM_STATUS_TRANSITIONS } from '../constants/claims.constants';

// Types for hook state management
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface SortingState {
  sortBy: keyof Claim;
  sortOrder: 'asc' | 'desc';
}

interface UploadProgressState {
  progress: number;
  fileName: string;
  status: 'idle' | 'uploading' | 'completed' | 'error';
}

interface ClaimOperations {
  fetchClaims: (filters?: ClaimFilterParams) => Promise<void>;
  fetchClaimDetails: (claimId: string) => Promise<void>;
  submitClaim: (data: ClaimFormData) => Promise<void>;
  updateClaimStatus: (claimId: string, data: ClaimUpdateFormData) => Promise<void>;
  uploadDocuments: (claimId: string, files: File[]) => Promise<void>;
  validateStatusTransition: (currentStatus: CLAIM_STATUS, newStatus: CLAIM_STATUS) => boolean;
  resetState: () => void;
}

/**
 * Advanced React hook for managing claims state and operations
 * @param initialFilters Initial filter parameters for claims list
 * @param options Additional configuration options
 */
export function useClaims(
  initialFilters: ClaimFilterParams = {},
  options: {
    autoFetch?: boolean;
    pageSize?: number;
    enableRealTimeUpdates?: boolean;
  } = {}
) {
  // State management
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<ClaimFilterParams>(initialFilters);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    progress: 0,
    fileName: '',
    status: 'idle'
  });

  // Pagination and sorting state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: options.pageSize || 10,
    total: 0
  });

  const [sorting, setSorting] = useState<SortingState>({
    sortBy: 'lastActivityDate',
    sortOrder: 'desc'
  });

  // Hooks initialization
  const toast = useToast();
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket(
    process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws/claims',
    {
      shouldReconnect: () => options.enableRealTimeUpdates !== false,
      reconnectAttempts: 5,
      reconnectInterval: 3000
    }
  );

  // Effect for real-time updates
  useEffect(() => {
    if (lastMessage && options.enableRealTimeUpdates !== false) {
      try {
        const update = JSON.parse(lastMessage.data);
        handleRealtimeUpdate(update);
      } catch (err) {
        console.error('Failed to process real-time update:', err);
      }
    }
  }, [lastMessage]);

  // Memoized operations
  const operations = useMemo<ClaimOperations>(() => ({
    fetchClaims: async (newFilters?: ClaimFilterParams) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await claimsService.fetchClaims({
          ...filters,
          ...newFilters,
          page: pagination.page,
          pageSize: pagination.pageSize,
          sortBy: sorting.sortBy,
          sortOrder: sorting.sortOrder
        });
        setClaims(response.claims);
        setPagination(prev => ({ ...prev, total: response.total }));
        if (newFilters) {
          setFilters(newFilters);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch claims'));
        toast({
          title: 'Error fetching claims',
          description: err instanceof Error ? err.message : 'Unknown error occurred',
          status: 'error',
          duration: 5000
        });
      } finally {
        setIsLoading(false);
      }
    },

    fetchClaimDetails: async (claimId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const claim = await claimsService.getClaimById(claimId);
        setSelectedClaim(claim);
        queryClient.setQueryData(['claim', claimId], claim);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch claim details'));
        toast({
          title: 'Error fetching claim details',
          status: 'error',
          duration: 5000
        });
      } finally {
        setIsLoading(false);
      }
    },

    submitClaim: async (data: ClaimFormData) => {
      setIsLoading(true);
      setError(null);
      try {
        const newClaim = await claimsService.submitClaim(data);
        setClaims(prev => [newClaim, ...prev]);
        toast({
          title: 'Claim submitted successfully',
          status: 'success',
          duration: 3000
        });
        return newClaim;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to submit claim'));
        toast({
          title: 'Error submitting claim',
          status: 'error',
          duration: 5000
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },

    updateClaimStatus: async (claimId: string, data: ClaimUpdateFormData) => {
      setIsLoading(true);
      setError(null);
      try {
        const isValid = await claimsService.validateStatusTransition(claimId, data.status);
        if (!isValid) {
          throw new Error('Invalid status transition');
        }
        const updatedClaim = await claimsService.updateClaimStatus(claimId, data);
        setClaims(prev => prev.map(claim => 
          claim.id === claimId ? updatedClaim : claim
        ));
        setSelectedClaim(updatedClaim);
        toast({
          title: 'Claim status updated',
          status: 'success',
          duration: 3000
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update claim status'));
        toast({
          title: 'Error updating claim status',
          status: 'error',
          duration: 5000
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },

    uploadDocuments: async (claimId: string, files: File[]) => {
      setUploadProgress({ progress: 0, fileName: files[0].name, status: 'uploading' });
      try {
        for (const file of files) {
          await claimsService.uploadDocument(claimId, file, 'OTHER');
        }
        setUploadProgress(prev => ({ ...prev, status: 'completed' }));
        operations.fetchClaimDetails(claimId);
        toast({
          title: 'Documents uploaded successfully',
          status: 'success',
          duration: 3000
        });
      } catch (err) {
        setUploadProgress(prev => ({ ...prev, status: 'error' }));
        toast({
          title: 'Error uploading documents',
          status: 'error',
          duration: 5000
        });
        throw err;
      }
    },

    validateStatusTransition: (currentStatus: CLAIM_STATUS, newStatus: CLAIM_STATUS): boolean => {
      return CLAIM_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
    },

    resetState: () => {
      setClaims([]);
      setSelectedClaim(null);
      setError(null);
      setPagination({ page: 1, pageSize: options.pageSize || 10, total: 0 });
      setFilters(initialFilters);
      setUploadProgress({ progress: 0, fileName: '', status: 'idle' });
    }
  }), [filters, pagination, sorting, toast, queryClient]);

  // Effect for initial data fetch
  useEffect(() => {
    if (options.autoFetch !== false) {
      operations.fetchClaims(filters);
    }
  }, [filters, pagination.page, pagination.pageSize, sorting.sortBy, sorting.sortOrder]);

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback((update: any) => {
    switch (update.type) {
      case 'CLAIM_CREATED':
        setClaims(prev => [update.claim, ...prev]);
        break;
      case 'CLAIM_UPDATED':
        setClaims(prev => prev.map(claim => 
          claim.id === update.claim.id ? update.claim : claim
        ));
        if (selectedClaim?.id === update.claim.id) {
          setSelectedClaim(update.claim);
        }
        break;
      case 'CLAIM_DELETED':
        setClaims(prev => prev.filter(claim => claim.id !== update.claimId));
        if (selectedClaim?.id === update.claimId) {
          setSelectedClaim(null);
        }
        break;
    }
  }, [selectedClaim]);

  return {
    // State
    claims,
    selectedClaim,
    isLoading,
    error,
    pagination,
    sorting,
    filters,
    uploadProgress,
    // Operations
    ...operations,
    // Additional state setters
    setPagination,
    setSorting,
    setFilters
  };
}