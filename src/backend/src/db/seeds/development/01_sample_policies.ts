import { Knex } from 'knex'; // v2.5.1
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
    IAddress,
    IContact,
    IPolicyHolder,
    IClaimHistory,
    ICarrierInfo,
    IBillingInfo,
    ICoverage,
    IUnderwritingInfo,
    IEndorsement,
    IDocument
} from '../../types/policy.types';
import { PolicyType } from '../../constants/policyTypes';

/**
 * Generates a random date between start and end dates
 */
const randomDate = (start: Date, end: Date): Date => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

/**
 * Generates a random policy number with correct format
 */
const generatePolicyNumber = (index: number): string => {
    return `POL-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`;
};

/**
 * Generates sample address data
 */
const generateAddress = (): IAddress => ({
    street1: faker.location.streetAddress(),
    street2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.3 }),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode(),
    country: 'USA'
});

/**
 * Generates sample contact information
 */
const generateContact = (): IContact => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    alternatePhone: faker.helpers.maybe(() => faker.phone.number(), { probability: 0.4 })
});

/**
 * Generates sample policyholder data
 */
const generatePolicyHolder = (id: string): IPolicyHolder => ({
    id,
    type: faker.helpers.arrayElement(Object.values(PolicyHolderType)),
    legalName: faker.company.name(),
    taxId: faker.finance.accountNumber(9),
    address: generateAddress(),
    contact: generateContact(),
    verificationStatus: faker.helpers.arrayElement(Object.values(VerificationStatus))
});

/**
 * Generates sample claim history
 */
const generateClaimHistory = (policyId: string): IClaimHistory[] => {
    const claimCount = faker.number.int({ min: 0, max: 3 });
    return Array.from({ length: claimCount }, (_, index) => ({
        id: faker.string.uuid(),
        policyId,
        claimNumber: `CLM-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
        incidentDate: randomDate(new Date(2020, 0, 1), new Date()),
        status: faker.helpers.arrayElement(Object.values(ClaimStatus)),
        amount: faker.number.float({ min: 1000, max: 100000, precision: 2 }),
        description: faker.lorem.sentence()
    }));
};

/**
 * Generates sample carrier integration information
 */
const generateCarrierInfo = (): ICarrierInfo => ({
    carrierId: faker.string.alphanumeric(10).toUpperCase(),
    carrierPolicyNumber: faker.string.alphanumeric(12).toUpperCase(),
    oneshieldId: `OS-${faker.string.alphanumeric(8).toUpperCase()}`,
    syncStatus: faker.helpers.arrayElement(Object.values(SyncStatus)),
    lastSyncDate: randomDate(new Date(2023, 0, 1), new Date())
});

/**
 * Generates sample billing information
 */
const generateBillingInfo = (): IBillingInfo => ({
    paymentMethod: faker.helpers.arrayElement(Object.values(PaymentMethod)),
    billingSchedule: faker.helpers.arrayElement(Object.values(BillingSchedule)),
    invoiceDelivery: faker.helpers.arrayElement(Object.values(DeliveryMethod)),
    paymentStatus: faker.helpers.arrayElement(Object.values(PaymentStatus))
});

/**
 * Generates sample coverage information
 */
const generateCoverages = (policyType: PolicyType): ICoverage[] => {
    const coverageCount = faker.number.int({ min: 1, max: 3 });
    return Array.from({ length: coverageCount }, () => ({
        id: faker.string.uuid(),
        type: policyType,
        limits: {
            perOccurrence: faker.number.int({ min: 100000, max: 5000000 }),
            aggregate: faker.number.int({ min: 1000000, max: 10000000 })
        },
        deductible: faker.number.int({ min: 1000, max: 50000 }),
        endorsements: faker.helpers.maybe(() => [faker.string.uuid()], { probability: 0.4 }),
        exclusions: faker.helpers.maybe(() => [faker.lorem.sentence()], { probability: 0.3 })
    }));
};

/**
 * Generates sample underwriting information
 */
const generateUnderwritingInfo = (): IUnderwritingInfo => ({
    riskScore: faker.number.int({ min: 1, max: 100 }),
    underwriterNotes: faker.lorem.paragraph(),
    approvalDate: faker.helpers.maybe(() => randomDate(new Date(2023, 0, 1), new Date())),
    approvedBy: faker.helpers.maybe(() => `${faker.person.firstName()} ${faker.person.lastName()}`),
    specialConditions: faker.helpers.maybe(() => [faker.lorem.sentence()], { probability: 0.3 })
});

/**
 * Generates sample endorsements
 */
const generateEndorsements = (effectiveDate: Date): IEndorsement[] => {
    const endorsementCount = faker.number.int({ min: 0, max: 2 });
    return Array.from({ length: endorsementCount }, () => ({
        id: faker.string.uuid(),
        type: faker.helpers.arrayElement(['Additional Insured', 'Waiver of Subrogation', 'Primary and Non-Contributory']),
        effectiveDate: randomDate(effectiveDate, new Date()),
        description: faker.lorem.sentence(),
        premium: faker.number.float({ min: 100, max: 5000, precision: 2 }),
        status: faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'CANCELLED'])
    }));
};

/**
 * Generates sample documents
 */
const generateDocuments = (): IDocument[] => {
    const documentCount = faker.number.int({ min: 1, max: 5 });
    return Array.from({ length: documentCount }, () => ({
        id: faker.string.uuid(),
        type: faker.helpers.arrayElement(['Policy', 'Endorsement', 'Invoice', 'Certificate']),
        fileName: `${faker.system.fileName()}.pdf`,
        fileUrl: faker.internet.url(),
        uploadDate: randomDate(new Date(2023, 0, 1), new Date()),
        metadata: {
            size: faker.number.int({ min: 100000, max: 5000000 }),
            uploadedBy: `${faker.person.firstName()} ${faker.person.lastName()}`
        }
    }));
};

/**
 * Generates an array of sample policies
 */
const generateSamplePolicies = (): IPolicy[] => {
    return Array.from({ length: 50 }, (_, index) => {
        const id = faker.string.uuid();
        const effectiveDate = randomDate(new Date(2022, 0, 1), new Date(2023, 11, 31));
        const expirationDate = new Date(effectiveDate);
        expirationDate.setFullYear(effectiveDate.getFullYear() + 1);

        return {
            id,
            policyNumber: generatePolicyNumber(index),
            type: faker.helpers.arrayElement([
                PolicyType.COMMERCIAL_PROPERTY,
                PolicyType.GENERAL_LIABILITY,
                PolicyType.PROFESSIONAL_LIABILITY,
                PolicyType.WORKERS_COMPENSATION
            ]),
            status: faker.helpers.arrayElement(Object.values(PolicyStatus)),
            effectiveDate,
            expirationDate,
            premium: faker.number.float({ min: 5000, max: 100000, precision: 2 }),
            coverages: generateCoverages(PolicyType.COMMERCIAL_PROPERTY),
            underwritingInfo: generateUnderwritingInfo(),
            endorsements: generateEndorsements(effectiveDate),
            documents: generateDocuments(),
            policyHolder: generatePolicyHolder(faker.string.uuid()),
            claimHistory: generateClaimHistory(id),
            carrierInfo: generateCarrierInfo(),
            billingInfo: generateBillingInfo(),
            createdAt: randomDate(new Date(2022, 0, 1), new Date()),
            updatedAt: new Date()
        };
    });
};

/**
 * Seeds the database with sample policy data
 */
export async function seed(knex: Knex): Promise<void> {
    // Clear existing data
    await knex('policies').del();
    await knex('policyholders').del();
    await knex('claims').del();
    await knex('endorsements').del();
    await knex('documents').del();

    const policies = generateSamplePolicies();

    // Insert data maintaining referential integrity
    for (const policy of policies) {
        // Insert policyholder
        await knex('policyholders').insert(policy.policyHolder);

        // Insert policy
        await knex('policies').insert({
            id: policy.id,
            policy_number: policy.policyNumber,
            type: policy.type,
            status: policy.status,
            effective_date: policy.effectiveDate,
            expiration_date: policy.expirationDate,
            premium: policy.premium,
            coverages: JSON.stringify(policy.coverages),
            underwriting_info: JSON.stringify(policy.underwritingInfo),
            carrier_info: JSON.stringify(policy.carrierInfo),
            billing_info: JSON.stringify(policy.billingInfo),
            policyholder_id: policy.policyHolder.id,
            created_at: policy.createdAt,
            updated_at: policy.updatedAt
        });

        // Insert claims
        if (policy.claimHistory.length > 0) {
            await knex('claims').insert(policy.claimHistory);
        }

        // Insert endorsements
        if (policy.endorsements.length > 0) {
            await knex('endorsements').insert(policy.endorsements.map(e => ({
                ...e,
                policy_id: policy.id
            })));
        }

        // Insert documents
        if (policy.documents.length > 0) {
            await knex('documents').insert(policy.documents.map(d => ({
                ...d,
                policy_id: policy.id
            })));
        }
    }
}