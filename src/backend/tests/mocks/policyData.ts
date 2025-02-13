/**
 * @file Mock policy data for MGA Operating System testing
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { faker } from '@faker-js/faker'; // v8.0.2
import {
  IPolicy,
  PolicyStatus,
  PolicyHolderType,
  VerificationStatus,
  ClaimStatus,
  SyncStatus,
  PaymentMethod,
  BillingSchedule,
  DeliveryMethod,
  PaymentStatus,
  IDocument,
  IClaimHistory,
  IEndorsement
} from '../src/types/policy.types';
import { PolicyType, POLICY_TYPE_DESCRIPTIONS } from '../src/constants/policyTypes';

/**
 * Default premium ranges by policy type for realistic mock data
 */
const DEFAULT_PREMIUM_RANGES: Record<PolicyType, { min: number; max: number }> = {
  [PolicyType.COMMERCIAL_PROPERTY]: { min: 5000, max: 50000 },
  [PolicyType.GENERAL_LIABILITY]: { min: 2000, max: 25000 },
  [PolicyType.PROFESSIONAL_LIABILITY]: { min: 3000, max: 30000 },
  [PolicyType.WORKERS_COMPENSATION]: { min: 10000, max: 100000 },
  [PolicyType.COMMERCIAL_AUTO]: { min: 4000, max: 40000 },
  [PolicyType.CYBER_LIABILITY]: { min: 1500, max: 15000 },
  [PolicyType.UMBRELLA]: { min: 3000, max: 35000 },
  [PolicyType.BUSINESS_OWNERS_POLICY]: { min: 2500, max: 20000 }
};

/**
 * Generates mock documents for policy testing
 */
export function generateMockDocuments(count: number = 3): IDocument[] {
  return Array(count).fill(null).map(() => ({
    id: uuidv4(),
    type: faker.helpers.arrayElement(['POLICY', 'ENDORSEMENT', 'INVOICE', 'CLAIM']),
    fileName: faker.system.fileName(),
    fileUrl: faker.internet.url(),
    uploadDate: faker.date.past(),
    metadata: {
      size: faker.number.int({ min: 1000, max: 5000000 }),
      mimeType: 'application/pdf',
      uploadedBy: faker.internet.email()
    }
  }));
}

/**
 * Generates mock claims for policy testing
 */
export function generateMockClaims(count: number = 2): IClaimHistory[] {
  return Array(count).fill(null).map(() => ({
    id: uuidv4(),
    policyId: uuidv4(),
    claimNumber: `CLM-${faker.string.alphanumeric(8).toUpperCase()}`,
    incidentDate: faker.date.past(),
    status: faker.helpers.arrayElement(Object.values(ClaimStatus)),
    amount: faker.number.float({ min: 1000, max: 50000, precision: 2 }),
    description: faker.lorem.sentence()
  }));
}

/**
 * Generates mock endorsements for policy testing
 */
export function generateMockEndorsements(count: number = 2): IEndorsement[] {
  return Array(count).fill(null).map(() => ({
    id: uuidv4(),
    type: faker.helpers.arrayElement(['ADDITIONAL_INSURED', 'COVERAGE_EXTENSION', 'EXCLUSION']),
    effectiveDate: faker.date.future(),
    description: faker.lorem.sentence(),
    premium: faker.number.float({ min: 100, max: 5000, precision: 2 }),
    status: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'ACTIVE'])
  }));
}

/**
 * Generates a complete mock policy object for testing
 */
export function generateMockPolicy(overrides: Partial<IPolicy> = {}): IPolicy {
  const policyType = faker.helpers.arrayElement(Object.values(PolicyType));
  const effectiveDate = faker.date.future();
  const expirationDate = new Date(effectiveDate);
  expirationDate.setFullYear(effectiveDate.getFullYear() + 1);

  const mockPolicy: IPolicy = {
    id: uuidv4(),
    policyNumber: `POL-${faker.string.alphanumeric(8).toUpperCase()}`,
    type: policyType,
    status: faker.helpers.arrayElement(Object.values(PolicyStatus)),
    effectiveDate,
    expirationDate,
    premium: faker.number.float({
      min: DEFAULT_PREMIUM_RANGES[policyType].min,
      max: DEFAULT_PREMIUM_RANGES[policyType].max,
      precision: 2
    }),
    coverages: [{
      id: uuidv4(),
      type: POLICY_TYPE_DESCRIPTIONS[policyType],
      limits: {
        perOccurrence: faker.number.int({ min: 100000, max: 1000000 }),
        aggregate: faker.number.int({ min: 1000000, max: 5000000 })
      },
      deductible: faker.number.int({ min: 1000, max: 10000 }),
      endorsements: [],
      exclusions: []
    }],
    underwritingInfo: {
      riskScore: faker.number.int({ min: 1, max: 100 }),
      underwriterNotes: faker.lorem.paragraph(),
      approvalDate: faker.date.past(),
      approvedBy: faker.internet.email(),
      specialConditions: []
    },
    endorsements: generateMockEndorsements(),
    documents: generateMockDocuments(),
    policyHolder: {
      id: uuidv4(),
      type: faker.helpers.arrayElement(Object.values(PolicyHolderType)),
      legalName: faker.company.name(),
      taxId: faker.string.numeric(9),
      address: {
        street1: faker.location.streetAddress(),
        street2: faker.helpers.maybe(() => faker.location.secondaryAddress()),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode(),
        country: 'USA'
      },
      contact: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        alternatePhone: faker.helpers.maybe(() => faker.phone.number())
      },
      verificationStatus: faker.helpers.arrayElement(Object.values(VerificationStatus))
    },
    claimHistory: generateMockClaims(),
    carrierInfo: {
      carrierId: uuidv4(),
      carrierPolicyNumber: `OS-${faker.string.alphanumeric(10).toUpperCase()}`,
      oneshieldId: faker.string.alphanumeric(12),
      syncStatus: faker.helpers.arrayElement(Object.values(SyncStatus)),
      lastSyncDate: faker.date.recent()
    },
    billingInfo: {
      paymentMethod: faker.helpers.arrayElement(Object.values(PaymentMethod)),
      billingSchedule: faker.helpers.arrayElement(Object.values(BillingSchedule)),
      invoiceDelivery: faker.helpers.arrayElement(Object.values(DeliveryMethod)),
      paymentStatus: faker.helpers.arrayElement(Object.values(PaymentStatus))
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
  };

  return { ...mockPolicy, ...overrides };
}

/**
 * Array of mock policies covering different types and scenarios
 */
export const mockPolicies: IPolicy[] = [
  generateMockPolicy({ type: PolicyType.COMMERCIAL_PROPERTY, status: PolicyStatus.ACTIVE }),
  generateMockPolicy({ type: PolicyType.GENERAL_LIABILITY, status: PolicyStatus.DRAFT }),
  generateMockPolicy({ type: PolicyType.CYBER_LIABILITY, status: PolicyStatus.CANCELLED }),
  generateMockPolicy({ type: PolicyType.WORKERS_COMPENSATION, status: PolicyStatus.EXPIRED }),
  generateMockPolicy({ type: PolicyType.COMMERCIAL_AUTO, status: PolicyStatus.BOUND })
];

/**
 * Single mock policy for simple test cases
 */
export const mockPolicy: IPolicy = generateMockPolicy({
  type: PolicyType.COMMERCIAL_PROPERTY,
  status: PolicyStatus.ACTIVE
});