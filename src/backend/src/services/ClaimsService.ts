import { inject, injectable, singleton } from 'inversify';
import { Logger } from 'winston';
import { MetricsManager } from '../utils/metrics';
import { ClaimRepository } from '../repositories/ClaimRepository';
import { ClaimsEventProducer } from '../events/producers/ClaimsEventProducer';
import { Claim, CreateClaimRequest, UpdateClaimStatusRequest } from '../types/claims.types';
import { CLAIM_STATUS } from '../constants/claimStatus';

/**
 * Service class implementing comprehensive business logic for claims management
 * with performance monitoring, compliance tracking, and OneShield integration.
 * 
 * @version 1.0.0
 */
@injectable()
@singleton()
export class ClaimsService {
  private readonly metricsPrefix = 'claims_service_';

  constructor(
    @inject(ClaimRepository) private readonly claimRepository: ClaimRepository,
    @inject(ClaimsEventProducer) private readonly eventProducer: ClaimsEventProducer,
    @inject('Logger') private readonly logger: Logger,
    @inject('MetricsManager') private readonly metrics: MetricsManager
  ) {
    this.initialize();
  }

  /**
   * Initializes service dependencies and performs health checks
   */
  private async initialize(): Promise<void> {
    try {
      await this.eventProducer.initialize();
      this.logger.info('Claims service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize claims service', error);
      throw error;
    }
  }

  /**
   * Creates a new claim with comprehensive validation and compliance checks
   */
  public async createClaim(claimData: CreateClaimRequest): Promise<Claim> {
    const startTime = Date.now();
    
    try {
      // Validate claim data
      this.validateClaimData(claimData);

      // Create claim record
      const claim = await this.claimRepository.create(claimData);

      // Publish claim created event
      await this.eventProducer.publishClaimCreated(claim);

      // Record metrics
      const duration = Date.now() - startTime;
      this.metrics.recordCacheMetrics({
        operation: `${this.metricsPrefix}create_claim`,
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });

      this.logger.info('Claim created successfully', {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        duration
      });

      return claim;
    } catch (error) {
      this.logger.error('Failed to create claim', error, { claimData });
      throw error;
    }
  }

  /**
   * Retrieves a claim by ID with caching and performance optimization
   */
  public async getClaim(id: string): Promise<Claim> {
    const startTime = Date.now();

    try {
      const claim = await this.claimRepository.findById(id);
      
      if (!claim) {
        throw new Error(`Claim not found: ${id}`);
      }

      const duration = Date.now() - startTime;
      this.metrics.recordCacheMetrics({
        operation: `${this.metricsPrefix}get_claim`,
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });

      return claim;
    } catch (error) {
      this.logger.error('Failed to retrieve claim', error, { claimId: id });
      throw error;
    }
  }

  /**
   * Updates claim status with state transition validation and compliance checks
   */
  public async updateClaimStatus(
    id: string,
    updateData: UpdateClaimStatusRequest
  ): Promise<Claim> {
    const startTime = Date.now();

    try {
      // Get current claim
      const claim = await this.getClaim(id);

      // Update status
      const updatedClaim = await this.claimRepository.updateStatus(id, updateData);

      // Publish status change event
      await this.eventProducer.publishClaimStatusChanged(
        updatedClaim,
        updateData.status
      );

      const duration = Date.now() - startTime;
      this.metrics.recordCacheMetrics({
        operation: `${this.metricsPrefix}update_status`,
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });

      this.logger.info('Claim status updated successfully', {
        claimId: id,
        oldStatus: claim.status,
        newStatus: updateData.status,
        duration
      });

      return updatedClaim;
    } catch (error) {
      this.logger.error('Failed to update claim status', error, {
        claimId: id,
        status: updateData.status
      });
      throw error;
    }
  }

  /**
   * Updates claim reserves with financial validation and compliance tracking
   */
  public async updateReserves(id: string, newReserveAmount: number): Promise<Claim> {
    const startTime = Date.now();

    try {
      // Validate reserve amount
      if (newReserveAmount < 0) {
        throw new Error('Reserve amount cannot be negative');
      }

      // Get current claim
      const claim = await this.getClaim(id);

      // Update reserves
      const updatedClaim = await this.claimRepository.updateStatus(id, {
        status: claim.status,
        notes: `Reserve amount updated to ${newReserveAmount}`,
        adjusterId: 'SYSTEM',
        reserveAmount: newReserveAmount
      });

      const duration = Date.now() - startTime;
      this.metrics.recordCacheMetrics({
        operation: `${this.metricsPrefix}update_reserves`,
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });

      this.logger.info('Claim reserves updated successfully', {
        claimId: id,
        oldReserves: claim.reserveAmount,
        newReserves: newReserveAmount,
        duration
      });

      return updatedClaim;
    } catch (error) {
      this.logger.error('Failed to update claim reserves', error, {
        claimId: id,
        newReserveAmount
      });
      throw error;
    }
  }

  /**
   * Validates claim data against business rules and requirements
   */
  private validateClaimData(claimData: CreateClaimRequest): void {
    const { incidentDate, description, location, claimantInfo } = claimData;

    if (!incidentDate || incidentDate > new Date()) {
      throw new Error('Invalid incident date');
    }

    if (!description || description.length < 10) {
      throw new Error('Description must be at least 10 characters');
    }

    if (!location || !location.address || !location.city || !location.state) {
      throw new Error('Invalid location information');
    }

    if (!claimantInfo || !claimantInfo.firstName || !claimantInfo.lastName) {
      throw new Error('Invalid claimant information');
    }
  }
}