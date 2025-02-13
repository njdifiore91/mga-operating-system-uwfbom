import { jest } from '@jest/globals';
import { performance } from 'performance-now';
import winston from 'winston';
import { PolicyService } from '../../src/services/PolicyService';
import { PolicyRepository } from '../../src/repositories/PolicyRepository';
import { PolicyClient } from '../../src/integrations/oneshield/PolicyClient';
import { mockPolicy, generateMockPolicy } from '../mocks/policyData';
import { PolicyStatus } from '../../src/types/policy.types';
import { CircuitBreaker } from 'opossum';
import { oneshieldConfig } from '../../src/config/oneshield';

// Performance threshold for operations (2 seconds)
const PERFORMANCE_THRESHOLD = 2000;

// Mock dependencies
let policyService: PolicyService;
let mockPolicyRepository: jest.Mocked<PolicyRepository>;
let mockPolicyClient: jest.Mocked<PolicyClient>;
let mockLogger: jest.Mocked<winston.Logger>;
let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;

describe('PolicyService', () => {
    beforeEach(() => {
        // Initialize mocks
        mockPolicyRepository = {
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findByCriteria: jest.fn(),
            getSequelize: jest.fn().mockReturnValue({
                transaction: jest.fn().mockResolvedValue({
                    commit: jest.fn(),
                    rollback: jest.fn()
                })
            })
        } as any;

        mockPolicyClient = {
            createPolicy: jest.fn(),
            updatePolicy: jest.fn(),
            getPolicy: jest.fn()
        } as any;

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        } as any;

        mockCircuitBreaker = {
            fire: jest.fn()
        } as any;

        // Initialize service with mocks
        policyService = new PolicyService(
            mockPolicyRepository,
            mockPolicyClient,
            mockLogger,
            mockCircuitBreaker,
            oneshieldConfig
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPolicy', () => {
        it('should create policy successfully with OneShield integration within performance threshold', async () => {
            // Arrange
            const startTime = performance();
            const policyData = { ...mockPolicy };
            delete policyData.id;

            mockPolicyRepository.create.mockResolvedValue(mockPolicy);
            mockCircuitBreaker.fire.mockResolvedValue({
                policyId: 'OS-123',
                status: 'ACTIVE'
            });

            // Act
            const result = await policyService.createPolicy(policyData);

            // Assert
            expect(performance() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(mockPolicyRepository.create).toHaveBeenCalledWith(policyData, expect.any(Object));
            expect(mockCircuitBreaker.fire).toHaveBeenCalled();
            expect(result).toEqual(mockPolicy);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Policy created successfully',
                expect.any(Object)
            );
        });

        it('should rollback transaction on OneShield failure', async () => {
            // Arrange
            const policyData = { ...mockPolicy };
            delete policyData.id;
            const mockError = new Error('OneShield integration failed');

            mockPolicyRepository.create.mockResolvedValue(mockPolicy);
            mockCircuitBreaker.fire.mockRejectedValue(mockError);

            // Act & Assert
            await expect(policyService.createPolicy(policyData))
                .rejects
                .toThrow('OneShield integration failed');

            expect(mockPolicyRepository.getSequelize().transaction().rollback)
                .toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to create policy',
                expect.any(Object)
            );
        });

        it('should validate policy data before creation', async () => {
            // Arrange
            const invalidPolicyData = { ...mockPolicy };
            delete invalidPolicyData.id;
            delete invalidPolicyData.policyNumber;

            // Act & Assert
            await expect(policyService.createPolicy(invalidPolicyData))
                .rejects
                .toThrow();
            expect(mockPolicyRepository.create).not.toHaveBeenCalled();
        });

        it('should retry OneShield integration on temporary failure', async () => {
            // Arrange
            const policyData = { ...mockPolicy };
            delete policyData.id;

            mockPolicyRepository.create.mockResolvedValue(mockPolicy);
            mockCircuitBreaker.fire
                .mockRejectedValueOnce(new Error('Temporary failure'))
                .mockResolvedValueOnce({
                    policyId: 'OS-123',
                    status: 'ACTIVE'
                });

            // Act
            const result = await policyService.createPolicy(policyData);

            // Assert
            expect(mockCircuitBreaker.fire).toHaveBeenCalledTimes(2);
            expect(result).toEqual(mockPolicy);
        });
    });

    describe('updatePolicy', () => {
        it('should update policy with OneShield sync within performance threshold', async () => {
            // Arrange
            const startTime = performance();
            const updates = {
                premium: 5000,
                status: PolicyStatus.ACTIVE
            };

            mockPolicyRepository.findById.mockResolvedValue(mockPolicy);
            mockPolicyRepository.update.mockResolvedValue({
                ...mockPolicy,
                ...updates
            });
            mockCircuitBreaker.fire.mockResolvedValue({
                policyId: 'OS-123',
                status: 'ACTIVE'
            });

            // Act
            const result = await policyService.updatePolicy(mockPolicy.id, updates);

            // Assert
            expect(performance() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(mockPolicyRepository.update).toHaveBeenCalledWith(
                mockPolicy.id,
                updates,
                expect.any(Object)
            );
            expect(mockCircuitBreaker.fire).toHaveBeenCalled();
            expect(result.premium).toBe(updates.premium);
        });

        it('should validate policy state transitions', async () => {
            // Arrange
            const updates = {
                status: PolicyStatus.ACTIVE
            };

            mockPolicyRepository.findById.mockResolvedValue({
                ...mockPolicy,
                status: PolicyStatus.DRAFT
            });

            // Act & Assert
            await expect(policyService.updatePolicy(mockPolicy.id, updates))
                .rejects
                .toThrow('Invalid policy status transition');
        });

        it('should handle concurrent update conflicts', async () => {
            // Arrange
            const updates = { premium: 6000 };
            mockPolicyRepository.findById.mockResolvedValue(mockPolicy);
            mockPolicyRepository.update.mockRejectedValue(new Error('Concurrent update'));

            // Act & Assert
            await expect(policyService.updatePolicy(mockPolicy.id, updates))
                .rejects
                .toThrow('Concurrent update');
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('validatePolicyTransition', () => {
        it('should validate allowed policy status transitions', async () => {
            // Arrange
            const policy = generateMockPolicy({
                status: PolicyStatus.QUOTED,
                underwritingInfo: {
                    riskScore: 85,
                    underwriterNotes: 'Approved',
                    approvedBy: 'underwriter@mga.com'
                }
            });

            // Act & Assert
            const result = await policyService.validatePolicyTransition(
                PolicyStatus.QUOTED,
                PolicyStatus.BOUND,
                policy
            );
            expect(result).toBe(true);
        });

        it('should reject invalid policy status transitions', async () => {
            // Act & Assert
            await expect(policyService.validatePolicyTransition(
                PolicyStatus.CANCELLED,
                PolicyStatus.ACTIVE,
                mockPolicy
            )).rejects.toThrow('Invalid policy status transition');
        });

        it('should require risk assessment for binding', async () => {
            // Arrange
            const policy = generateMockPolicy({
                status: PolicyStatus.QUOTED,
                underwritingInfo: {
                    riskScore: 0,
                    underwriterNotes: ''
                }
            });

            // Act & Assert
            await expect(policyService.validatePolicyTransition(
                PolicyStatus.QUOTED,
                PolicyStatus.BOUND,
                policy
            )).rejects.toThrow('Risk assessment required');
        });
    });

    describe('getPolicy', () => {
        it('should retrieve policy with OneShield data within performance threshold', async () => {
            // Arrange
            const startTime = performance();
            mockPolicyRepository.findById.mockResolvedValue(mockPolicy);
            mockCircuitBreaker.fire.mockResolvedValue({
                policyId: 'OS-123',
                status: 'ACTIVE'
            });

            // Act
            const result = await policyService.getPolicy(mockPolicy.id);

            // Assert
            expect(performance() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(result).toEqual(mockPolicy);
            expect(mockCircuitBreaker.fire).toHaveBeenCalled();
        });

        it('should handle non-existent policy retrieval', async () => {
            // Arrange
            mockPolicyRepository.findById.mockResolvedValue(null);

            // Act & Assert
            await expect(policyService.getPolicy('non-existent-id'))
                .rejects
                .toThrow('Policy not found');
        });
    });
});