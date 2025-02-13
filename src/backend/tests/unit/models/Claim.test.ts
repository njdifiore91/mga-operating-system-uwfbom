import { describe, it, expect, beforeEach, jest } from 'jest';
import type { MockInstance } from '@types/jest';
import { ClaimModel } from '../../../src/models/Claim';
import { CLAIM_STATUS } from '../../../src/constants/claimStatus';
import mockClaims from '../../mocks/claimsData';

describe('ClaimModel', () => {
  let claimInstance: ClaimModel;
  let mockSave: MockInstance;
  let mockOneShieldSync: MockInstance;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Initialize test claim instance with mock data
    claimInstance = new ClaimModel(mockClaims[0]);

    // Mock the save method
    mockSave = jest.spyOn(ClaimModel.prototype, 'save')
      .mockImplementation(() => Promise.resolve(claimInstance));

    // Mock OneShield sync functionality
    mockOneShieldSync = jest.spyOn(ClaimModel.prototype, 'syncWithOneShield')
      .mockImplementation(() => Promise.resolve(true));
  });

  describe('constructor', () => {
    it('should initialize a new claim with all required properties', () => {
      expect(claimInstance).toMatchObject({
        id: expect.any(String),
        policyId: expect.any(String),
        claimNumber: expect.any(String),
        status: CLAIM_STATUS.NEW,
        incidentDate: expect.any(Date),
        reportedDate: expect.any(Date),
        description: expect.any(String),
        location: expect.objectContaining({
          address: expect.any(String),
          city: expect.any(String),
          state: expect.any(String),
          zipCode: expect.any(String)
        }),
        claimantInfo: expect.objectContaining({
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String)
        }),
        reserveAmount: expect.any(Number),
        paidAmount: expect.any(Number),
        documents: expect.any(Array),
        statusHistory: expect.any(Array),
        auditLog: expect.any(Array)
      });
    });

    it('should initialize with empty arrays for documents, statusHistory and auditLog if not provided', () => {
      const minimalClaim = new ClaimModel({
        ...mockClaims[0],
        documents: undefined,
        statusHistory: undefined,
        auditLog: undefined
      });

      expect(minimalClaim.documents).toEqual([]);
      expect(minimalClaim.statusHistory).toEqual([]);
      expect(minimalClaim.auditLog).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update status with valid transition', async () => {
      const newStatus = CLAIM_STATUS.UNDER_REVIEW;
      const notes = 'Moving to review';
      const metadata = { userId: 'user123', adjusterId: 'adj456' };

      await claimInstance.updateStatus(newStatus, notes, metadata);

      expect(claimInstance.status).toBe(newStatus);
      expect(claimInstance.statusHistory).toContainEqual(
        expect.objectContaining({
          status: newStatus,
          notes,
          userId: metadata.userId
        })
      );
      expect(mockSave).toHaveBeenCalled();
      expect(mockOneShieldSync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STATUS_UPDATE',
          payload: expect.objectContaining({
            status: newStatus,
            notes,
            adjusterId: metadata.adjusterId
          })
        })
      );
    });

    it('should update reserve amount when provided in metadata', async () => {
      const initialReserve = claimInstance.reserveAmount;
      const reserveChange = 5000;

      await claimInstance.updateStatus(
        CLAIM_STATUS.UNDER_REVIEW,
        'Updating reserve',
        { userId: 'user123', reserveChange }
      );

      expect(claimInstance.reserveAmount).toBe(initialReserve + reserveChange);
    });

    it('should maintain audit trail for status updates', async () => {
      const newStatus = CLAIM_STATUS.UNDER_REVIEW;
      const oldStatus = claimInstance.status;

      await claimInstance.updateStatus(newStatus, 'Test update', { userId: 'user123' });

      expect(claimInstance.auditLog).toContainEqual(
        expect.objectContaining({
          action: 'STATUS_UPDATE',
          userId: 'user123',
          details: expect.objectContaining({
            oldStatus,
            newStatus
          })
        })
      );
    });
  });

  describe('calculateTotalExposure', () => {
    it('should calculate exposure with risk factors correctly', async () => {
      const riskFactors = {
        severity: 1.5,
        complexity: 1.2,
        litigation: true
      };

      const result = await claimInstance.calculateTotalExposure(riskFactors);

      expect(result).toEqual({
        totalExposure: expect.any(Number),
        breakdown: expect.objectContaining({
          baseReserve: claimInstance.reserveAmount,
          paidAmount: claimInstance.paidAmount,
          outstandingReserve: claimInstance.reserveAmount - claimInstance.paidAmount
        }),
        riskAdjustment: expect.any(Number)
      });

      // Verify risk adjustment calculation
      const expectedRiskAdjustment = riskFactors.severity * riskFactors.complexity * 1.5;
      expect(result.riskAdjustment).toBe(expectedRiskAdjustment);
    });

    it('should handle zero reserve amount correctly', async () => {
      claimInstance.reserveAmount = 0;

      const result = await claimInstance.calculateTotalExposure({
        severity: 1.0,
        complexity: 1.0,
        litigation: false
      });

      expect(result.totalExposure).toBe(0);
      expect(result.breakdown.baseReserve).toBe(0);
      expect(result.breakdown.outstandingReserve).toBe(0);
    });
  });

  describe('syncWithOneShield', () => {
    it('should successfully sync with OneShield and maintain audit trail', async () => {
      const syncOptions = {
        action: 'UPDATE_CLAIM',
        payload: { status: CLAIM_STATUS.APPROVED }
      };

      const result = await claimInstance.syncWithOneShield(syncOptions);

      expect(result).toBe(true);
      expect(claimInstance.auditLog).toContainEqual(
        expect.objectContaining({
          action: 'ONESHIELD_SYNC_ATTEMPT',
          userId: 'SYSTEM',
          details: syncOptions
        })
      );
      expect(claimInstance.auditLog).toContainEqual(
        expect.objectContaining({
          action: 'ONESHIELD_SYNC_SUCCESS',
          userId: 'SYSTEM'
        })
      );
    });

    it('should handle sync failures appropriately', async () => {
      mockOneShieldSync.mockRejectedValueOnce(new Error('Sync failed'));

      await expect(claimInstance.syncWithOneShield({
        action: 'UPDATE_CLAIM',
        payload: {}
      })).rejects.toThrow('Sync failed');

      expect(claimInstance.auditLog).toContainEqual(
        expect.objectContaining({
          action: 'ONESHIELD_SYNC_ERROR',
          userId: 'SYSTEM',
          details: expect.objectContaining({
            error: 'Sync failed'
          })
        })
      );
    });
  });

  describe('validateCompliance', () => {
    it('should validate required fields for compliance', () => {
      const validationResult = claimInstance.validateCompliance();

      expect(validationResult).toEqual(
        expect.objectContaining({
          isCompliant: expect.any(Boolean),
          validationResults: expect.any(Array)
        })
      );
    });

    it('should track compliance validation in audit log', () => {
      claimInstance.validateCompliance();

      expect(claimInstance.auditLog).toContainEqual(
        expect.objectContaining({
          action: 'COMPLIANCE_VALIDATION',
          userId: 'SYSTEM'
        })
      );
    });
  });
});