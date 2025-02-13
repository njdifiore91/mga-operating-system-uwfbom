import { describe, it, beforeEach, afterEach, expect } from 'jest';
import { Container } from 'inversify';
import { ClaimsService } from '../../src/services/ClaimsService';
import { ClaimsEventProducer } from '../../src/events/producers/ClaimsEventProducer';
import { CLAIM_STATUS } from '../../src/constants/claimStatus';
import mockClaims, { generateBulkClaims } from '../mocks/claimsData';
import { Logger } from '../../src/utils/logger';
import { metricsManager } from '../../src/utils/metrics';

/**
 * Sets up a test container with required dependencies
 */
const setupTestContainer = (): Container => {
  const container = new Container();
  
  // Bind core services
  container.bind(ClaimsService).toSelf();
  container.bind(ClaimsEventProducer).toSelf();
  container.bind('Logger').toConstantValue(Logger);
  container.bind('MetricsManager').toConstantValue(metricsManager);

  return container;
};

describe('Claims Integration Tests', () => {
  let container: Container;
  let claimsService: ClaimsService;
  let eventProducer: ClaimsEventProducer;

  beforeEach(async () => {
    container = setupTestContainer();
    claimsService = container.get(ClaimsService);
    eventProducer = container.get(ClaimsEventProducer);
    await eventProducer.initialize();
  });

  afterEach(async () => {
    await eventProducer.shutdown();
  });

  describe('Claims Creation and Carrier Sync', () => {
    it('should create claim with successful carrier sync', async () => {
      const startTime = Date.now();
      const { singleClaim } = mockClaims[0];

      // Create claim
      const claim = await claimsService.createClaim({
        policyId: singleClaim.policyId,
        incidentDate: singleClaim.incidentDate,
        description: singleClaim.description,
        location: singleClaim.location,
        claimantInfo: singleClaim.claimantInfo,
        initialReserve: singleClaim.reserveAmount,
        documents: []
      });

      // Verify claim creation
      expect(claim).toBeDefined();
      expect(claim.id).toBeDefined();
      expect(claim.status).toBe(CLAIM_STATUS.NEW);

      // Verify carrier sync
      const syncResult = await claimsService.validateCarrierSync(claim.id);
      expect(syncResult.syncRate).toBeGreaterThanOrEqual(0.999);

      // Verify performance
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // 2 second SLA
    });

    it('should handle carrier sync failures gracefully', async () => {
      const invalidClaim = {
        ...mockClaims[0],
        policyId: 'invalid_policy'
      };

      try {
        await claimsService.createClaim({
          policyId: invalidClaim.policyId,
          incidentDate: invalidClaim.incidentDate,
          description: invalidClaim.description,
          location: invalidClaim.location,
          claimantInfo: invalidClaim.claimantInfo,
          initialReserve: invalidClaim.reserveAmount,
          documents: []
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('carrier sync failed');
      }
    });
  });

  describe('Claims Status Management', () => {
    it('should update claim status with carrier sync', async () => {
      const claim = await claimsService.createClaim({
        ...mockClaims[0],
        documents: []
      });

      const startTime = Date.now();

      // Update status
      const updatedClaim = await claimsService.updateClaimStatus(claim.id, {
        status: CLAIM_STATUS.UNDER_REVIEW,
        notes: 'Moving to review',
        adjusterId: 'adj123',
        reserveAmount: claim.reserveAmount
      });

      // Verify status update
      expect(updatedClaim.status).toBe(CLAIM_STATUS.UNDER_REVIEW);
      expect(updatedClaim.statusHistory).toHaveLength(2);

      // Verify carrier sync
      const syncResult = await claimsService.validateCarrierSync(claim.id);
      expect(syncResult.syncRate).toBeGreaterThanOrEqual(0.999);

      // Verify performance
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Claims Performance Validation', () => {
    it('should process bulk claims within SLA', async () => {
      const bulkClaims = generateBulkClaims(100);
      const startTime = Date.now();
      const results = [];

      // Process claims in parallel
      const promises = bulkClaims.map(claim => 
        claimsService.createClaim({
          policyId: claim.policyId,
          incidentDate: claim.incidentDate,
          description: claim.description,
          location: claim.location,
          claimantInfo: claim.claimantInfo,
          initialReserve: claim.reserveAmount,
          documents: []
        })
      );

      results.push(...await Promise.all(promises));

      // Verify bulk processing
      expect(results).toHaveLength(100);
      
      // Calculate throughput
      const duration = Date.now() - startTime;
      const throughputPerMinute = (results.length / duration) * 60000;
      expect(throughputPerMinute).toBeGreaterThanOrEqual(10000);

      // Verify carrier sync for all claims
      const syncResults = await Promise.all(
        results.map(claim => claimsService.validateCarrierSync(claim.id))
      );

      const avgSyncRate = syncResults.reduce((acc, curr) => acc + curr.syncRate, 0) / syncResults.length;
      expect(avgSyncRate).toBeGreaterThanOrEqual(0.999);
    });

    it('should maintain response times under 2 seconds', async () => {
      const iterations = 50;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await claimsService.createClaim({
          ...mockClaims[0],
          documents: []
        });

        responseTimes.push(Date.now() - startTime);
      }

      // Verify response times
      const avgResponseTime = responseTimes.reduce((acc, curr) => acc + curr, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(2000);
      expect(maxResponseTime).toBeLessThan(2000);
    });
  });

  describe('Event Production Validation', () => {
    it('should produce claim events with carrier sync', async () => {
      const claim = await claimsService.createClaim({
        ...mockClaims[0],
        documents: []
      });

      // Verify event production
      const events = await eventProducer.getEvents(claim.id);
      expect(events).toBeDefined();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('CLAIM_CREATED');
      expect(events[0].payload.claimId).toBe(claim.id);

      // Verify carrier sync event
      const syncEvents = events.filter(e => e.type === 'CARRIER_SYNC');
      expect(syncEvents).toHaveLength(1);
      expect(syncEvents[0].payload.success).toBe(true);
    });
  });
});