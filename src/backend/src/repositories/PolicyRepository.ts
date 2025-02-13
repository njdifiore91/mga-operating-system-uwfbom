/**
 * @file Policy repository implementation for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Sequelize, Transaction, Op } from 'sequelize'; // ^6.32.1
import { ConnectionPool } from 'sequelize-pool'; // ^6.1.0
import { caching } from 'cache-manager'; // ^5.2.0
import { Policy } from '../models/Policy';
import { IPolicy } from '../types/policy.types';
import { getSequelize } from '../config/database';
import { logger } from '../utils/logger';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_MAX = 1000; // Maximum number of items in cache
const QUERY_TIMEOUT = 30000; // 30 seconds

/**
 * Repository class implementing data access patterns for policy management
 * with performance optimization and caching
 */
export class PolicyRepository {
  private sequelize: Sequelize;
  private cacheManager: any;
  private connectionPool: ConnectionPool;

  constructor() {
    this.initialize();
  }

  /**
   * Initializes repository with database connection, cache, and connection pool
   * @private
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize Sequelize instance
      this.sequelize = await getSequelize();

      // Initialize cache manager
      this.cacheManager = await caching('memory', {
        max: CACHE_MAX,
        ttl: CACHE_TTL
      });

      // Initialize connection pool
      this.connectionPool = new ConnectionPool({
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
      });

      logger.info('PolicyRepository initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PolicyRepository', error);
      throw error;
    }
  }

  /**
   * Creates a new policy record with transaction support and validation
   * @param policyData Policy data to create
   * @param transaction Optional transaction for batch operations
   * @returns Created policy record
   */
  public async create(
    policyData: IPolicy,
    transaction?: Transaction
  ): Promise<IPolicy> {
    const t = transaction || await this.sequelize.transaction();

    try {
      // Create policy instance and validate
      const policy = new Policy(policyData);
      await policy.validate();

      // Save policy with optimistic locking
      const createdPolicy = await Policy.create(policy.toJSON(), {
        transaction: t,
        lock: Transaction.LOCK.UPDATE
      });

      if (!transaction) {
        await t.commit();
      }

      logger.info('Policy created successfully', {
        policyId: createdPolicy.id,
        policyNumber: createdPolicy.policyNumber
      });

      return createdPolicy.toJSON();
    } catch (error) {
      if (!transaction) {
        await t.rollback();
      }
      logger.error('Failed to create policy', error);
      throw error;
    }
  }

  /**
   * Retrieves policy by ID with caching and read replica support
   * @param id Policy ID
   * @param includes Optional related data to include
   * @returns Found policy or null
   */
  public async findById(
    id: string,
    includes?: string[]
  ): Promise<IPolicy | null> {
    const cacheKey = `policy:${id}`;

    try {
      // Check cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        logger.info('Policy retrieved from cache', { policyId: id });
        return cached;
      }

      // Build query with includes
      const query = {
        where: { id },
        include: includes?.map(include => ({ model: include })),
        timeout: QUERY_TIMEOUT
      };

      // Execute query using connection pool
      const connection = await this.connectionPool.acquire();
      try {
        const policy = await Policy.findOne({
          ...query,
          transaction: await connection.startTransaction()
        });

        if (policy) {
          // Cache the result
          await this.cacheManager.set(cacheKey, policy.toJSON());
          logger.info('Policy retrieved from database', { policyId: id });
          return policy.toJSON();
        }

        return null;
      } finally {
        await this.connectionPool.release(connection);
      }
    } catch (error) {
      logger.error('Failed to retrieve policy', error);
      throw error;
    }
  }

  /**
   * Finds policies by criteria with pagination and sorting
   * @param criteria Search criteria
   * @param page Page number
   * @param limit Items per page
   * @param sort Sort options
   * @returns Paginated policy results
   */
  public async findByCriteria(
    criteria: Partial<IPolicy>,
    page: number = 1,
    limit: number = 10,
    sort: [string, string][] = [['createdAt', 'DESC']]
  ): Promise<{ rows: IPolicy[]; count: number }> {
    try {
      const offset = (page - 1) * limit;
      
      const query = {
        where: this.buildWhereClause(criteria),
        order: sort,
        limit,
        offset,
        timeout: QUERY_TIMEOUT
      };

      const { rows, count } = await Policy.findAndCountAll(query);

      logger.info('Policies retrieved successfully', {
        count,
        page,
        limit
      });

      return {
        rows: rows.map(policy => policy.toJSON()),
        count
      };
    } catch (error) {
      logger.error('Failed to retrieve policies', error);
      throw error;
    }
  }

  /**
   * Updates policy by ID with optimistic locking
   * @param id Policy ID
   * @param updates Update data
   * @param transaction Optional transaction
   * @returns Updated policy
   */
  public async update(
    id: string,
    updates: Partial<IPolicy>,
    transaction?: Transaction
  ): Promise<IPolicy> {
    const t = transaction || await this.sequelize.transaction();

    try {
      const policy = await Policy.findByPk(id, { transaction: t });
      if (!policy) {
        throw new Error('Policy not found');
      }

      // Update and validate
      Object.assign(policy, updates);
      await policy.validate();

      // Save with optimistic locking
      await policy.save({
        transaction: t,
        lock: Transaction.LOCK.UPDATE
      });

      if (!transaction) {
        await t.commit();
      }

      // Invalidate cache
      await this.cacheManager.del(`policy:${id}`);

      logger.info('Policy updated successfully', { policyId: id });
      return policy.toJSON();
    } catch (error) {
      if (!transaction) {
        await t.rollback();
      }
      logger.error('Failed to update policy', error);
      throw error;
    }
  }

  /**
   * Builds WHERE clause for policy queries
   * @private
   * @param criteria Search criteria
   * @returns Sequelize where clause
   */
  private buildWhereClause(criteria: Partial<IPolicy>): any {
    const where: any = {};

    if (criteria.policyNumber) {
      where.policyNumber = criteria.policyNumber;
    }
    if (criteria.type) {
      where.type = criteria.type;
    }
    if (criteria.status) {
      where.status = criteria.status;
    }
    if (criteria.effectiveDate) {
      where.effectiveDate = {
        [Op.gte]: criteria.effectiveDate
      };
    }
    if (criteria.expirationDate) {
      where.expirationDate = {
        [Op.lte]: criteria.expirationDate
      };
    }

    return where;
  }
}

export default PolicyRepository;