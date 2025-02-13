/**
 * @file Policy service implementation for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Transaction } from 'sequelize'; // ^6.32.1
import { Logger } from 'winston'; // ^3.10.0
import { retry } from 'retry-ts'; // ^0.1.3
import { CircuitBreaker } from 'opossum'; // ^6.0.1
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { PolicyRepository } from '../repositories/PolicyRepository';
import { PolicyClient } from '../integrations/oneshield/PolicyClient';
import { IPolicy, PolicyStatus } from '../types/policy.types';
import { 
    IOneShieldPolicyRequest, 
    IOneShieldPolicyResponse,
    OneShieldPolicyStatus 
} from '../integrations/oneshield/types';
import { oneshieldConfig } from '../config/oneshield';

/**
 * Service class implementing comprehensive business logic for policy management
 * with OneShield integration and transaction management
 */
export class PolicyService {
    private readonly policyRepository: PolicyRepository;
    private readonly policyClient: PolicyClient;
    private readonly logger: Logger;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly maxRetries: number;
    private readonly retryDelay: number;

    constructor(
        policyRepository: PolicyRepository,
        policyClient: PolicyClient,
        logger: Logger,
        circuitBreaker: CircuitBreaker,
        config: typeof oneshieldConfig
    ) {
        this.policyRepository = policyRepository;
        this.policyClient = policyClient;
        this.logger = logger;
        this.circuitBreaker = circuitBreaker;
        this.maxRetries = config.connection.retryConfig.maxRetries;
        this.retryDelay = config.connection.retryConfig.initialDelay;
    }

    /**
     * Creates a new policy with OneShield synchronization and transaction management
     * @param policyData Policy data to create
     * @param options Transaction options
     * @returns Created policy with OneShield integration status
     */
    public async createPolicy(
        policyData: Omit<IPolicy, 'id'>,
        options?: { transaction?: Transaction }
    ): Promise<IPolicy> {
        const correlationId = uuidv4();
        this.logger.info('Starting policy creation process', {
            correlationId,
            policyNumber: policyData.policyNumber
        });

        const transaction = options?.transaction || await this.policyRepository.getSequelize().transaction();

        try {
            // Create policy in local database
            const policy = await this.policyRepository.create(policyData, transaction);

            // Map policy to OneShield format
            const oneShieldRequest = this.mapToOneShieldPolicy(policy);

            // Attempt OneShield synchronization with circuit breaker and retry
            const oneShieldResponse = await this.circuitBreaker.fire(
                async () => {
                    return await retry(
                        async () => await this.policyClient.createPolicy(oneShieldRequest),
                        {
                            retries: this.maxRetries,
                            delay: this.retryDelay,
                            onRetry: (error) => {
                                this.logger.warn('Retrying OneShield policy creation', {
                                    correlationId,
                                    error: error.message,
                                    policyId: policy.id
                                });
                            }
                        }
                    );
                }
            );

            // Update policy with OneShield reference
            const updatedPolicy = await this.policyRepository.update(
                policy.id,
                {
                    oneShieldPolicyId: oneShieldResponse.policyId,
                    status: this.mapOneShieldStatus(oneShieldResponse.status)
                },
                transaction
            );

            await transaction.commit();

            this.logger.info('Policy created successfully', {
                correlationId,
                policyId: updatedPolicy.id,
                oneShieldPolicyId: oneShieldResponse.policyId
            });

            return updatedPolicy;

        } catch (error) {
            await transaction.rollback();
            this.logger.error('Failed to create policy', {
                correlationId,
                error,
                policyData
            });
            throw error;
        }
    }

    /**
     * Updates an existing policy with OneShield synchronization
     * @param policyId Policy ID to update
     * @param updates Policy updates to apply
     * @returns Updated policy with sync status
     */
    public async updatePolicy(
        policyId: string,
        updates: Partial<IPolicy>,
        options?: { transaction?: Transaction }
    ): Promise<IPolicy> {
        const correlationId = uuidv4();
        this.logger.info('Starting policy update process', {
            correlationId,
            policyId
        });

        const transaction = options?.transaction || await this.policyRepository.getSequelize().transaction();

        try {
            // Get existing policy
            const existingPolicy = await this.policyRepository.findById(policyId);
            if (!existingPolicy) {
                throw new Error('Policy not found');
            }

            // Validate state transition
            if (updates.status) {
                await this.validatePolicyTransition(existingPolicy.status, updates.status, existingPolicy);
            }

            // Update policy in local database
            const updatedPolicy = await this.policyRepository.update(policyId, updates, transaction);

            // Sync with OneShield if policy is active
            if (updatedPolicy.status === PolicyStatus.ACTIVE) {
                const oneShieldRequest = this.mapToOneShieldPolicy(updatedPolicy);
                await this.circuitBreaker.fire(
                    async () => await this.policyClient.updatePolicy(
                        updatedPolicy.oneShieldPolicyId!,
                        oneShieldRequest
                    )
                );
            }

            await transaction.commit();

            this.logger.info('Policy updated successfully', {
                correlationId,
                policyId,
                status: updatedPolicy.status
            });

            return updatedPolicy;

        } catch (error) {
            await transaction.rollback();
            this.logger.error('Failed to update policy', {
                correlationId,
                error,
                policyId,
                updates
            });
            throw error;
        }
    }

    /**
     * Validates policy state transitions according to business rules
     * @param currentState Current policy status
     * @param newState New policy status
     * @param policy Policy data for validation
     * @returns Validation result
     */
    public async validatePolicyTransition(
        currentState: PolicyStatus,
        newState: PolicyStatus,
        policy: IPolicy
    ): Promise<boolean> {
        // Define valid state transitions
        const validTransitions: Record<PolicyStatus, PolicyStatus[]> = {
            [PolicyStatus.DRAFT]: [PolicyStatus.QUOTED],
            [PolicyStatus.QUOTED]: [PolicyStatus.BOUND, PolicyStatus.CANCELLED],
            [PolicyStatus.BOUND]: [PolicyStatus.ACTIVE, PolicyStatus.CANCELLED],
            [PolicyStatus.ACTIVE]: [PolicyStatus.CANCELLED, PolicyStatus.EXPIRED],
            [PolicyStatus.CANCELLED]: [],
            [PolicyStatus.EXPIRED]: []
        };

        // Check if transition is valid
        if (!validTransitions[currentState].includes(newState)) {
            throw new Error(`Invalid policy status transition from ${currentState} to ${newState}`);
        }

        // Additional validation rules
        switch (newState) {
            case PolicyStatus.BOUND:
                if (!policy.underwritingInfo.riskScore) {
                    throw new Error('Risk assessment required before binding');
                }
                break;

            case PolicyStatus.ACTIVE:
                if (!policy.oneShieldPolicyId) {
                    throw new Error('OneShield synchronization required for activation');
                }
                if (!policy.documents.some(doc => doc.type === 'POLICY_DOCUMENT')) {
                    throw new Error('Policy document required for activation');
                }
                break;

            case PolicyStatus.CANCELLED:
                if (!policy.underwritingInfo.approvedBy) {
                    throw new Error('Underwriter approval required for cancellation');
                }
                break;
        }

        return true;
    }

    /**
     * Maps MGA OS policy to OneShield format
     * @private
     * @param policy Policy to map
     * @returns OneShield policy request
     */
    private mapToOneShieldPolicy(policy: IPolicy): IOneShieldPolicyRequest {
        return {
            policyNumber: policy.policyNumber,
            effectiveDate: policy.effectiveDate.toISOString(),
            expirationDate: policy.expirationDate.toISOString(),
            coverages: policy.coverages.map(coverage => ({
                coverageCode: coverage.type,
                limitAmount: coverage.limits.perOccurrence,
                deductibleAmount: coverage.deductible,
                endorsements: [],
                exclusions: coverage.exclusions || [],
                options: {}
            })),
            premium: policy.premium,
            underwritingInfo: {
                riskScore: policy.underwritingInfo.riskScore,
                notes: policy.underwritingInfo.underwriterNotes,
                approvalDate: policy.underwritingInfo.approvalDate?.toISOString(),
                approvedBy: policy.underwritingInfo.approvedBy,
                conditions: policy.underwritingInfo.specialConditions || []
            },
            documents: policy.documents.map(doc => ({
                documentId: doc.id,
                documentType: doc.type,
                fileName: doc.fileName,
                contentType: 'application/pdf',
                contentUrl: doc.fileUrl,
                metadata: doc.metadata
            }))
        };
    }

    /**
     * Maps OneShield status to MGA OS status
     * @private
     * @param status OneShield policy status
     * @returns MGA OS policy status
     */
    private mapOneShieldStatus(status: OneShieldPolicyStatus): PolicyStatus {
        const statusMap: Record<OneShieldPolicyStatus, PolicyStatus> = {
            [OneShieldPolicyStatus.DRAFT]: PolicyStatus.DRAFT,
            [OneShieldPolicyStatus.IN_REVIEW]: PolicyStatus.QUOTED,
            [OneShieldPolicyStatus.APPROVED]: PolicyStatus.BOUND,
            [OneShieldPolicyStatus.BOUND]: PolicyStatus.ACTIVE,
            [OneShieldPolicyStatus.DECLINED]: PolicyStatus.CANCELLED,
            [OneShieldPolicyStatus.CANCELLED]: PolicyStatus.CANCELLED
        };
        return statusMap[status] || PolicyStatus.DRAFT;
    }
}

export default PolicyService;