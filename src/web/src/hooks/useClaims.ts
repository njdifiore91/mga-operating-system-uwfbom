import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import useWebSocket from 'react-use-websocket';
import {
  claimsService,
} from '../services/claims.service';
import { Types } from '../types/claims.types';
import { CLAIM_STATUS, CLAIM_STATUS_TRANSITIONS } from '../constants/claims.constants';

// Types for hook state management
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface SortingState {
  sortBy: keyof Types.Claim;
  sortOrder: 'asc' | 'desc';
}

interface UploadProgressState {
  progress: number;
  fileName: string;
  status: 'idle' | 'uploading' | 'completed' | 'error';
}

interface ClaimOperations {
  fetchClaims: (filters?: Types.ClaimFilterParams) => Promise<void>;
  fetchClaimDetails: (claimId: string) => Promise<void>;
  submitClaim: (data: Types.ClaimFormData) => Promise<void>;
  updateClaimStatus: (claimId: string, data: Types.ClaimUpdateFormData) => Promise<void>;
  uploadDocuments: (claimId: string, files: File[]) => Promise<void>;
  validateStatusTransition: (currentStatus: keyof typeof CLAIM_STATUS, newStatus: keyof typeof CLAIM_STATUS) => boolean;
  resetState: () => void;
}

/**
 * Advanced React hook for managing claims state and operations
 * @param initialFilters Initial filter parameters for claims list
 * @param options Additional configuration options
 */
export function useClaims(
  initialFilters: Types.ClaimFilterParams = {},
  options: {
    autoFetch?: boolean;
    pageSize?: number;
    enableRealTimeUpdates?: boolean;
  } = {}
) {
  // State management
  const [claims, setClaims] = useState<Types.Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Types.Claim | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<Types.ClaimFilterParams>(initialFilters);
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
  const { lastMessage, sendMessage } = useWebSocket(
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

  // Effect for initial data fetch
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchClaims(filters);
    }
  }, [filters, pagination.page, pagination.pageSize, sorting.sortBy, sorting.sortOrder]);

  // Memoized operations
  const operations = useMemo<ClaimOperations>(() => ({
    fetchClaims: async (newFilters?: Types.ClaimFilterParams) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await claimsService.fetchClaimsList({
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
        const claim = await claimsService.fetchClaimDetails(claimId);
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

    submitClaim: async (data: Types.ClaimFormData) => {
      setIsLoading(true);
      setError(null);
      try {
        const newClaim = await claimsService.submitNewClaim(data);
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

    updateClaimStatus: async (claimId: string, data: Types.ClaimUpdateFormData) => {
      setIsLoading(true);
      setError(null);
      try {
        const isValid = await claimsService.validateClaimTransition(claimId, data.status);
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
          await claimsService.uploadClaimDocuments(claimId, file, (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              progress,
              fileName: file.name
            }));
          });
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

    validateStatusTransition: (currentStatus: keyof typeof CLAIM_STATUS, newStatus: keyof typeof CLAIM_STATUS): boolean => {
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