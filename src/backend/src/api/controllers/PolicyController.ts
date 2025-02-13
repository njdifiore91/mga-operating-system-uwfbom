/**
 * @file Policy controller implementing REST API endpoints for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { RateLimit } from 'express-rate-limit'; // ^6.7.0
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { CacheManager } from 'cache-manager'; // ^5.2.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { PolicyService } from '../../services/PolicyService';
import { IPolicy, PolicyStatus } from '../../types/policy.types';
import { logger } from '../../utils/logger';
import { oneshieldConfig } from '../../config/oneshield';

/**
 * Controller implementing comprehensive REST API endpoints for policy management
 * with enhanced error handling, caching, and monitoring
 */
@Controller('policies')
@UseInterceptors(LoggingInterceptor)
@UseGuards(AuthGuard)
export class PolicyController {
    private readonly CACHE_TTL = 300; // 5 minutes
    private readonly MAX_ITEMS_PER_PAGE = 100;

    constructor(
        private readonly policyService: PolicyService,
        private readonly circuitBreaker: CircuitBreaker,
        private readonly cacheManager: CacheManager
    ) {
        this.initializeCircuitBreaker();
    }

    /**
     * Creates a new policy with OneShield synchronization
     */
    @Post('/')
    @UseGuards(AuthGuard)
    @RateLimit({ windowMs: 60000, max: oneshieldConfig.policy.rateLimit.maxRequests })
    public async createPolicy(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const correlationId = uuidv4();
        logger.info('Starting policy creation', { correlationId });

        try {
            const policyData: Omit<IPolicy, 'id'> = req.body;

            // Validate request body
            this.validatePolicyRequest(policyData);

            // Create policy with circuit breaker protection
            const policy = await this.circuitBreaker.fire(
                async () => await this.policyService.createPolicy(policyData)
            );

            logger.info('Policy created successfully', {
                correlationId,
                policyId: policy.id,
                policyNumber: policy.policyNumber
            });

            res.status(201).json(policy);
        } catch (error) {
            logger.error('Failed to create policy', {
                correlationId,
                error,
                requestBody: req.body
            });
            next(error);
        }
    }

    /**
     * Retrieves policy by ID with caching
     */
    @Get('/:id')
    @UseGuards(AuthGuard)
    @RateLimit({ windowMs: 60000, max: oneshieldConfig.policy.rateLimit.maxRequests })
    public async getPolicy(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const correlationId = uuidv4();
        const { id } = req.params;
        const cacheKey = `policy:${id}`;

        try {
            // Check cache first
            const cachedPolicy = await this.cacheManager.get<IPolicy>(cacheKey);
            if (cachedPolicy) {
                logger.info('Policy retrieved from cache', {
                    correlationId,
                    policyId: id
                });
                res.json(cachedPolicy);
                return;
            }

            // Retrieve policy with circuit breaker
            const policy = await this.circuitBreaker.fire(
                async () => await this.policyService.getPolicy(id)
            );

            if (!policy) {
                res.status(404).json({ message: 'Policy not found' });
                return;
            }

            // Cache the result
            await this.cacheManager.set(cacheKey, policy, this.CACHE_TTL);

            logger.info('Policy retrieved successfully', {
                correlationId,
                policyId: id
            });

            res.json(policy);
        } catch (error) {
            logger.error('Failed to retrieve policy', {
                correlationId,
                error,
                policyId: id
            });
            next(error);
        }
    }

    /**
     * Updates existing policy with OneShield synchronization
     */
    @Put('/:id')
    @UseGuards(AuthGuard)
    @RateLimit({ windowMs: 60000, max: oneshieldConfig.policy.rateLimit.maxRequests })
    public async updatePolicy(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const correlationId = uuidv4();
        const { id } = req.params;
        const updates = req.body;

        try {
            // Validate update payload
            this.validatePolicyUpdates(updates);

            // Update policy with circuit breaker
            const policy = await this.circuitBreaker.fire(
                async () => await this.policyService.updatePolicy(id, updates)
            );

            // Invalidate cache
            await this.cacheManager.del(`policy:${id}`);

            logger.info('Policy updated successfully', {
                correlationId,
                policyId: id,
                status: policy.status
            });

            res.json(policy);
        } catch (error) {
            logger.error('Failed to update policy', {
                correlationId,
                error,
                policyId: id,
                updates
            });
            next(error);
        }
    }

    /**
     * Retrieves policies with filtering, pagination and sorting
     */
    @Get('/')
    @UseGuards(AuthGuard)
    @RateLimit({ windowMs: 60000, max: oneshieldConfig.policy.rateLimit.maxRequests })
    public async getPolicies(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const correlationId = uuidv4();
        const {
            page = 1,
            limit = 10,
            sort = 'createdAt:desc',
            ...filters
        } = req.query;

        try {
            // Validate pagination params
            const validatedLimit = Math.min(
                Number(limit),
                this.MAX_ITEMS_PER_PAGE
            );
            const validatedPage = Math.max(1, Number(page));

            // Parse sort parameters
            const [sortField, sortOrder] = (sort as string).split(':');
            const sortCriteria: [string, string][] = [[sortField, sortOrder]];

            // Retrieve policies with circuit breaker
            const { rows: policies, count } = await this.circuitBreaker.fire(
                async () => await this.policyService.getPolicies(
                    filters,
                    validatedPage,
                    validatedLimit,
                    sortCriteria
                )
            );

            logger.info('Policies retrieved successfully', {
                correlationId,
                count,
                page: validatedPage,
                limit: validatedLimit
            });

            res.json({
                data: policies,
                pagination: {
                    total: count,
                    page: validatedPage,
                    limit: validatedLimit,
                    pages: Math.ceil(count / validatedLimit)
                }
            });
        } catch (error) {
            logger.error('Failed to retrieve policies', {
                correlationId,
                error,
                filters: req.query
            });
            next(error);
        }
    }

    /**
     * Initializes circuit breaker with OneShield configuration
     */
    private initializeCircuitBreaker(): void {
        this.circuitBreaker.fallback(() => {
            throw new Error('Service temporarily unavailable');
        });

        this.circuitBreaker.on('open', () => {
            logger.warn('Circuit breaker opened', {
                service: 'PolicyService'
            });
        });

        this.circuitBreaker.on('halfOpen', () => {
            logger.info('Circuit breaker half-opened', {
                service: 'PolicyService'
            });
        });

        this.circuitBreaker.on('close', () => {
            logger.info('Circuit breaker closed', {
                service: 'PolicyService'
            });
        });
    }

    /**
     * Validates policy creation request
     */
    private validatePolicyRequest(data: Partial<IPolicy>): void {
        if (!data.type || !data.effectiveDate || !data.expirationDate) {
            throw new Error('Missing required policy fields');
        }

        if (new Date(data.effectiveDate) >= new Date(data.expirationDate)) {
            throw new Error('Invalid policy dates');
        }

        if (!data.coverages || data.coverages.length === 0) {
            throw new Error('At least one coverage is required');
        }
    }

    /**
     * Validates policy update request
     */
    private validatePolicyUpdates(updates: Partial<IPolicy>): void {
        if (updates.status) {
            const validTransitions: Record<PolicyStatus, PolicyStatus[]> = {
                [PolicyStatus.DRAFT]: [PolicyStatus.QUOTED],
                [PolicyStatus.QUOTED]: [PolicyStatus.BOUND, PolicyStatus.CANCELLED],
                [PolicyStatus.BOUND]: [PolicyStatus.ACTIVE, PolicyStatus.CANCELLED],
                [PolicyStatus.ACTIVE]: [PolicyStatus.CANCELLED, PolicyStatus.EXPIRED],
                [PolicyStatus.CANCELLED]: [],
                [PolicyStatus.EXPIRED]: []
            };

            if (!validTransitions[updates.status]) {
                throw new Error(`Invalid policy status: ${updates.status}`);
            }
        }

        if (updates.premium && updates.premium < 0) {
            throw new Error('Invalid premium amount');
        }
    }
}

export default PolicyController;