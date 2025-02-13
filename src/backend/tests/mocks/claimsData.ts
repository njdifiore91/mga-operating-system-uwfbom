/**
 * @fileoverview Provides comprehensive mock claim data for testing the claims management functionality
 * in the MGA OS platform. Includes sample claims in various states with realistic test data that matches
 * the Claim interface structure.
 * 
 * @version 1.0.0
 */

import { CLAIM_STATUS } from '../../src/constants/claimStatus';
import { Claim, ClaimLocation, ClaimantInfo, ClaimDocument } from '../../src/types/claims.types';

/**
 * Sample claim location data for testing location-based scenarios
 */
export const sampleClaimLocation: ClaimLocation = {
  address: '123 Insurance Ave',
  address2: 'Suite 400',
  city: 'Hartford',
  state: 'CT',
  zipCode: '06103',
  country: 'USA',
  coordinates: {
    latitude: 41.7658,
    longitude: -72.6734
  }
};

/**
 * Sample claimant information for testing contact scenarios
 */
export const sampleClaimantInfo: ClaimantInfo = {
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@email.com',
  phone: '555-123-4567',
  relationship: 'Primary Insured',
  alternateContact: {
    name: 'Jane Smith',
    phone: '555-987-6543',
    relationship: 'Spouse'
  },
  preferredContactMethod: 'email'
};

/**
 * Sample claim document for testing document processing
 */
export const sampleClaimDocument: ClaimDocument = {
  id: 'doc123',
  type: 'FNOL_REPORT',
  fileName: 'claim_report.pdf',
  fileSize: 1024576,
  mimeType: 'application/pdf',
  uploadedAt: new Date('2023-01-15T10:30:00Z'),
  uploadedBy: 'adjuster123',
  url: 'https://storage.mgaos.com/claims/doc123.pdf',
  metadata: {
    pageCount: 3,
    documentType: 'First Notice of Loss',
    securityLevel: 'confidential'
  }
};

/**
 * Comprehensive array of mock claims covering various scenarios and states
 */
const mockClaims: Claim[] = [
  {
    id: 'claim123',
    policyId: 'pol456',
    claimNumber: 'CLM-2023-001',
    status: CLAIM_STATUS.NEW,
    incidentDate: new Date('2023-01-10T08:00:00Z'),
    reportedDate: new Date('2023-01-11T14:30:00Z'),
    description: 'Water damage from burst pipe in master bathroom',
    location: sampleClaimLocation,
    claimantInfo: sampleClaimantInfo,
    reserveAmount: 25000.00,
    paidAmount: 0,
    documents: [sampleClaimDocument],
    adjusterId: 'adj789',
    statusHistory: [
      {
        status: CLAIM_STATUS.NEW,
        timestamp: new Date('2023-01-11T14:30:00Z'),
        notes: 'Claim created and assigned to adjuster',
        userId: 'system'
      }
    ],
    createdAt: new Date('2023-01-11T14:30:00Z'),
    updatedAt: new Date('2023-01-11T14:30:00Z')
  },
  {
    id: 'claim124',
    policyId: 'pol457',
    claimNumber: 'CLM-2023-002',
    status: CLAIM_STATUS.UNDER_REVIEW,
    incidentDate: new Date('2023-01-05T15:20:00Z'),
    reportedDate: new Date('2023-01-06T09:00:00Z'),
    description: 'Storm damage to roof and exterior',
    location: {
      ...sampleClaimLocation,
      address: '456 Storm Lane'
    },
    claimantInfo: {
      ...sampleClaimantInfo,
      firstName: 'Robert',
      lastName: 'Johnson'
    },
    reserveAmount: 75000.00,
    paidAmount: 0,
    documents: [
      {
        ...sampleClaimDocument,
        id: 'doc124',
        type: 'DAMAGE_PHOTOS'
      }
    ],
    adjusterId: 'adj790',
    statusHistory: [
      {
        status: CLAIM_STATUS.NEW,
        timestamp: new Date('2023-01-06T09:00:00Z'),
        notes: 'Initial claim filing',
        userId: 'system'
      },
      {
        status: CLAIM_STATUS.UNDER_REVIEW,
        timestamp: new Date('2023-01-07T10:15:00Z'),
        notes: 'Assigned to senior adjuster for review',
        userId: 'adj790'
      }
    ],
    createdAt: new Date('2023-01-06T09:00:00Z'),
    updatedAt: new Date('2023-01-07T10:15:00Z')
  }
];

/**
 * Specialized mock claims for carrier integration testing
 */
export const carrierIntegrationClaims: Claim[] = [
  {
    ...mockClaims[0],
    id: 'carrier_test_1',
    claimNumber: 'OS-CLM-2023-001',
    status: CLAIM_STATUS.APPROVED,
    reserveAmount: 50000.00,
    paidAmount: 45000.00
  }
];

/**
 * Utility function to generate bulk claims for performance testing
 * @param count Number of claims to generate
 * @returns Array of mock claims
 */
export const generateBulkClaims = (count: number): Claim[] => {
  return Array.from({ length: count }, (_, index) => ({
    ...mockClaims[0],
    id: `bulk_claim_${index}`,
    claimNumber: `CLM-2023-BULK-${index.toString().padStart(6, '0')}`,
    status: Object.values(CLAIM_STATUS)[index % Object.values(CLAIM_STATUS).length],
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
  }));
};

export default mockClaims;