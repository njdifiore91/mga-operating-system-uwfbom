import { ClaimsService } from '../../../src/services/ClaimsService';
import { ClaimRepository } from '../../../src/repositories/ClaimRepository';
import { ClaimsEventProducer } from '../../../src/events/producers/ClaimsEventProducer';
import { CLAIM_STATUS } from '../../../src/constants/claimStatus';
import mockClaims from '../../mocks/claimsData';
import { Logger } from '../../../src/utils/logger';
import { MetricsManager } from '../../../src/utils/metrics';

// Mock dependencies
jest.mock('../../../src/repositories/ClaimRepository');
jest.mock('../../../src/events/producers/ClaimsEventProducer');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/metrics');

describe('ClaimsService', () => {
  let claimsService: ClaimsService;
  let mockClaimRepository: jest.Mocked<ClaimRepository>;
  let mockEventProducer: jest.Mocked<ClaimsEventProducer>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<MetricsManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockClaimRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      updateReserves: jest.fn()
    } as any;

    mockEventProducer = {
      initialize: jest.fn(),
      publishClaimCreated: jest.fn(),
      publishClaimStatusChanged: jest.fn(),
      publishReservesUpdated: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    mockMetrics = {
      recordCacheMetrics: jest.fn()
    } as any;

    // Create service instance with mocked dependencies
    claimsService = new ClaimsService(
      mockClaimRepository,
      mockEventProducer,
      mockLogger,
      mockMetrics
    );
  });

  describe('createClaim', () => {
    const validClaimData = {
      policyId: 'pol456',
      incidentDate: new Date(),
      description: 'Water damage from burst pipe',
      location: mockClaims[0].location,
      claimantInfo: mockClaims[0].claimantInfo,
      initialReserve: 25000.00,
      documents: []
    };

    it('should create a new claim successfully with valid data', async () => {
      const expectedClaim = { ...mockClaims[0] };
      mockClaimRepository.create.mockResolvedValue(expectedClaim);
      mockEventProducer.publishClaimCreated.mockResolvedValue();

      const result = await claimsService.createClaim(validClaimData);

      expect(result).toEqual(expectedClaim);
      expect(mockClaimRepository.create).toHaveBeenCalledWith(validClaimData);
      expect(mockEventProducer.publishClaimCreated).toHaveBeenCalledWith(expectedClaim);
      expect(mockMetrics.recordCacheMetrics).toHaveBeenCalled();
    });

    it('should throw ValidationError if claim data is incomplete', async () => {
      const invalidData = { ...validClaimData, description: '' };

      await expect(claimsService.createClaim(invalidData))
        .rejects
        .toThrow('Description must be at least 10 characters');

      expect(mockClaimRepository.create).not.toHaveBeenCalled();
      expect(mockEventProducer.publishClaimCreated).not.toHaveBeenCalled();
    });

    it('should handle concurrent claim creation requests', async () => {
      const claims = [{ ...mockClaims[0] }, { ...mockClaims[1] }];
      mockClaimRepository.create
        .mockResolvedValueOnce(claims[0])
        .mockResolvedValueOnce(claims[1]);

      const results = await Promise.all([
        claimsService.createClaim(validClaimData),
        claimsService.createClaim(validClaimData)
      ]);

      expect(results).toHaveLength(2);
      expect(mockClaimRepository.create).toHaveBeenCalledTimes(2);
      expect(mockEventProducer.publishClaimCreated).toHaveBeenCalledTimes(2);
    });
  });

  describe('getClaim', () => {
    const claimId = 'claim123';

    it('should retrieve claim by ID successfully', async () => {
      const expectedClaim = mockClaims[0];
      mockClaimRepository.findById.mockResolvedValue(expectedClaim);

      const result = await claimsService.getClaim(claimId);

      expect(result).toEqual(expectedClaim);
      expect(mockClaimRepository.findById).toHaveBeenCalledWith(claimId);
      expect(mockMetrics.recordCacheMetrics).toHaveBeenCalled();
    });

    it('should throw NotFoundError if claim does not exist', async () => {
      mockClaimRepository.findById.mockResolvedValue(null);

      await expect(claimsService.getClaim(claimId))
        .rejects
        .toThrow(`Claim not found: ${claimId}`);
    });

    it('should handle cached claim data correctly', async () => {
      const expectedClaim = mockClaims[0];
      mockClaimRepository.findById.mockResolvedValue(expectedClaim);

      await claimsService.getClaim(claimId);
      await claimsService.getClaim(claimId);

      expect(mockClaimRepository.findById).toHaveBeenCalledTimes(2);
      expect(mockMetrics.recordCacheMetrics).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateClaimStatus', () => {
    const claimId = 'claim123';
    const updateData = {
      status: CLAIM_STATUS.UNDER_REVIEW,
      notes: 'Claim under review by adjuster',
      adjusterId: 'adj789',
      reserveAmount: 25000.00
    };

    it('should update claim status successfully for valid transition', async () => {
      const originalClaim = { ...mockClaims[0] };
      const updatedClaim = { 
        ...originalClaim, 
        status: CLAIM_STATUS.UNDER_REVIEW 
      };

      mockClaimRepository.findById.mockResolvedValue(originalClaim);
      mockClaimRepository.updateStatus.mockResolvedValue(updatedClaim);
      mockEventProducer.publishClaimStatusChanged.mockResolvedValue();

      const result = await claimsService.updateClaimStatus(claimId, updateData);

      expect(result).toEqual(updatedClaim);
      expect(mockClaimRepository.updateStatus).toHaveBeenCalledWith(claimId, updateData);
      expect(mockEventProducer.publishClaimStatusChanged).toHaveBeenCalledWith(
        updatedClaim,
        updateData.status
      );
    });

    it('should throw ValidationError if status transition is invalid', async () => {
      const originalClaim = { ...mockClaims[0], status: CLAIM_STATUS.CLOSED };
      mockClaimRepository.findById.mockResolvedValue(originalClaim);

      await expect(claimsService.updateClaimStatus(claimId, updateData))
        .rejects
        .toThrow('Invalid status transition');
    });

    it('should handle concurrent status update requests', async () => {
      const originalClaim = { ...mockClaims[0] };
      const updatedClaim = { 
        ...originalClaim, 
        status: CLAIM_STATUS.UNDER_REVIEW 
      };

      mockClaimRepository.findById.mockResolvedValue(originalClaim);
      mockClaimRepository.updateStatus.mockResolvedValue(updatedClaim);

      const results = await Promise.all([
        claimsService.updateClaimStatus(claimId, updateData),
        claimsService.updateClaimStatus(claimId, updateData)
      ]);

      expect(results).toHaveLength(2);
      expect(mockClaimRepository.updateStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateReserves', () => {
    const claimId = 'claim123';
    const newReserveAmount = 50000.00;

    it('should update claim reserves successfully with valid amount', async () => {
      const originalClaim = { ...mockClaims[0] };
      const updatedClaim = { 
        ...originalClaim, 
        reserveAmount: newReserveAmount 
      };

      mockClaimRepository.findById.mockResolvedValue(originalClaim);
      mockClaimRepository.updateStatus.mockResolvedValue(updatedClaim);

      const result = await claimsService.updateReserves(claimId, newReserveAmount);

      expect(result).toEqual(updatedClaim);
      expect(mockClaimRepository.updateStatus).toHaveBeenCalledWith(
        claimId,
        expect.objectContaining({
          reserveAmount: newReserveAmount
        })
      );
    });

    it('should throw ValidationError if reserve amount is negative', async () => {
      await expect(claimsService.updateReserves(claimId, -1000))
        .rejects
        .toThrow('Reserve amount cannot be negative');

      expect(mockClaimRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle concurrent reserve update requests', async () => {
      const originalClaim = { ...mockClaims[0] };
      const updatedClaim = { 
        ...originalClaim, 
        reserveAmount: newReserveAmount 
      };

      mockClaimRepository.findById.mockResolvedValue(originalClaim);
      mockClaimRepository.updateStatus.mockResolvedValue(updatedClaim);

      const results = await Promise.all([
        claimsService.updateReserves(claimId, newReserveAmount),
        claimsService.updateReserves(claimId, newReserveAmount)
      ]);

      expect(results).toHaveLength(2);
      expect(mockClaimRepository.updateStatus).toHaveBeenCalledTimes(2);
    });
  });
});