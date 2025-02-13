/**
 * Claims Management Service
 * Provides comprehensive business logic for claims operations with OneShield integration
 * @version 1.0.0
 */

import { format, isValid, parseISO } from 'date-fns'; // ^2.30.0
import retry from 'axios-retry'; // ^3.8.0
import {
  claimsApi,
} from '../api/claims.api';
import {
  Claim,
  CreateClaimRequest,
  UpdateClaimStatusRequest,
  ClaimDocument,
  ClaimLocation,
  ClaimantInfo
} from '../types/claims.types';
import {
  CLAIM_STATUS,
  CLAIM_DOCUMENT_TYPES,
  MAX_FILE_SIZE_MB,
  ALLOWED_FILE_TYPES,
  CLAIM_STATUS_TRANSITIONS
} from '../constants/claims.constants';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

// Retry configuration for API calls
retry(claimsApi, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) => {
    return retry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === 429;
  }
});

/**
 * Claims service providing enhanced business logic and data management
 */
class ClaimsService {
  /**
   * Fetches claims with caching, pagination, and sorting
   */
  async fetchClaims(
    filters: Partial<Claim> = {},
    pagination: { page: number; pageSize: number },
    sorting: { sortBy: keyof Claim; sortOrder: 'asc' | 'desc' }
  ): Promise<{ claims: Claim[]; total: number; cached: boolean }> {
    const cacheKey = this.generateCacheKey(filters, pagination, sorting);
    const cachedData = this.getFromCache(cacheKey);

    if (cachedData) {
      return { ...cachedData, cached: true };
    }

    const response = await claimsApi.getClaims({
      ...filters,
      ...pagination,
      ...sorting
    });

    const processedClaims = response.data.map(this.processClaim);
    const result = {
      claims: processedClaims,
      total: response.total,
      cached: false
    };

    this.setInCache(cacheKey, result);
    return result;
  }

  /**
   * Submits a new claim with validation and OneShield synchronization
   */
  async submitClaim(claimData: CreateClaimRequest): Promise<Claim> {
    this.validateClaimData(claimData);
    
    const processedData = {
      ...claimData,
      incidentDate: this.formatDate(claimData.incidentDate),
      initialReserve: this.formatCurrency(claimData.initialReserve)
    };

    const claim = await claimsApi.createClaim(processedData);
    
    try {
      await claimsApi.syncWithOneShield(claim.id);
    } catch (error) {
      console.error('OneShield sync failed:', error);
      // Continue with claim creation even if sync fails
    }

    this.invalidateCache();
    return this.processClaim(claim);
  }

  /**
   * Updates claim status with validation and workflow rules
   */
  async updateClaimStatus(
    claimId: string,
    updateData: UpdateClaimStatusRequest
  ): Promise<Claim> {
    const currentClaim = await claimsApi.getClaimById(claimId);
    this.validateStatusTransition(currentClaim.status, updateData.status);

    const updatedClaim = await claimsApi.updateClaimStatus(claimId, updateData);
    this.invalidateCache();
    return this.processClaim(updatedClaim);
  }

  /**
   * Uploads claim documents with security scanning and validation
   */
  async uploadDocument(
    claimId: string,
    file: File,
    documentType: keyof typeof CLAIM_DOCUMENT_TYPES
  ): Promise<ClaimDocument> {
    this.validateDocument(file);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', documentType);
    formData.append('claimId', claimId);

    const document = await claimsApi.uploadClaimDocument(claimId, formData);
    this.invalidateCache();
    return document;
  }

  // Private helper methods
  private processClaim(claim: Claim): Claim {
    return {
      ...claim,
      incidentDate: parseISO(claim.incidentDate.toString()),
      reportedDate: parseISO(claim.reportedDate.toString()),
      createdAt: parseISO(claim.createdAt.toString()),
      updatedAt: parseISO(claim.updatedAt.toString()),
      lastActivityDate: parseISO(claim.lastActivityDate.toString())
    };
  }

  private validateClaimData(data: CreateClaimRequest): void {
    if (!data.policyId || !data.incidentDate || !data.description) {
      throw new Error('Required claim fields missing');
    }

    if (!isValid(new Date(data.incidentDate))) {
      throw new Error('Invalid incident date');
    }

    if (!this.validateLocation(data.location)) {
      throw new Error('Invalid location data');
    }

    if (!this.validateClaimant(data.claimantInfo)) {
      throw new Error('Invalid claimant information');
    }
  }

  private validateLocation(location: ClaimLocation): boolean {
    return !!(
      location &&
      location.address &&
      location.city &&
      location.state &&
      location.zipCode &&
      location.country
    );
  }

  private validateClaimant(claimant: ClaimantInfo): boolean {
    return !!(
      claimant &&
      claimant.firstName &&
      claimant.lastName &&
      claimant.email &&
      claimant.phone
    );
  }

  private validateStatusTransition(
    currentStatus: keyof typeof CLAIM_STATUS,
    newStatus: keyof typeof CLAIM_STATUS
  ): void {
    const allowedTransitions = CLAIM_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private validateDocument(file: File): void {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE_MB}MB`);
    }

    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
      throw new Error('File type not supported');
    }
  }

  private formatDate(date: Date): string {
    return format(date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx');
  }

  private formatCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  private generateCacheKey(
    filters: object,
    pagination: object,
    sorting: object
  ): string {
    return JSON.stringify({ filters, pagination, sorting });
  }

  private getFromCache(key: string): any {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setInCache(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(): void {
    cache.clear();
  }
}

// Export singleton instance
export const claimsService = new ClaimsService();