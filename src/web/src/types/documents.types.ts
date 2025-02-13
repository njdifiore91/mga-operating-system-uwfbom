/**
 * TypeScript types and interfaces for document management in the MGA Operating System.
 * Defines document metadata, upload states, and API responses for document-related operations.
 * @version 1.0.0
 */

import { ID, ApiResponse, PaginationParams } from './common.types';

/**
 * Enumeration of document types supported in the system
 */
export enum DocumentType {
  POLICY = 'POLICY',
  CLAIM = 'CLAIM',
  ENDORSEMENT = 'ENDORSEMENT',
  COMPLIANCE = 'COMPLIANCE'
}

/**
 * Enumeration of possible document statuses throughout its lifecycle
 */
export enum DocumentStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  DELETED = 'DELETED'
}

/**
 * Interface defining document metadata and properties
 */
export interface IDocument {
  id: ID;
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: DocumentType;
  status: DocumentStatus;
  policyId: ID | null;
  claimId: ID | null;
  uploadedAt: string;
  uploadedBy: string;
  isEncrypted: boolean;
  securityClassification: string;
  retentionPeriod: number;
  digitalSignature: string | null;
}

/**
 * Interface for tracking document upload progress and state
 */
export interface DocumentUploadState {
  progress: number;
  status: DocumentStatus;
  error: string | null;
  encryptionStatus: boolean;
  validationErrors: string[];
}

/**
 * Interface for paginated document list responses
 * Extends ApiResponse with document-specific data
 */
export interface DocumentsResponse {
  documents: IDocument[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Interface defining parameters for document upload requests
 */
export interface DocumentUploadParams {
  file: File;
  documentType: DocumentType;
  policyId: ID | null;
  claimId: ID | null;
  description: string | null;
  securityClassification: string;
  retentionPeriod: number;
  requireEncryption: boolean;
}