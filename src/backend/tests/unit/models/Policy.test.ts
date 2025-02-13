import { describe, it, expect, beforeEach } from 'jest'; // ^29.6.2
import { Policy, validate, toJSON } from '../../src/models/Policy';
import { PolicyType } from '../../src/constants/policyTypes';
import { PolicyStatus } from '../../src/types/policy.types';
import { mockPolicy, generateMockPolicy } from '../../tests/mocks/policyData';
import { ValidationError } from 'sequelize';

describe('Policy Model', () => {
  let policy: Policy;

  beforeEach(() => {
    policy = new Policy(mockPolicy);
  });

  describe('constructor', () => {
    it('should create a new policy with default values', () => {
      const emptyPolicy = new Policy();
      expect(emptyPolicy.status).toBe(PolicyStatus.DRAFT);
      expect(emptyPolicy.coverages).toEqual([]);
      expect(emptyPolicy.underwritingInfo).toEqual({
        riskScore: 0,
        underwriterNotes: ''
      });
    });

    it('should create a policy with provided values', () => {
      expect(policy.type).toBe(mockPolicy.type);
      expect(policy.policyNumber).toBe(mockPolicy.policyNumber);
      expect(policy.premium).toBe(mockPolicy.premium);
    });

    it('should generate a policy number if not provided', () => {
      const policyWithoutNumber = new Policy({
        ...mockPolicy,
        policyNumber: undefined
      });
      expect(policyWithoutNumber.policyNumber).toMatch(/^[A-Z]{2}-\d{6}-\d{3}$/);
    });
  });

  describe('validation', () => {
    it('should validate required fields', async () => {
      const invalidPolicy = new Policy();
      await expect(invalidPolicy.validate()).rejects.toThrow(ValidationError);
    });

    it('should validate policy type', async () => {
      policy.type = 'INVALID_TYPE' as PolicyType;
      await expect(policy.validate()).rejects.toThrow('Invalid policy type');
    });

    it('should validate date ranges', async () => {
      policy.effectiveDate = new Date('2024-01-01');
      policy.expirationDate = new Date('2023-12-31');
      await expect(policy.validate()).rejects.toThrow('Effective date must be before expiration date');
    });

    it('should validate premium bounds', async () => {
      policy.premium = -100;
      await expect(policy.validate()).rejects.toThrow('Premium amount is invalid');

      policy.premium = 2000000000;
      await expect(policy.validate()).rejects.toThrow('Premium amount is invalid');
    });

    it('should validate OneShield ID for active policies', async () => {
      policy.status = PolicyStatus.ACTIVE;
      policy.oneShieldPolicyId = undefined;
      await expect(policy.validate()).rejects.toThrow('OneShield policy ID is required for active policies');
    });

    it('should validate coverage requirements', async () => {
      policy.coverages = [];
      await expect(policy.validate()).rejects.toThrow('At least one coverage is required');

      policy.coverages = [{ id: '1', type: '', limits: null, deductible: null }];
      await expect(policy.validate()).rejects.toThrow('Invalid coverage structure');
    });

    it('should validate underwriting info for bound/active policies', async () => {
      policy.status = PolicyStatus.BOUND;
      policy.underwritingInfo = { riskScore: 0, underwriterNotes: '' };
      await expect(policy.validate()).rejects.toThrow('Complete underwriting information required');
    });
  });

  describe('toJSON', () => {
    it('should format dates correctly', () => {
      const json = policy.toJSON();
      expect(json.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(json.expirationDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(json.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should format premium with 2 decimal places', () => {
      const json = policy.toJSON();
      expect(json.premium.toString()).toMatch(/^\d+\.\d{2}$/);
    });

    it('should mask sensitive underwriting information', () => {
      const json = policy.toJSON();
      expect(json.underwritingInfo.approvedBy).toBeUndefined();
      expect(json.underwritingInfo.underwriterNotes).toBeUndefined();
    });

    it('should include all required policy fields', () => {
      const json = policy.toJSON();
      const requiredFields = [
        'id',
        'policyNumber',
        'type',
        'status',
        'effectiveDate',
        'expirationDate',
        'premium',
        'coverages',
        'underwritingInfo'
      ];
      requiredFields.forEach(field => {
        expect(json).toHaveProperty(field);
      });
    });
  });

  describe('policy number generation', () => {
    it('should generate valid policy numbers', () => {
      const policies = Array(10).fill(null).map(() => new Policy({
        ...mockPolicy,
        policyNumber: undefined,
        type: PolicyType.COMMERCIAL_PROPERTY
      }));

      policies.forEach(p => {
        expect(p.policyNumber).toMatch(/^CO-\d{6}-\d{3}$/);
      });
    });

    it('should use correct prefix for different policy types', () => {
      const typeTests = [
        { type: PolicyType.COMMERCIAL_PROPERTY, prefix: 'CO' },
        { type: PolicyType.GENERAL_LIABILITY, prefix: 'GE' },
        { type: PolicyType.CYBER_LIABILITY, prefix: 'CY' }
      ];

      typeTests.forEach(({ type, prefix }) => {
        const testPolicy = new Policy({
          ...mockPolicy,
          policyNumber: undefined,
          type
        });
        expect(testPolicy.policyNumber).toMatch(new RegExp(`^${prefix}-\\d{6}-\\d{3}$`));
      });
    });
  });

  describe('OneShield integration', () => {
    it('should handle OneShield policy ID assignment', () => {
      const oneShieldId = 'OS123456789';
      policy.oneShieldPolicyId = oneShieldId;
      expect(policy.oneShieldPolicyId).toBe(oneShieldId);
    });

    it('should validate OneShield ID format', async () => {
      policy.status = PolicyStatus.ACTIVE;
      policy.oneShieldPolicyId = 'invalid-id';
      await expect(policy.validate()).rejects.toThrow(ValidationError);
    });
  });
});