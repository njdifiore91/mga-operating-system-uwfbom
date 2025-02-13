/**
 * @fileoverview Zod schema validators for compliance-related API endpoints
 * Ensures data integrity and type safety for compliance checks, reports, and audits
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.21.4
import { 
  ComplianceStatus, 
  ComplianceCheckType 
} from '../../types/compliance.types';

/**
 * Custom validator for jurisdiction format
 * Validates US state and territory codes
 */
const validateJurisdictionFormat = (jurisdiction: string): boolean => {
  const statePattern = /^[A-Z]{2}$/;
  const territoryPattern = /^[A-Z]{2}-[A-Z]{2}$/;
  return statePattern.test(jurisdiction) || territoryPattern.test(jurisdiction);
};

/**
 * Custom validator for file metadata
 * Enforces security and size constraints
 */
const validateFileUpload = (fileMetadata: object): boolean => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['application/pdf', 'application/json', 'text/csv'];
  
  return (
    fileMetadata.size <= MAX_FILE_SIZE &&
    ALLOWED_TYPES.includes(fileMetadata.type)
  );
};

/**
 * Schema for findings within compliance checks
 */
const findingsSchema = z.object({
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
  evidenceUrls: z.array(z.string().url()),
  notes: z.string().optional()
});

/**
 * Schema for compliance check validation
 */
export const complianceCheckSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(ComplianceCheckType),
  status: z.nativeEnum(ComplianceStatus),
  policyId: z.string().uuid(),
  jurisdiction: z.string().refine(validateJurisdictionFormat, {
    message: 'Invalid jurisdiction format. Must be state code (e.g., CA) or territory code (e.g., PR-US)'
  }),
  dueDate: z.string().datetime(),
  completedDate: z.string().datetime().nullable(),
  findings: findingsSchema,
  assignedTo: z.string().email(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  remediationPlan: z.object({
    steps: z.array(z.string()),
    deadline: z.string().datetime(),
    assignedTo: z.string().email(),
    status: z.nativeEnum(ComplianceStatus),
    progress: z.number().min(0).max(100),
    notes: z.string().optional()
  }).nullable()
});

/**
 * Schema for compliance report validation
 */
export const complianceReportSchema = z.object({
  id: z.string().uuid(),
  checkId: z.string().uuid(),
  reportingPeriod: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }),
  submissionDate: z.string().datetime(),
  data: z.object({
    metrics: z.record(z.string(), z.number()),
    violations: z.array(z.string()),
    complianceRate: z.number().min(0).max(100),
    riskScore: z.number().min(0).max(10),
    comments: z.string().optional()
  }),
  attachments: z.array(z.object({
    id: z.string().uuid(),
    fileName: z.string(),
    fileType: z.string(),
    uploadDate: z.string().datetime(),
    fileSize: z.number(),
    url: z.string().url()
  })).refine((files) => files.every(validateFileUpload), {
    message: 'One or more files exceed size limit or have invalid type'
  }),
  submittedBy: z.string().email(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'REQUIRES_REVISION'])
});

/**
 * Schema for compliance audit validation
 */
export const complianceAuditSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime({ precision: 3 }), // millisecond precision
  userId: z.string().uuid(),
  action: z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'REVIEW',
    'APPROVE',
    'REJECT',
    'REMEDIATE'
  ]),
  details: z.object({
    component: z.string(),
    description: z.string(),
    metadata: z.record(z.string(), z.unknown())
  }),
  ipAddress: z.string().ip(),
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.unknown(),
    newValue: z.unknown(),
    reason: z.string()
  }))
});