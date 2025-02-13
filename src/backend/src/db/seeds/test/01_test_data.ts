import { Knex } from 'knex'; // ^2.5.1
import { faker } from '@faker-js/faker'; // ^8.0.2
import { Policy } from '../../models/Policy';
import { ClaimModel } from '../../models/Claim';
import { Document } from '../../models/Document';
import { PolicyType } from '../../constants/policyTypes';
import { PolicyStatus } from '../../types/policy.types';
import { CLAIM_STATUS } from '../../constants/claimStatus';
import { encrypt } from '../../utils/encryption';
import { info } from '../../utils/logger';

/**
 * Main seed function to populate test database with comprehensive sample data
 * supporting various test scenarios and OneShield integration testing.
 */
export async function seed(knex: Knex): Promise<void> {
  try {
    info('Starting test data seeding');

    // Begin transaction for data integrity
    await knex.transaction(async (trx) => {
      // Clear existing test data
      await trx('documents').del();
      await trx('claims').del();
      await trx('policies').del();

      // Generate test data
      const policyIds = await createSamplePolicies(trx);
      const claimIds = await createSampleClaims(trx, policyIds);
      await createSampleDocuments(trx, policyIds, claimIds);

      info('Test data seeding completed successfully');
    });
  } catch (error) {
    info('Test data seeding failed', { error });
    throw error;
  }
}

/**
 * Creates comprehensive sample policy records with realistic data
 * and OneShield integration fields
 */
async function createSamplePolicies(trx: Knex): Promise<string[]> {
  const policies: Partial<Policy>[] = [];
  const policyTypes = Object.values(PolicyType);
  const createdIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const effectiveDate = faker.date.future();
    const expirationDate = new Date(effectiveDate);
    expirationDate.setFullYear(effectiveDate.getFullYear() + 1);

    const policy: Partial<Policy> = {
      id: faker.string.uuid(),
      policyNumber: `POL-${faker.string.alphanumeric(8).toUpperCase()}`,
      type: policyTypes[i % policyTypes.length],
      status: PolicyStatus.ACTIVE,
      effectiveDate,
      expirationDate,
      premium: parseFloat(faker.finance.amount(1000, 100000, 2)),
      oneShieldPolicyId: `OS-${faker.string.alphanumeric(10).toUpperCase()}`,
      coverages: generateCoverages(),
      underwritingInfo: {
        riskScore: faker.number.int({ min: 50, max: 100 }),
        underwriterNotes: faker.lorem.paragraph(),
        approvalDate: faker.date.recent(),
        approvedBy: faker.person.fullName(),
        specialConditions: [
          faker.lorem.sentence(),
          faker.lorem.sentence()
        ]
      }
    };

    policies.push(policy);
    createdIds.push(policy.id!);
  }

  await trx('policies').insert(policies);
  return createdIds;
}

/**
 * Creates detailed claim records with history and relationships
 */
async function createSampleClaims(trx: Knex, policyIds: string[]): Promise<string[]> {
  const claims: Partial<ClaimModel>[] = [];
  const createdIds: string[] = [];
  const claimStatuses = Object.values(CLAIM_STATUS);

  for (let i = 0; i < 100; i++) {
    const claimId = faker.string.uuid();
    const claim: Partial<ClaimModel> = {
      id: claimId,
      policyId: policyIds[i % policyIds.length],
      claimNumber: `CLM-${faker.string.alphanumeric(8).toUpperCase()}`,
      oneShieldClaimId: `OS-CLM-${faker.string.alphanumeric(10).toUpperCase()}`,
      status: claimStatuses[i % claimStatuses.length],
      incidentDate: faker.date.recent(),
      reportedDate: faker.date.recent(),
      description: faker.lorem.paragraph(),
      location: generateClaimLocation(),
      claimantInfo: generateClaimantInfo(),
      reserveAmount: parseFloat(faker.finance.amount(5000, 50000, 2)),
      paidAmount: parseFloat(faker.finance.amount(1000, 25000, 2)),
      statusHistory: generateClaimHistory(),
      complianceData: generateComplianceData()
    };

    claims.push(claim);
    createdIds.push(claimId);
  }

  await trx('claims').insert(claims);
  return createdIds;
}

/**
 * Creates versioned documents with security metadata and encryption
 */
async function createSampleDocuments(
  trx: Knex,
  policyIds: string[],
  claimIds: string[]
): Promise<void> {
  const documents: Partial<Document>[] = [];
  const documentTypes = ['POLICY', 'ENDORSEMENT', 'CLAIM', 'INVOICE', 'CORRESPONDENCE'];

  for (let i = 0; i < 200; i++) {
    const documentType = documentTypes[i % documentTypes.length];
    const fileName = `${documentType.toLowerCase()}_${faker.string.alphanumeric(8)}.pdf`;
    const fileSize = faker.number.int({ min: 100000, max: 5000000 });

    // Generate encryption metadata
    const { encryptedData, encryptedKey } = await encrypt(Buffer.from(fileName));

    const document: Partial<Document> = {
      id: faker.string.uuid(),
      fileName,
      fileType: 'application/pdf',
      fileSize,
      documentType,
      policyId: documentType === 'CLAIM' ? undefined : policyIds[i % policyIds.length],
      claimId: documentType === 'CLAIM' ? claimIds[i % claimIds.length] : undefined,
      uploadedBy: faker.internet.email(),
      isEncrypted: true,
      encryptionKeyId: encryptedKey.toString('base64'),
      contentHash: faker.string.alphanumeric(64),
      mimeType: 'application/pdf',
      version: 1,
      metadata: {
        classification: 'CONFIDENTIAL',
        retention: '7-YEARS',
        tags: [documentType, 'TEST_DATA'],
        customFields: {
          department: faker.commerce.department(),
          category: faker.commerce.category()
        }
      }
    };

    documents.push(document);
  }

  await trx('documents').insert(documents);
}

// Helper functions for generating realistic test data

function generateCoverages() {
  const coverages = [];
  const coverageTypes = ['Property', 'Liability', 'Workers Comp', 'Auto', 'Cyber'];

  for (let i = 0; i < faker.number.int({ min: 1, max: 4 }); i++) {
    coverages.push({
      id: faker.string.uuid(),
      type: coverageTypes[i],
      limits: {
        perOccurrence: parseFloat(faker.finance.amount(100000, 1000000, 2)),
        aggregate: parseFloat(faker.finance.amount(1000000, 5000000, 2))
      },
      deductible: parseFloat(faker.finance.amount(1000, 10000, 2)),
      endorsements: Array(faker.number.int({ min: 0, max: 3 }))
        .fill(null)
        .map(() => faker.lorem.sentence()),
      exclusions: Array(faker.number.int({ min: 0, max: 3 }))
        .fill(null)
        .map(() => faker.lorem.sentence())
    });
  }

  return coverages;
}

function generateClaimLocation() {
  return {
    address: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    zipCode: faker.location.zipCode(),
    country: 'USA',
    coordinates: {
      latitude: parseFloat(faker.location.latitude()),
      longitude: parseFloat(faker.location.longitude())
    }
  };
}

function generateClaimantInfo() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    relationship: faker.helpers.arrayElement(['Insured', 'Third Party', 'Employee', 'Contractor']),
    alternateContact: {
      name: faker.person.fullName(),
      phone: faker.phone.number(),
      relationship: faker.helpers.arrayElement(['Attorney', 'Spouse', 'Agent'])
    },
    preferredContactMethod: faker.helpers.arrayElement(['Email', 'Phone', 'Mail'])
  };
}

function generateClaimHistory() {
  const history = [];
  const statuses = Object.values(CLAIM_STATUS);
  
  for (let i = 0; i < faker.number.int({ min: 2, max: 5 }); i++) {
    history.push({
      status: statuses[i % statuses.length],
      timestamp: faker.date.recent(),
      notes: faker.lorem.sentence(),
      userId: faker.string.uuid()
    });
  }

  return history;
}

function generateComplianceData() {
  return {
    regulatoryReporting: {
      stateFilings: faker.helpers.arrayElement(['Required', 'Completed', 'Not Required']),
      reportingDeadline: faker.date.future(),
      lastReportedDate: faker.date.recent()
    },
    complianceChecks: Array(faker.number.int({ min: 1, max: 4 }))
      .fill(null)
      .map(() => ({
        type: faker.helpers.arrayElement(['Sanctions', 'Fraud', 'Regulatory', 'Privacy']),
        timestamp: faker.date.recent(),
        result: faker.datatype.boolean(),
        details: faker.lorem.sentence()
      }))
  };
}