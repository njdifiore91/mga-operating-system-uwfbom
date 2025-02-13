/**
 * @file EndorsementRepository implementation for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Transaction, Op } from 'sequelize'; // ^6.32.1
import { retry } from 'retry-ts'; // ^0.1.4
import { CacheManager } from 'cache-manager'; // ^5.2.0
import { Endorsement } from '../models/Endorsement';
import { IEndorsement } from '../types/policy.types';
import { getSequelize } from '../config/database';
import { error, info } from '../utils/logger';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'endorsement:';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Repository class implementing data access layer for policy endorsements
 * with comprehensive transaction support, caching, and error handling
 */
export class EndorsementRepository {
    private sequelize;
    private cacheManager: CacheManager;
    private maxRetries: number;
    private retryDelay: number;

    /**
     * Initializes repository with enhanced configuration
     * @param cacheManager Cache manager instance
     * @param maxRetries Maximum retry attempts for operations
     * @param retryDelay Delay between retry attempts in ms
     */
    constructor(
        cacheManager: CacheManager,
        maxRetries: number = MAX_RETRIES,
        retryDelay: number = RETRY_DELAY
    ) {
        this.sequelize = getSequelize();
        this.cacheManager = cacheManager;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }

    /**
     * Creates a new endorsement with validation and audit logging
     * @param endorsementData Endorsement data to create
     * @param transaction Optional transaction for atomic operations
     * @returns Created endorsement record
     */
    public async create(
        endorsementData: IEndorsement,
        transaction?: Transaction
    ): Promise<IEndorsement> {
        const t = transaction || await this.sequelize.transaction();

        try {
            // Create endorsement instance with validation
            const endorsement = new Endorsement(endorsementData);
            await endorsement.validate();

            // Generate audit log entry
            const auditLog = {
                action: 'CREATE',
                timestamp: new Date(),
                changes: endorsementData,
                version: 1
            };

            // Save with audit log
            const savedEndorsement = await Endorsement.create(
                {
                    ...endorsementData,
                    auditLog,
                    version: 1
                },
                { transaction: t }
            );

            // Cache the new endorsement
            await this.cacheManager.set(
                `${CACHE_PREFIX}${savedEndorsement.id}`,
                savedEndorsement.toJSON(),
                CACHE_TTL
            );

            if (!transaction) await t.commit();

            info('Endorsement created successfully', {
                endorsementId: savedEndorsement.id,
                policyId: savedEndorsement.policyId
            });

            return savedEndorsement.toJSON();

        } catch (err) {
            if (!transaction) await t.rollback();
            error('Failed to create endorsement', err);
            throw err;
        }
    }

    /**
     * Retrieves endorsement by ID with caching
     * @param id Endorsement ID
     * @returns Found endorsement or null
     */
    public async findById(id: string): Promise<IEndorsement | null> {
        try {
            // Check cache first
            const cached = await this.cacheManager.get<IEndorsement>(
                `${CACHE_PREFIX}${id}`
            );
            if (cached) {
                info('Endorsement cache hit', { endorsementId: id });
                return cached;
            }

            // Implement retry logic for database queries
            const endorsement = await retry(
                async () => {
                    return await Endorsement.findByPk(id);
                },
                {
                    retries: this.maxRetries,
                    delay: this.retryDelay,
                    timeout: 5000
                }
            );

            if (endorsement) {
                // Update cache
                await this.cacheManager.set(
                    `${CACHE_PREFIX}${id}`,
                    endorsement.toJSON(),
                    CACHE_TTL
                );
                return endorsement.toJSON();
            }

            return null;

        } catch (err) {
            error('Failed to retrieve endorsement', err);
            throw err;
        }
    }

    /**
     * Retrieves all endorsements for a policy with pagination
     * @param policyId Policy ID
     * @param pagination Pagination parameters
     * @returns List of endorsements
     */
    public async findByPolicyId(
        policyId: string,
        pagination: { page: number; limit: number }
    ): Promise<{ endorsements: IEndorsement[]; total: number }> {
        try {
            const { page = 1, limit = 10 } = pagination;
            const offset = (page - 1) * limit;

            // Check cache for policy endorsements
            const cacheKey = `${CACHE_PREFIX}policy:${policyId}:${page}:${limit}`;
            const cached = await this.cacheManager.get<{
                endorsements: IEndorsement[];
                total: number;
            }>(cacheKey);

            if (cached) {
                info('Policy endorsements cache hit', { policyId, page });
                return cached;
            }

            const { rows: endorsements, count: total } = await Endorsement.findAndCountAll({
                where: { policyId },
                order: [['effectiveDate', 'DESC']],
                limit,
                offset
            });

            const result = {
                endorsements: endorsements.map(e => e.toJSON()),
                total
            };

            // Cache results
            await this.cacheManager.set(cacheKey, result, CACHE_TTL);

            return result;

        } catch (err) {
            error('Failed to retrieve policy endorsements', err);
            throw err;
        }
    }

    /**
     * Updates endorsement with optimistic locking
     * @param id Endorsement ID
     * @param updateData Update data
     * @param transaction Optional transaction
     * @returns Updated endorsement
     */
    public async update(
        id: string,
        updateData: Partial<IEndorsement>,
        transaction?: Transaction
    ): Promise<IEndorsement> {
        const t = transaction || await this.sequelize.transaction();

        try {
            const endorsement = await Endorsement.findByPk(id, { transaction: t });
            if (!endorsement) {
                throw new Error('Endorsement not found');
            }

            // Optimistic locking check
            if (updateData.version && updateData.version !== endorsement.version) {
                throw new Error('Endorsement version conflict');
            }

            // Generate audit log
            const auditLog = {
                action: 'UPDATE',
                timestamp: new Date(),
                changes: updateData,
                version: (endorsement.version || 0) + 1
            };

            // Update with new version
            const [updated] = await Endorsement.update(
                {
                    ...updateData,
                    auditLog,
                    version: (endorsement.version || 0) + 1
                },
                {
                    where: {
                        id,
                        version: endorsement.version
                    },
                    transaction: t
                }
            );

            if (updated === 0) {
                throw new Error('Endorsement update failed');
            }

            const updatedEndorsement = await Endorsement.findByPk(id, { transaction: t });

            // Update cache
            await this.cacheManager.set(
                `${CACHE_PREFIX}${id}`,
                updatedEndorsement!.toJSON(),
                CACHE_TTL
            );

            if (!transaction) await t.commit();

            info('Endorsement updated successfully', {
                endorsementId: id,
                version: updateData.version
            });

            return updatedEndorsement!.toJSON();

        } catch (err) {
            if (!transaction) await t.rollback();
            error('Failed to update endorsement', err);
            throw err;
        }
    }

    /**
     * Deletes endorsement with audit logging
     * @param id Endorsement ID
     * @param transaction Optional transaction
     * @returns Success status
     */
    public async delete(
        id: string,
        transaction?: Transaction
    ): Promise<boolean> {
        const t = transaction || await this.sequelize.transaction();

        try {
            const endorsement = await Endorsement.findByPk(id, { transaction: t });
            if (!endorsement) {
                throw new Error('Endorsement not found');
            }

            // Generate audit log
            const auditLog = {
                action: 'DELETE',
                timestamp: new Date(),
                version: (endorsement.version || 0) + 1
            };

            // Soft delete with audit
            await Endorsement.update(
                {
                    auditLog,
                    deletedAt: new Date()
                },
                {
                    where: { id },
                    transaction: t
                }
            );

            // Remove from cache
            await this.cacheManager.del(`${CACHE_PREFIX}${id}`);

            if (!transaction) await t.commit();

            info('Endorsement deleted successfully', { endorsementId: id });

            return true;

        } catch (err) {
            if (!transaction) await t.rollback();
            error('Failed to delete endorsement', err);
            throw err;
        }
    }
}

export default EndorsementRepository;