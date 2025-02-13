/**
 * @file Integration tests for automated underwriting engine
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { describe, it, expect, beforeAll, afterAll } from 'jest';
import nock from 'nock'; // ^13.3.1
import { faker } from '@faker-js/faker'; // ^8.0.2
import { OneShieldClient } from '@oneshield/api-client'; // ^2.0.0
import { TestDatabase } from '@testing-library/database-mock'; // ^1.0.0
import { UnderwritingService } from '../../src/services/UnderwritingService';
import { mockPolicies } from '../mocks/policyData';
import { PolicyType } from '../../src/constants/policyTypes';
import { UnderwritingStatus } from '../../src/types/underwriting.types';
import { RISK_SCORE_THRESHOLDS, AUTO_APPROVAL_CRITERIA } from '../../src/constants/underwritingRules';

// Test environment configuration
const ONE_SHIELD_API_URL = 'https://api.oneshield.com/v2';
const TEST_TIMEOUT = 30000;
let underwritingService: UnderwritingService;
let testDb: TestDatabase;
let performanceMetrics: { startTime: number; endTime: number; };

beforeAll(async () => {
    // Initialize test database
    testDb = new TestDatabase({
        name: 'test_underwriting_db',
        clean: true
    });
    await testDb.connect();

    // Initialize UnderwritingService with test dependencies
    underwritingService = new UnderwritingService(
        testDb.getRepository('policies'),
        console,
        new OneShieldClient({
            apiUrl: ONE_SHIELD_API_URL,
            apiKey: 'test_key'
        }),
        {} as any, // Mock cache
        {} as any  // Mock event emitter
    );

    // Configure OneShield API mocks
    nock(ONE_SHIELD_API_URL)
        .persist()
        .get('/system/status')
        .reply(200, { available: true, version: '2.0.0' });

    // Seed test data
    await testDb.loadFixtures(mockPolicies);
});

afterAll(async () => {
    await testDb.disconnect();
    nock.cleanAll();
});

describe('Risk Assessment Integration Tests', () => {
    it('should accurately assess risk for various policy types', async () => {
        // Test each policy type
        for (const policyType of Object.values(PolicyType)) {
            const testPolicy = mockPolicies.find(p => p.type === policyType);
            if (!testPolicy) continue;

            const assessment = await underwritingService.assessRisk(
                testPolicy.id,
                policyType,
                false // Disable cache for testing
            );

            expect(assessment).toBeDefined();
            expect(assessment.policyId).toBe(testPolicy.id);
            expect(assessment.policyType).toBe(policyType);
            expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
            expect(assessment.riskScore).toBeLessThanOrEqual(100);
            expect(assessment.riskFactors).toHaveLength(4); // Claims, Location, Coverage, Business
            expect(assessment.validationErrors).toHaveLength(0);
        }
    }, TEST_TIMEOUT);

    it('should handle complex risk scenarios with multiple factors', async () => {
        const complexPolicy = mockPolicies[0];
        complexPolicy.claimHistory = Array(5).fill(null).map(() => ({
            id: faker.string.uuid(),
            policyId: complexPolicy.id,
            claimNumber: faker.string.alphanumeric(10),
            incidentDate: faker.date.past(),
            status: 'OPEN',
            amount: faker.number.float({ min: 10000, max: 50000 }),
            description: faker.lorem.sentence()
        }));

        const assessment = await underwritingService.assessRisk(
            complexPolicy.id,
            complexPolicy.type,
            false
        );

        expect(assessment.riskScore).toBeGreaterThan(RISK_SCORE_THRESHOLDS.MEDIUM_RISK);
        expect(assessment.riskFactors).toContainEqual(
            expect.objectContaining({
                type: 'CLAIMS_HISTORY',
                score: expect.any(Number),
                confidence: expect.any(Number)
            })
        );
    });
});

describe('OneShield Integration Tests', () => {
    it('should successfully sync decisions with OneShield', async () => {
        // Mock OneShield API endpoints
        nock(ONE_SHIELD_API_URL)
            .post('/policies/decisions')
            .reply(200, { 
                status: 'SUCCESS',
                policyId: mockPolicies[0].id,
                transactionId: faker.string.uuid()
            });

        const assessment = await underwritingService.assessRisk(
            mockPolicies[0].id,
            mockPolicies[0].type,
            false
        );

        const decision = await underwritingService.makeUnderwritingDecision(
            assessment,
            mockPolicies[0].type
        );

        expect(decision.oneShieldSyncStatus).toBe('SYNCED');
        expect(decision.status).toBeDefined();
        expect(decision.automationLevel).toBeDefined();
    });

    it('should handle OneShield API failures gracefully', async () => {
        // Mock API failure
        nock(ONE_SHIELD_API_URL)
            .post('/policies/decisions')
            .replyWithError('Network timeout');

        const assessment = await underwritingService.assessRisk(
            mockPolicies[1].id,
            mockPolicies[1].type,
            false
        );

        const decision = await underwritingService.makeUnderwritingDecision(
            assessment,
            mockPolicies[1].type
        );

        expect(decision.oneShieldSyncStatus).toBe('FAILED');
        expect(decision.status).toBe(UnderwritingStatus.REFERRED);
    });
});

describe('Performance Benchmark Tests', () => {
    it('should meet performance SLAs for risk assessment', async () => {
        const PERFORMANCE_THRESHOLD_MS = 2000; // 2 seconds max
        const testPolicy = mockPolicies[0];

        performanceMetrics.startTime = Date.now();

        const assessment = await underwritingService.assessRisk(
            testPolicy.id,
            testPolicy.type,
            false
        );

        performanceMetrics.endTime = Date.now();
        const processingTime = performanceMetrics.endTime - performanceMetrics.startTime;

        expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
        expect(assessment).toBeDefined();
    });

    it('should handle concurrent risk assessments efficiently', async () => {
        const CONCURRENT_REQUESTS = 10;
        const requests = mockPolicies.slice(0, CONCURRENT_REQUESTS).map(policy =>
            underwritingService.assessRisk(policy.id, policy.type, false)
        );

        performanceMetrics.startTime = Date.now();
        const results = await Promise.all(requests);
        performanceMetrics.endTime = Date.now();

        const avgProcessingTime = 
            (performanceMetrics.endTime - performanceMetrics.startTime) / CONCURRENT_REQUESTS;

        expect(results).toHaveLength(CONCURRENT_REQUESTS);
        expect(avgProcessingTime).toBeLessThan(1000); // 1 second avg per request
        results.forEach(result => {
            expect(result.riskScore).toBeDefined();
            expect(result.validationErrors).toHaveLength(0);
        });
    });
});

describe('Automated Decision Making Tests', () => {
    it('should automatically approve eligible policies', async () => {
        const lowRiskPolicy = mockPolicies[0];
        lowRiskPolicy.underwritingInfo.riskScore = RISK_SCORE_THRESHOLDS.LOW_RISK - 5;

        const assessment = await underwritingService.assessRisk(
            lowRiskPolicy.id,
            lowRiskPolicy.type,
            false
        );

        const decision = await underwritingService.makeUnderwritingDecision(
            assessment,
            lowRiskPolicy.type
        );

        expect(decision.status).toBe(UnderwritingStatus.APPROVED);
        expect(decision.automationLevel).toBe('FULL');
        expect(decision.decidedBy).toBe('AUTOMATED_ENGINE');
    });

    it('should refer high-risk policies for manual review', async () => {
        const highRiskPolicy = mockPolicies[1];
        highRiskPolicy.underwritingInfo.riskScore = RISK_SCORE_THRESHOLDS.HIGH_RISK + 5;

        const assessment = await underwritingService.assessRisk(
            highRiskPolicy.id,
            highRiskPolicy.type,
            false
        );

        const decision = await underwritingService.makeUnderwritingDecision(
            assessment,
            highRiskPolicy.type
        );

        expect(decision.status).toBe(UnderwritingStatus.REFERRED);
        expect(decision.automationLevel).toBe('MANUAL');
        expect(decision.conditions).toContain('Requires senior underwriter review');
    });
});