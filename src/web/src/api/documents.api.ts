/**
 * Document Management API Client Module
 * Handles secure document operations with encryption, progress tracking, and validation
 * @version 1.0.0
 */

import axios, { AxiosProgressEvent } from 'axios';
import { apiClient } from '../config/api.config';
import {
  IDocument,
  DocumentType,
  DocumentStatus,
  DocumentUploadParams,
  DocumentsResponse,
  DocumentUploadState
} from '../types/documents.types';
import { API_ENDPOINTS } from '../constants/api.constants';

// Constants for document handling
const DOCUMENTS_API_PATH = API_ENDPOINTS.DOCUMENTS.BASE;
const UPLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_RETRIES = 3;
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * Validates document upload parameters and file content
 * @param file File to be uploaded
 * @param params Upload parameters
 * @returns Promise resolving to validation result
 */
const validateDocumentUpload = async (
  file: File,
  params: DocumentUploadParams
): Promise<{ isValid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push(`File type ${file.type} is not supported`);
  }

  // Validate file size (max 100MB)
  if (file.size > 100 * 1024 * 1024) {
    errors.push('File size exceeds 100MB limit');
  }

  // Validate required parameters
  if (!params.documentType) {
    errors.push('Document type is required');
  }

  // Validate security classification
  if (!params.securityClassification) {
    errors.push('Security classification is required');
  }

  // Validate retention period
  if (params.retentionPeriod < 1) {
    errors.push('Invalid retention period');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Uploads a document with encryption and progress tracking
 * @param params Upload parameters including file and metadata
 * @param onProgress Progress callback function
 * @param signal AbortSignal for cancellation
 * @returns Promise resolving to uploaded document metadata
 */
const uploadDocument = async (
  params: DocumentUploadParams,
  onProgress?: (state: DocumentUploadState) => void,
  signal?: AbortSignal
): Promise<IDocument> => {
  // Validate upload parameters
  const validation = await validateDocumentUpload(params.file, params);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Create form data with metadata
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('documentType', params.documentType);
  formData.append('securityClassification', params.securityClassification);
  formData.append('retentionPeriod', params.retentionPeriod.toString());
  formData.append('requireEncryption', params.requireEncryption.toString());

  if (params.policyId) formData.append('policyId', params.policyId);
  if (params.claimId) formData.append('claimId', params.claimId);
  if (params.description) formData.append('description', params.description);

  try {
    const response = await apiClient.post<IDocument>(
      `${DOCUMENTS_API_PATH}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        signal,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress({
              progress: Math.round((progressEvent.loaded * 100) / progressEvent.total),
              status: DocumentStatus.UPLOADING,
              error: null,
              encryptionStatus: params.requireEncryption,
              validationErrors: []
            });
          }
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Document upload failed: ${error.message}`);
  }
};

/**
 * Downloads a document with optional decryption
 * @param documentId ID of document to download
 * @param onProgress Progress callback function
 * @returns Promise resolving to document blob
 */
const downloadDocument = async (
  documentId: string,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  try {
    const response = await apiClient.get(
      `${DOCUMENTS_API_PATH}/${documentId}/download`,
      {
        responseType: 'blob',
        onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Document download failed: ${error.message}`);
  }
};

/**
 * Retrieves a list of documents with pagination
 * @param page Page number
 * @param limit Items per page
 * @param filters Optional filter parameters
 * @returns Promise resolving to paginated document list
 */
const getDocuments = async (
  page: number = 1,
  limit: number = 10,
  filters?: {
    documentType?: DocumentType;
    policyId?: string;
    claimId?: string;
  }
): Promise<DocumentsResponse> => {
  try {
    const response = await apiClient.get<DocumentsResponse>(DOCUMENTS_API_PATH, {
      params: {
        page,
        limit,
        ...filters
      }
    });

    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
};

/**
 * Retrieves document metadata by ID
 * @param documentId Document ID
 * @returns Promise resolving to document metadata
 */
const getDocumentById = async (documentId: string): Promise<IDocument> => {
  try {
    const response = await apiClient.get<IDocument>(
      `${DOCUMENTS_API_PATH}/${documentId}`
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch document: ${error.message}`);
  }
};

/**
 * Deletes a document by ID
 * @param documentId Document ID
 * @returns Promise resolving to success status
 */
const deleteDocument = async (documentId: string): Promise<void> => {
  try {
    await apiClient.delete(`${DOCUMENTS_API_PATH}/${documentId}`);
  } catch (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};

// Export document management API functions
export const documentsApi = {
  uploadDocument,
  downloadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  validateDocumentUpload
};