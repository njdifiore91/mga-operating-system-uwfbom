import { rest } from 'msw';
import { 
  IPolicy, 
  PolicyType, 
  PolicyStatus 
} from '../../src/types/policy.types';
import { 
  Claim 
} from '../../src/types/claims.types';
import { 
  IRiskAssessmentDisplay, 
  UnderwritingStatus,
  RiskSeverity 
} from '../../src/types/underwriting.types';
import type { 
  ApiResponse 
} from '../../src/types/common.types';

// Mock data generators
const generateMockPolicy = (id: string): IPolicy => ({
  id,
  policyNumber: `POL-${id.slice(0, 8)}`,
  type: PolicyType.COMMERCIAL_PROPERTY,
  status: PolicyStatus.ACTIVE,
  effectiveDate: new Date().toISOString(),
  expirationDate: new Date(Date.now() + 31536000000).toISOString(), // 1 year
  premium: 50000,
  coverages: [],
  underwritingInfo: {
    riskScore: 85,
    underwriterNotes: '',
    approvalStatus: 'APPROVED',
    reviewedBy: 'John Smith',
    reviewDate: new Date().toISOString()
  },
  endorsements: [],
  documents: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const generateMockClaim = (id: string): Claim => ({
  id,
  policyId: `POL-${id.slice(0, 8)}`,
  claimNumber: `CLM-${id.slice(0, 8)}`,
  status: 'NEW',
  incidentDate: new Date(),
  reportedDate: new Date(),
  description: 'Mock claim description',
  location: {
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '90210',
    country: 'USA'
  },
  claimantInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-0123',
    relationship: 'Insured'
  },
  reserveAmount: 10000,
  paidAmount: 0,
  documents: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActivityDate: new Date(),
  totalIncurred: 10000,
  isReopened: false
});

const generateMockRiskAssessment = (policyId: string): IRiskAssessmentDisplay => ({
  policyId,
  riskScore: 85,
  severity: RiskSeverity.LOW,
  factors: [
    {
      type: 'LOCATION',
      score: 85,
      severity: RiskSeverity.LOW,
      details: {
        description: 'Location risk assessment',
        impact: 'Low risk area',
        recommendation: 'Standard terms',
        dataSource: 'GeoRisk API',
        lastUpdated: new Date()
      }
    }
  ],
  assessmentDate: new Date(),
  assessedBy: 'AutoUW System'
});

// Policy Handlers
export const policyHandlers = [
  // GET /api/policies - List policies with pagination
  rest.get('/api/policies', async (_, res, ctx) => {
    const page = Number(_.url.searchParams.get('page')) || 1;
    const limit = Number(_.url.searchParams.get('limit')) || 10;
    
    const mockPolicies = Array(limit).fill(null).map((_, i) => 
      generateMockPolicy(`${page}-${i}`)
    );

    const response: ApiResponse<{ items: IPolicy[], total: number }> = {
      success: true,
      data: {
        items: mockPolicies,
        total: 100
      },
      error: null
    };

    return res(
      ctx.delay(100),
      ctx.status(200),
      ctx.json(response)
    );
  }),

  // GET /api/policies/:id - Get single policy
  rest.get('/api/policies/:id', async (req, res, ctx) => {
    const { id } = req.params;
    
    const response: ApiResponse<IPolicy> = {
      success: true,
      data: generateMockPolicy(id as string),
      error: null
    };

    return res(
      ctx.delay(50),
      ctx.status(200),
      ctx.json(response)
    );
  }),

  // POST /api/policies - Create policy
  rest.post('/api/policies', async (_, res, ctx) => {
    // Simulate OneShield integration delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const response: ApiResponse<IPolicy> = {
      success: true,
      data: generateMockPolicy(Math.random().toString(36).substring(7)),
      error: null
    };

    return res(
      ctx.status(201),
      ctx.json(response)
    );
  })
];

// Claims Handlers
export const claimHandlers = [
  // GET /api/claims - List claims
  rest.get('/api/claims', async (_, res, ctx) => {
    const mockClaims = Array(10).fill(null).map((_, i) => 
      generateMockClaim(i.toString())
    );

    const response: ApiResponse<Claim[]> = {
      success: true,
      data: mockClaims,
      error: null
    };

    return res(
      ctx.delay(150),
      ctx.status(200),
      ctx.json(response)
    );
  }),

  // POST /api/claims - Create claim
  rest.post('/api/claims', async (_, res, ctx) => {
    const response: ApiResponse<Claim> = {
      success: true,
      data: generateMockClaim(Math.random().toString(36).substring(7)),
      error: null
    };

    return res(
      ctx.delay(200),
      ctx.status(201),
      ctx.json(response)
    );
  })
];

// Underwriting Handlers
export const underwritingHandlers = [
  // GET /api/underwriting/risk-assessment/:policyId
  rest.get('/api/underwriting/risk-assessment/:policyId', async (req, res, ctx) => {
    const { policyId } = req.params;
    
    const response: ApiResponse<IRiskAssessmentDisplay> = {
      success: true,
      data: generateMockRiskAssessment(policyId as string),
      error: null
    };

    return res(
      ctx.delay(300), // Simulate ML model processing time
      ctx.status(200),
      ctx.json(response)
    );
  }),

  // POST /api/underwriting/submit
  rest.post('/api/underwriting/submit', async (_, res, ctx) => {
    const response: ApiResponse<{ status: UnderwritingStatus }> = {
      success: true,
      data: {
        status: UnderwritingStatus.IN_REVIEW
      },
      error: null
    };

    return res(
      ctx.delay(500), // Simulate third-party integration delay
      ctx.status(200),
      ctx.json(response)
    );
  })
];

// Combine all handlers
export const handlers = [
  ...policyHandlers,
  ...claimHandlers,
  ...underwritingHandlers
];

export default handlers;