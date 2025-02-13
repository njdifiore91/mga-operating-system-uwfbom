/**
 * API client functions for the MGA Operating System compliance module
 * Implements secure, type-safe API calls for regulatory compliance, reporting, and audit functionality
 * @version 1.0.0
 */

import { apiClient } from '../config/api.config';
import { ApiResponse, PaginationParams } from '../types/common.types';
import {
  ComplianceStatus,
  ComplianceCheckType,
  IComplianceCheck,
  IComplianceReport,
  IComplianceAudit,
  ComplianceAction,
  ReportStatus
} from '../../../backend/src/types/compliance.types';

// API endpoint constants
const COMPLIANCE_ENDPOINTS = {
  CHECKS: '/compliance/checks',
  REPORTS: '/compliance/reports',
  AUDIT: '/compliance/audit',
  VALIDATION: '/compliance/validate',
  REMEDIATION: '/compliance/remediate'
} as const;

/**
 * Interface for compliance check filters
 */
interface ComplianceFilters {
  status?: ComplianceStatus[];
  type?: ComplianceCheckType[];
  jurisdiction?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  policyId?: string;
}

/**
 * Interface for compliance report submission options
 */
interface ReportSubmissionOptions {
  validateOnly?: boolean;
  priority?: boolean;
  notifyStakeholders?: boolean;
}

/**
 * Interface for audit log query options
 */
interface AuditLogOptions {
  actions?: ComplianceAction[];
  component?: string;
  userId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeChanges?: boolean;
}

/**
 * Namespace containing compliance API client functions
 */
export namespace ComplianceApi {
  /**
   * Retrieves paginated compliance checks with enhanced filtering
   * @param params Pagination parameters
   * @param filters Compliance check filters
   * @param jurisdiction State/jurisdiction code
   * @returns Promise resolving to paginated compliance checks
   */
  export async function getComplianceChecks(
    params: PaginationParams,
    filters?: ComplianceFilters,
    jurisdiction?: string
  ): Promise<ApiResponse<IComplianceCheck[]>> {
    try {
      const queryParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(jurisdiction && { jurisdiction }),
        ...(filters?.status && { status: filters.status.join(',') }),
        ...(filters?.type && { type: filters.type.join(',') }),
        ...(filters?.jurisdiction && { jurisdictions: filters.jurisdiction.join(',') }),
        ...(filters?.policyId && { policyId: filters.policyId })
      });

      if (filters?.dateRange) {
        queryParams.append('startDate', filters.dateRange.start.toISOString());
        queryParams.append('endDate', filters.dateRange.end.toISOString());
      }

      const response = await apiClient.get<ApiResponse<IComplianceCheck[]>>(
        `${COMPLIANCE_ENDPOINTS.CHECKS}?${queryParams.toString()}`
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Submits a compliance report with validation and audit logging
   * @param checkId ID of the compliance check
   * @param reportData Report data to submit
   * @param options Submission options
   * @returns Promise resolving to submitted report
   */
  export async function submitComplianceReport(
    checkId: string,
    reportData: Partial<IComplianceReport>,
    options?: ReportSubmissionOptions
  ): Promise<ApiResponse<IComplianceReport>> {
    try {
      // Validate report data if requested
      if (options?.validateOnly) {
        const validationResponse = await apiClient.post(
          COMPLIANCE_ENDPOINTS.VALIDATION,
          { checkId, reportData }
        );
        if (!validationResponse.data.success) {
          throw new Error('Report validation failed');
        }
      }

      const response = await apiClient.post<ApiResponse<IComplianceReport>>(
        `${COMPLIANCE_ENDPOINTS.REPORTS}/${checkId}`,
        {
          ...reportData,
          submissionDate: new Date(),
          status: ReportStatus.SUBMITTED
        },
        {
          headers: {
            'X-Priority': options?.priority ? 'high' : 'normal',
            'X-Notify-Stakeholders': options?.notifyStakeholders ? 'true' : 'false'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves compliance audit logs with enhanced filtering and tracking
   * @param params Pagination parameters
   * @param checkId Optional compliance check ID to filter by
   * @param options Audit log query options
   * @returns Promise resolving to paginated audit logs
   */
  export async function getComplianceAuditLogs(
    params: PaginationParams,
    checkId?: string,
    options?: AuditLogOptions
  ): Promise<ApiResponse<IComplianceAudit[]>> {
    try {
      const queryParams = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        ...(checkId && { checkId }),
        ...(options?.actions && { actions: options.actions.join(',') }),
        ...(options?.component && { component: options.component }),
        ...(options?.userId && { userId: options.userId }),
        ...(options?.includeChanges && { includeChanges: 'true' })
      });

      if (options?.dateRange) {
        queryParams.append('startDate', options.dateRange.start.toISOString());
        queryParams.append('endDate', options.dateRange.end.toISOString());
      }

      const response = await apiClient.get<ApiResponse<IComplianceAudit[]>>(
        `${COMPLIANCE_ENDPOINTS.AUDIT}?${queryParams.toString()}`
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates compliance check status with remediation tracking
   * @param checkId Compliance check ID
   * @param status New compliance status
   * @param remediationPlan Optional remediation plan
   * @returns Promise resolving to updated compliance check
   */
  export async function updateComplianceStatus(
    checkId: string,
    status: ComplianceStatus,
    remediationPlan?: IComplianceCheck['remediationPlan']
  ): Promise<ApiResponse<IComplianceCheck>> {
    try {
      const response = await apiClient.put<ApiResponse<IComplianceCheck>>(
        `${COMPLIANCE_ENDPOINTS.CHECKS}/${checkId}/status`,
        {
          status,
          ...(remediationPlan && { remediationPlan })
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initiates remediation process for non-compliant checks
   * @param checkId Compliance check ID
   * @param remediationSteps Remediation steps to implement
   * @returns Promise resolving to updated compliance check
   */
  export async function initiateRemediation(
    checkId: string,
    remediationSteps: string[]
  ): Promise<ApiResponse<IComplianceCheck>> {
    try {
      const response = await apiClient.post<ApiResponse<IComplianceCheck>>(
        `${COMPLIANCE_ENDPOINTS.REMEDIATION}/${checkId}`,
        {
          steps: remediationSteps,
          status: ComplianceStatus.IN_REMEDIATION,
          startDate: new Date()
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }
}