import { describe, it, beforeEach, afterEach, expect, jest } from 'jest';
import { performance } from 'perf_hooks';
import { createConnection, getConnection, Connection } from 'typeorm';
import { PolicyService } from '../../src/services/PolicyService';
import { PolicyRepository } from '../../src/repositories/PolicyRepository';
import { mockPolicy, generateMockPolicy } from '../mocks/policyData';
import { OneShieldClient } from '@oneshield/client';
import { 
    PolicyStatus, 
    PolicyType,
    IPolicy 
} from '../../src/types/policy.types';
import { 
    IOneShieldPolicyResponse,
    OneShieldPolicyStatus 
} from '../../src/integrations/oneshield/types';

// Performance thresholds based on SLA requirements
const PERFORMANCE_THRESHOLDS = {
    API_RESPONSE_TIME: 2000, // 2 seconds max
    DB_OPERATION_TIME: 500,  // 500ms max
    SYNC_OPERATION_TIME: 1500 // 1.5 seconds max
};

describe('Policy Integration Tests', () => {
    let connection: Connection;
    let policyService: PolicyService;
    let policyRepository: PolicyRepository;
    let oneShieldClient: OneShieldClient;

    beforeEach(async () => {
        // Set up test database connection
        connection = await createConnection({
            type: 'postgres',
            database: 'mga_os_test',
            entities: ['src/models/*.ts'],
            synchronize: true,
            logging: false
        });

        // Initialize dependencies
        policyRepository = new PolicyRepository();
        oneShieldClient = new OneShieldClient({
            baseUrl: process.env.ONESHIELD_TEST_URL,
            apiKey: process.env.ONESHIELD_TEST_API_KEY,
            environment: 'test'
        });

        policyService = new PolicyService(
            policyRepository,
            oneShieldClient,
            jest.fn() as any, // Mock logger
            jest.fn() as any  // Mock circuit breaker
        );

        // Clear test data
        await connection.synchronize(true);
    });

    afterEach(async () => {
        await connection.close();
    });

    describe('Policy Creation', () => {
        it('should create a policy with OneShield synchronization within SLA', async () => {
            const startTime = performance.now();
            const testPolicy = generateMockPolicy({
                type: PolicyType.COMMERCIAL_PROPERTY,
                status: PolicyStatus.DRAFT
            });

            // Mock OneShield response
            const mockOneShieldResponse: IOneShieldPolicyResponse = {
                policyId: 'OS-12345',
                status: OneShieldPolicyStatus.DRAFT,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
                transactionId: 'TX-12345'
            };

            jest.spyOn(oneShieldClient, 'createPolicy')
                .mockResolvedValue(mockOneShieldResponse);

            // Create policy
            const createdPolicy = await policyService.createPolicy(testPolicy);

            const endTime = performance.now();
            const operationTime = endTime - startTime;

            // Verify performance
            expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);

            // Verify policy creation
            expect(createdPolicy).toBeDefined();
            expect(createdPolicy.id).toBeDefined();
            expect(createdPolicy.oneShieldPolicyId).toBe('OS-12345');
            expect(createdPolicy.status).toBe(PolicyStatus.DRAFT);

            // Verify database persistence
            const savedPolicy = await policyRepository.findById(createdPolicy.id);
            expect(savedPolicy).toBeDefined();
            expect(savedPolicy?.oneShieldPolicyId).toBe('OS-12345');
        });

        it('should handle duplicate policy creation gracefully', async () => {
            const testPolicy = generateMockPolicy({
                policyNumber: 'TEST-123',
                type: PolicyType.COMMERCIAL_PROPERTY
            });

            // Create first policy
            await policyService.createPolicy(testPolicy);

            // Attempt duplicate creation
            await expect(policyService.createPolicy({
                ...testPolicy,
                id: undefined
            })).rejects.toThrow('Policy number already exists');
        });

        it('should handle OneShield synchronization failure with proper rollback', async () => {
            const testPolicy = generateMockPolicy();

            // Mock OneShield failure
            jest.spyOn(oneShieldClient, 'createPolicy')
                .mockRejectedValue(new Error('OneShield API Error'));

            // Attempt creation
            await expect(policyService.createPolicy(testPolicy))
                .rejects.toThrow('OneShield API Error');

            // Verify no policy was persisted
            const policies = await policyRepository.findByCriteria({
                policyNumber: testPolicy.policyNumber
            });
            expect(policies.count).toBe(0);
        });
    });

    describe('Policy Updates', () => {
        let existingPolicy: IPolicy;

        beforeEach(async () => {
            // Create test policy
            existingPolicy = await policyService.createPolicy(
                generateMockPolicy({
                    status: PolicyStatus.DRAFT
                })
            );
        });

        it('should update policy with OneShield sync within SLA', async () => {
            const startTime = performance.now();

            const updates = {
                status: PolicyStatus.QUOTED,
                premium: 5000.00,
                underwritingInfo: {
                    ...existingPolicy.underwritingInfo,
                    riskScore: 85
                }
            };

            // Mock OneShield response
            jest.spyOn(oneShieldClient, 'updatePolicy')
                .mockResolvedValue({
                    policyId: existingPolicy.oneShieldPolicyId!,
                    status: OneShieldPolicyStatus.IN_REVIEW,
                    version: 2,
                    createdAt: existingPolicy.createdAt.toISOString(),
                    updatedAt: new Date().toISOString(),
                    transactionId: 'TX-UPDATE-1'
                });

            // Update policy
            const updatedPolicy = await policyService.updatePolicy(
                existingPolicy.id,
                updates
            );

            const endTime = performance.now();
            const operationTime = endTime - startTime;

            // Verify performance
            expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);

            // Verify updates
            expect(updatedPolicy.status).toBe(PolicyStatus.QUOTED);
            expect(updatedPolicy.premium).toBe(5000.00);
            expect(updatedPolicy.underwritingInfo.riskScore).toBe(85);

            // Verify OneShield sync
            expect(oneShieldClient.updatePolicy).toHaveBeenCalledWith(
                existingPolicy.oneShieldPolicyId,
                expect.any(Object)
            );
        });

        it('should validate policy state transitions', async () => {
            // Attempt invalid transition
            await expect(policyService.updatePolicy(
                existingPolicy.id,
                { status: PolicyStatus.ACTIVE }
            )).rejects.toThrow('Invalid policy status transition');

            // Verify policy unchanged
            const policy = await policyRepository.findById(existingPolicy.id);
            expect(policy?.status).toBe(PolicyStatus.DRAFT);
        });

        it('should handle concurrent updates with optimistic locking', async () => {
            const update1 = policyService.updatePolicy(
                existingPolicy.id,
                { premium: 5000.00 }
            );

            const update2 = policyService.updatePolicy(
                existingPolicy.id,
                { premium: 6000.00 }
            );

            await expect(Promise.all([update1, update2]))
                .rejects.toThrow('Concurrent update detected');
        });
    });

    describe('Policy Retrieval Performance', () => {
        beforeEach(async () => {
            // Create test policies
            const policies = Array(100).fill(null).map(() => 
                generateMockPolicy({
                    type: PolicyType.COMMERCIAL_PROPERTY
                })
            );
            await Promise.all(policies.map(p => policyService.createPolicy(p)));
        });

        it('should retrieve policies with pagination within SLA', async () => {
            const startTime = performance.now();

            const result = await policyRepository.findByCriteria(
                { type: PolicyType.COMMERCIAL_PROPERTY },
                1,
                10,
                [['createdAt', 'DESC']]
            );

            const endTime = performance.now();
            const operationTime = endTime - startTime;

            // Verify performance
            expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DB_OPERATION_TIME);

            // Verify pagination
            expect(result.rows).toHaveLength(10);
            expect(result.count).toBeGreaterThan(10);
        });

        it('should utilize caching for repeated policy retrievals', async () => {
            const policy = await policyService.createPolicy(generateMockPolicy());

            // First retrieval
            const startTime1 = performance.now();
            await policyRepository.findById(policy.id);
            const firstRetrievalTime = performance.now() - startTime1;

            // Second retrieval (should be cached)
            const startTime2 = performance.now();
            await policyRepository.findById(policy.id);
            const secondRetrievalTime = performance.now() - startTime2;

            // Verify cache effectiveness
            expect(secondRetrievalTime).toBeLessThan(firstRetrievalTime * 0.5);
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection failures gracefully', async () => {
            // Force database connection error
            await connection.close();

            await expect(policyService.createPolicy(generateMockPolicy()))
                .rejects.toThrow('Database connection error');
        });

        it('should handle OneShield timeout scenarios', async () => {
            const testPolicy = generateMockPolicy();

            // Mock OneShield timeout
            jest.spyOn(oneShieldClient, 'createPolicy')
                .mockImplementation(() => new Promise((resolve) => {
                    setTimeout(() => resolve({} as any), 5000);
                }));

            await expect(policyService.createPolicy(testPolicy))
                .rejects.toThrow('OneShield API request timeout');
        });

        it('should maintain data consistency during partial failures', async () => {
            const testPolicy = generateMockPolicy();

            // Mock partial OneShield failure after initial success
            jest.spyOn(oneShieldClient, 'createPolicy')
                .mockImplementation(async () => {
                    const response = {
                        policyId: 'OS-12345',
                        status: OneShieldPolicyStatus.DRAFT
                    } as IOneShieldPolicyResponse;
                    
                    // Simulate failure during processing
                    throw new Error('Partial processing failure');
                    
                    return response;
                });

            await expect(policyService.createPolicy(testPolicy))
                .rejects.toThrow('Partial processing failure');

            // Verify no partial data was persisted
            const policies = await policyRepository.findByCriteria({
                policyNumber: testPolicy.policyNumber
            });
            expect(policies.count).toBe(0);
        });
    });
});