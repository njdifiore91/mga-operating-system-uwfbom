import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { UnderwritingService } from '../../../src/services/UnderwritingService';
import { IRiskAssessment } from '../../../src/types/underwriting.types';
import { RISK_SCORE_THRESHOLDS } from '../../../src/constants/underwritingRules';
import { PolicyType } from '../../../src/constants/policyTypes';
import { UnderwritingStatus } from '../../../src/types/underwriting.types';

// Mock external dependencies
jest.mock('../../../src/repositories/PolicyRepository');
jest.mock('../../../src/integrations/OneShieldClient');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/cache');

describe('UnderwritingService', () => {
    let underwritingService: UnderwritingService;
    let mockPolicyRepository: jest.Mocked<any>;
    let mockLogger: jest.Mocked<any>;
    let mockOneShieldClient: jest.Mocked<any>;
    let mockCacheManager: jest.Mocked<any>;
    let mockEventEmitter: jest.Mocked<any>;

    const testPolicy = {
        id: 'test-policy-123',
        type: PolicyType.COMMERCIAL_PROPERTY,
        status: 'DRAFT',
        effectiveDate: new Date(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 5000,
        coverages: [{
            type: 'property',
            limits: { perOccurrence: 1000000, aggregate: 2000000 },
            deductible: 5000
        }],
        validate: jest.fn()
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Initialize mocks
        mockPolicyRepository = {
            findById: jest.fn().mockResolvedValue(testPolicy)
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };
        mockOneShieldClient = {
            checkSystemStatus: jest.fn().mockResolvedValue({ available: true }),
            syncUnderwritingDecision: jest.fn().mockResolvedValue({ status: 'SYNCED' })
        };
        mockCacheManager = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(true)
        };
        mockEventEmitter = {
            emit: jest.fn()
        };

        // Initialize service
        underwritingService = new UnderwritingService(
            mockPolicyRepository,
            mockLogger,
            mockOneShieldClient,
            mockCacheManager,
            mockEventEmitter
        );
    });

    describe('assessRisk', () => {
        test('should perform risk assessment for valid policy', async () => {
            const result = await underwritingService.assessRisk(
                testPolicy.id,
                testPolicy.type,
                true
            );

            expect(result).toBeDefined();
            expect(result.policyId).toBe(testPolicy.id);
            expect(result.riskScore).toBeDefined();
            expect(result.riskFactors).toBeInstanceOf(Array);
            expect(mockLogger.info).toHaveBeenCalled();
            expect(mockCacheManager.set).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
                'underwriting.assessment.completed',
                expect.any(Object)
            );
        });

        test('should return cached assessment when available', async () => {
            const cachedAssessment: IRiskAssessment = {
                policyId: testPolicy.id,
                riskScore: 25,
                riskFactors: [],
                assessmentDate: new Date(),
                assessedBy: 'AUTOMATED_ENGINE',
                policyType: testPolicy.type,
                validationErrors: [],
                lastModified: new Date(),
                version: 1
            };

            mockCacheManager.get.mockResolvedValueOnce(cachedAssessment);

            const result = await underwritingService.assessRisk(
                testPolicy.id,
                testPolicy.type,
                true
            );

            expect(result).toEqual(cachedAssessment);
            expect(mockCacheManager.get).toHaveBeenCalled();
            expect(mockPolicyRepository.findById).not.toHaveBeenCalled();
        });

        test('should handle policy validation errors', async () => {
            testPolicy.validate.mockRejectedValueOnce(new Error('Validation failed'));

            await expect(
                underwritingService.assessRisk(testPolicy.id, testPolicy.type)
            ).rejects.toThrow('Validation failed');

            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('makeUnderwritingDecision', () => {
        const testRiskAssessment: IRiskAssessment = {
            policyId: testPolicy.id,
            riskScore: 25,
            riskFactors: [],
            assessmentDate: new Date(),
            assessedBy: 'AUTOMATED_ENGINE',
            policyType: testPolicy.type,
            validationErrors: [],
            lastModified: new Date(),
            version: 1
        };

        test('should auto-approve low risk policies', async () => {
            const result = await underwritingService.makeUnderwritingDecision(
                testRiskAssessment,
                testPolicy.type
            );

            expect(result.status).toBe(UnderwritingStatus.APPROVED);
            expect(result.automationLevel).toBe('FULL');
            expect(result.decidedBy).toBe('AUTOMATED_ENGINE');
            expect(mockOneShieldClient.syncUnderwritingDecision).toHaveBeenCalled();
        });

        test('should refer high risk policies for manual review', async () => {
            const highRiskAssessment = {
                ...testRiskAssessment,
                riskScore: RISK_SCORE_THRESHOLDS.HIGH_RISK + 1
            };

            const result = await underwritingService.makeUnderwritingDecision(
                highRiskAssessment,
                testPolicy.type
            );

            expect(result.status).toBe(UnderwritingStatus.REFERRED);
            expect(result.automationLevel).toBe('MANUAL');
            expect(result.conditions).toContain('Requires senior underwriter review');
        });

        test('should handle OneShield sync failures', async () => {
            mockOneShieldClient.syncUnderwritingDecision.mockRejectedValueOnce(
                new Error('Sync failed')
            );

            const result = await underwritingService.makeUnderwritingDecision(
                testRiskAssessment,
                testPolicy.type
            );

            expect(result.oneShieldSyncStatus).toBe('FAILED');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'OneShield sync failed',
                expect.any(Object)
            );
        });
    });

    describe('evaluatePolicy', () => {
        test('should perform end-to-end policy evaluation', async () => {
            // Mock risk assessment result
            const riskAssessment = await underwritingService.assessRisk(
                testPolicy.id,
                testPolicy.type
            );

            // Verify risk assessment
            expect(riskAssessment).toBeDefined();
            expect(riskAssessment.riskFactors.length).toBeGreaterThan(0);

            // Make underwriting decision
            const decision = await underwritingService.makeUnderwritingDecision(
                riskAssessment,
                testPolicy.type
            );

            // Verify decision
            expect(decision).toBeDefined();
            expect(decision.policyId).toBe(testPolicy.id);
            expect(decision.riskAssessment).toBeDefined();
            expect(decision.oneShieldSyncStatus).toBeDefined();
        });

        test('should handle system unavailability', async () => {
            mockOneShieldClient.checkSystemStatus.mockResolvedValueOnce({ available: false });

            const riskAssessment = await underwritingService.assessRisk(
                testPolicy.id,
                testPolicy.type
            );

            await expect(
                underwritingService.makeUnderwritingDecision(riskAssessment, testPolicy.type)
            ).rejects.toThrow('OneShield system unavailable');
        });
    });
});