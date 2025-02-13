/**
 * @fileoverview Type definitions for the MGA Operating System compliance module
 * Supports regulatory compliance, reporting, and audit functionality
 * @version 1.0.0
 */

/**
 * Enum defining all possible compliance status values
 * Supports tracking of compliance states including exemptions and remediation
 */
export enum ComplianceStatus {
    COMPLIANT = 'COMPLIANT',
    NON_COMPLIANT = 'NON_COMPLIANT',
    PENDING_REVIEW = 'PENDING_REVIEW',
    EXEMPTED = 'EXEMPTED',
    IN_REMEDIATION = 'IN_REMEDIATION'
}

/**
 * Enum defining comprehensive types of compliance checks
 * Covers regulatory, financial, and operational compliance aspects
 */
export enum ComplianceCheckType {
    REGULATORY_FILING = 'REGULATORY_FILING',
    STATE_REPORTING = 'STATE_REPORTING',
    NAIC_REPORTING = 'NAIC_REPORTING',
    AUDIT_REQUIREMENT = 'AUDIT_REQUIREMENT',
    FINANCIAL_COMPLIANCE = 'FINANCIAL_COMPLIANCE',
    OPERATIONAL_COMPLIANCE = 'OPERATIONAL_COMPLIANCE'
}

/**
 * Enum for compliance check priority levels
 */
export enum CompliancePriority {
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

/**
 * Enum for compliance report status
 */
export enum ReportStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    REQUIRES_REVISION = 'REQUIRES_REVISION'
}

/**
 * Enum for compliance audit actions
 */
export enum ComplianceAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    REVIEW = 'REVIEW',
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
    REMEDIATE = 'REMEDIATE'
}

/**
 * Interface for compliance findings
 */
export interface IComplianceFindings {
    issues: string[];
    recommendations: string[];
    evidenceUrls: string[];
    notes: string;
}

/**
 * Interface for remediation plan
 */
export interface IRemediationPlan {
    steps: string[];
    deadline: Date;
    assignedTo: string;
    status: ComplianceStatus;
    progress: number;
    notes: string;
}

/**
 * Interface for report data structure
 */
export interface IReportData {
    metrics: Record<string, number>;
    violations: string[];
    complianceRate: number;
    riskScore: number;
    comments: string;
}

/**
 * Interface for document attachments
 */
export interface IAttachment {
    id: string;
    fileName: string;
    fileType: string;
    uploadDate: Date;
    fileSize: number;
    url: string;
}

/**
 * Interface for audit details
 */
export interface IAuditDetails {
    component: string;
    description: string;
    metadata: Record<string, unknown>;
}

/**
 * Interface for audit change tracking
 */
export interface IAuditChanges {
    field: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string;
}

/**
 * Interface defining the structure of compliance checks
 * Supports comprehensive tracking and remediation capabilities
 */
export interface IComplianceCheck {
    id: string;
    type: ComplianceCheckType;
    status: ComplianceStatus;
    policyId: string;
    jurisdiction: string;
    dueDate: Date;
    completedDate: Date | null;
    findings: IComplianceFindings;
    assignedTo: string;
    priority: CompliancePriority;
    remediationPlan: IRemediationPlan | null;
}

/**
 * Interface for comprehensive compliance report submission
 * Includes attachments and submission tracking
 */
export interface IComplianceReport {
    id: string;
    checkId: string;
    reportingPeriod: string;
    submissionDate: Date;
    data: IReportData;
    attachments: IAttachment[];
    submittedBy: string;
    status: ReportStatus;
}

/**
 * Interface for detailed compliance audit log entries
 * Supports comprehensive tracking of changes and actions
 */
export interface IComplianceAudit {
    id: string;
    timestamp: Date;
    userId: string;
    action: ComplianceAction;
    details: IAuditDetails;
    ipAddress: string;
    changes: IAuditChanges[];
}