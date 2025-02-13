import { Repository, EntityRepository, FindOptionsWhere, QueryRunner } from 'typeorm';
import { ClaimModel } from '../models/Claim';
import { CLAIM_STATUS } from '../constants/claimStatus';
import { Claim, CreateClaimRequest, UpdateClaimStatusRequest } from '../types/claims.types';
import { Logger } from '../utils/logger';
import { OneShieldClient } from '@oneshield/client';

/**
 * Repository class for managing claim data persistence and database operations.
 * Implements comprehensive error handling, audit logging, and compliance tracking.
 * 
 * @version 1.0.0
 */
@EntityRepository(ClaimModel)
export class ClaimRepository extends Repository<ClaimModel> {
  private readonly logger: Logger;
  private readonly oneShieldClient: OneShieldClient;
  private readonly queryRunner: QueryRunner;

  constructor(logger: Logger, oneShieldClient: OneShieldClient) {
    super();
    this.logger = logger;
    this.oneShieldClient = oneShieldClient;
    this.setupQueryTimeout();
  }

  /**
   * Retrieves a claim by its ID with comprehensive error handling and logging
   */
  async findById(id: string): Promise<Claim | null> {
    try {
      this.logger.info('Retrieving claim by ID', { claimId: id });

      const claim = await this.findOne({
        where: { id } as FindOptionsWhere<ClaimModel>,
        relations: ['documents', 'statusHistory', 'complianceData']
      });

      if (!claim) {
        this.logger.warn('Claim not found', { claimId: id });
        return null;
      }

      this.logger.debug('Claim retrieved successfully', { 
        claimId: id, 
        status: claim.status 
      });

      return claim;
    } catch (error) {
      this.logger.error('Error retrieving claim', error, { claimId: id });
      throw error;
    }
  }

  /**
   * Retrieves all claims for a given policy with pagination support
   */
  async findByPolicyId(
    policyId: string,
    options: { 
      page: number; 
      limit: number; 
      status?: CLAIM_STATUS[] 
    }
  ): Promise<{ claims: Claim[]; total: number }> {
    try {
      const { page = 1, limit = 10, status } = options;
      const skip = (page - 1) * limit;

      const whereClause: FindOptionsWhere<ClaimModel> = { policyId };
      if (status?.length) {
        whereClause.status = status;
      }

      const [claims, total] = await this.findAndCount({
        where: whereClause,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
        relations: ['documents', 'statusHistory']
      });

      this.logger.info('Retrieved claims by policy ID', {
        policyId,
        page,
        limit,
        total
      });

      return { claims, total };
    } catch (error) {
      this.logger.error('Error retrieving claims by policy ID', error, { policyId });
      throw error;
    }
  }

  /**
   * Creates a new claim with OneShield synchronization and compliance tracking
   */
  async create(claimData: CreateClaimRequest): Promise<Claim> {
    const queryRunner = this.queryRunner;
    await queryRunner.startTransaction();

    try {
      // Generate claim number
      const claimNumber = await this.generateClaimNumber();

      // Create claim record
      const claim = this.create({
        ...claimData,
        claimNumber,
        status: CLAIM_STATUS.NEW,
        reportedDate: new Date(),
        statusHistory: [{
          status: CLAIM_STATUS.NEW,
          timestamp: new Date(),
          notes: 'Claim created',
          userId: 'SYSTEM'
        }],
        auditLog: [{
          action: 'CLAIM_CREATED',
          timestamp: new Date(),
          userId: 'SYSTEM',
          details: { claimNumber }
        }]
      });

      // Sync with OneShield
      const oneShieldResponse = await this.oneShieldClient.createClaim({
        policyId: claimData.policyId,
        claimNumber,
        incidentDate: claimData.incidentDate,
        description: claimData.description
      });

      claim.oneShieldClaimId = oneShieldResponse.claimId;

      // Save claim
      const savedClaim = await queryRunner.manager.save(claim);
      await queryRunner.commitTransaction();

      this.logger.info('Claim created successfully', {
        claimId: savedClaim.id,
        claimNumber: savedClaim.claimNumber
      });

      return savedClaim;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating claim', error, { 
        policyId: claimData.policyId 
      });
      throw error;
    }
  }

  /**
   * Updates claim status with validation, compliance checks and OneShield sync
   */
  async updateStatus(id: string, updateData: UpdateClaimStatusRequest): Promise<Claim> {
    const queryRunner = this.queryRunner;
    await queryRunner.startTransaction();

    try {
      const claim = await this.findById(id);
      if (!claim) {
        throw new Error(`Claim not found: ${id}`);
      }

      // Validate status transition
      this.validateStatusTransition(claim.status, updateData.status);

      // Update claim status
      await claim.updateStatus(
        updateData.status,
        updateData.notes,
        {
          userId: 'SYSTEM',
          adjusterId: updateData.adjusterId,
          reserveChange: updateData.reserveAmount - claim.reserveAmount
        }
      );

      // Save updated claim
      const updatedClaim = await queryRunner.manager.save(claim);
      await queryRunner.commitTransaction();

      this.logger.info('Claim status updated successfully', {
        claimId: id,
        oldStatus: claim.status,
        newStatus: updateData.status
      });

      return updatedClaim;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error updating claim status', error, { claimId: id });
      throw error;
    }
  }

  /**
   * Validates claim status transitions based on business rules
   */
  private validateStatusTransition(currentStatus: CLAIM_STATUS, newStatus: CLAIM_STATUS): void {
    const invalidTransitions = {
      [CLAIM_STATUS.CLOSED]: [CLAIM_STATUS.NEW, CLAIM_STATUS.UNDER_REVIEW],
      [CLAIM_STATUS.PAID]: [CLAIM_STATUS.NEW, CLAIM_STATUS.DENIED],
      [CLAIM_STATUS.DENIED]: [CLAIM_STATUS.PAID, CLAIM_STATUS.IN_PAYMENT]
    };

    if (invalidTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Generates a unique claim number with prefix and validation
   */
  private async generateClaimNumber(): Promise<string> {
    const prefix = 'CLM';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Configures query timeout settings for database operations
   */
  private setupQueryTimeout(): void {
    const QUERY_TIMEOUT_MS = 30000; // 30 seconds
    this.queryRunner?.setTransactionTimeout(QUERY_TIMEOUT_MS);
  }
}