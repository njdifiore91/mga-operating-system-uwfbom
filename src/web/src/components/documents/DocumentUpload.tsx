/**
 * DocumentUpload Component
 * Enterprise-grade document upload component with encryption, validation, and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  IconButton,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { FileUpload } from '../common/FileUpload';
import { DocumentService } from '../../services/documents.service';
import { SecurityService } from '@mga/security';
import {
  DocumentType,
  DocumentStatus,
  DocumentUploadState,
  DocumentUploadParams
} from '../../types/documents.types';

// Constants for document upload configuration
const ACCEPTED_FILE_TYPES = ['.pdf', '.docx', '.jpg', '.png', '.tiff'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';
const RETRY_ATTEMPTS = 3;

interface DocumentUploadProps {
  documentType: DocumentType;
  policyId?: string;
  claimId?: string;
  onUploadComplete?: (documentId: string) => void;
  securityLevel: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentType,
  policyId,
  claimId,
  onUploadComplete,
  securityLevel
}) => {
  // State management
  const [uploadState, setUploadState] = useState<DocumentUploadState>({
    progress: 0,
    status: DocumentStatus.PENDING,
    error: null,
    encryptionStatus: true,
    validationErrors: []
  });
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Refs
  const uploadController = useRef<AbortController | null>(null);
  const documentService = useRef(new DocumentService());
  const retryCount = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadController.current) {
        uploadController.current.abort();
      }
    };
  }, []);

  /**
   * Handles secure document upload with encryption and progress tracking
   */
  const handleUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const file = files[0];
    setSelectedFile(file);
    retryCount.current = 0;

    try {
      // Initialize upload state
      setUploadState(prev => ({
        ...prev,
        status: DocumentStatus.PENDING,
        progress: 0,
        error: null
      }));

      // Generate encryption key and encrypt file
      setIsEncrypting(true);
      const encryptionKey = await SecurityService.generateEncryptionKey();
      const encryptedFile = await SecurityService.encryptFile(
        file,
        encryptionKey,
        ENCRYPTION_ALGORITHM
      );
      setIsEncrypting(false);

      // Prepare upload parameters
      const uploadParams: DocumentUploadParams = {
        file: encryptedFile,
        documentType,
        policyId: policyId || null,
        claimId: claimId || null,
        description: file.name,
        securityClassification: securityLevel,
        retentionPeriod: 7, // 7 years default retention
        requireEncryption: true
      };

      // Create abort controller for upload
      uploadController.current = new AbortController();

      // Upload document with progress tracking
      const document = await documentService.current.uploadDocumentWithProgress(
        uploadParams,
        (state) => {
          setUploadState(prev => ({
            ...prev,
            progress: state.progress,
            status: state.status
          }));
        },
        securityLevel
      );

      // Handle successful upload
      setUploadState(prev => ({
        ...prev,
        status: DocumentStatus.COMPLETED,
        progress: 100
      }));

      onUploadComplete?.(document.id);
      setSelectedFile(null);

    } catch (error) {
      handleError(error as Error);
    } finally {
      setIsEncrypting(false);
    }
  }, [documentType, policyId, claimId, securityLevel, onUploadComplete]);

  /**
   * Handles upload errors with retry capability
   */
  const handleError = useCallback((error: Error) => {
    if (retryCount.current < RETRY_ATTEMPTS) {
      retryCount.current++;
      setUploadState(prev => ({
        ...prev,
        status: DocumentStatus.PENDING,
        error: `Upload failed, retrying (${retryCount.current}/${RETRY_ATTEMPTS})...`
      }));
      if (selectedFile) {
        setTimeout(() => handleUpload([selectedFile]), 1000 * retryCount.current);
      }
    } else {
      setUploadState(prev => ({
        ...prev,
        status: DocumentStatus.ERROR,
        error: `Upload failed: ${error.message}`
      }));
    }
  }, [handleUpload]);

  /**
   * Cancels ongoing upload
   */
  const handleCancel = useCallback(() => {
    if (uploadController.current) {
      uploadController.current.abort();
      setUploadState(prev => ({
        ...prev,
        status: DocumentStatus.PENDING,
        progress: 0,
        error: null
      }));
      setSelectedFile(null);
    }
  }, []);

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" component="div">
            Document Upload
            <Tooltip title="Documents are encrypted using AES-256-GCM">
              <LockIcon sx={{ ml: 1, fontSize: 20, color: 'primary.main' }} />
            </Tooltip>
          </Typography>
          <Typography color="textSecondary" variant="body2">
            Security Level: {securityLevel}
          </Typography>
        </Box>

        <FileUpload
          acceptedTypes={ACCEPTED_FILE_TYPES}
          maxSize={MAX_FILE_SIZE}
          onUpload={handleUpload}
          multiple={false}
          label="Drop document here or click to upload"
          ariaLabel="Document upload area"
        />

        {(uploadState.status !== DocumentStatus.PENDING || isEncrypting) && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {isEncrypting ? 'Encrypting...' : `Uploading: ${uploadState.progress}%`}
              </Typography>
              {uploadState.status === DocumentStatus.PROCESSING && (
                <IconButton
                  size="small"
                  onClick={handleCancel}
                  aria-label="Cancel upload"
                >
                  <CancelIcon />
                </IconButton>
              )}
            </Box>
            <LinearProgress
              variant="determinate"
              value={uploadState.progress}
              sx={{ mb: 1 }}
            />
          </Box>
        )}

        {uploadState.error && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              retryCount.current < RETRY_ATTEMPTS && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => selectedFile && handleUpload([selectedFile])}
                >
                  Retry
                </Button>
              )
            }
          >
            {uploadState.error}
          </Alert>
        )}

        {uploadState.status === DocumentStatus.COMPLETED && (
          <Alert
            icon={<CheckCircleIcon />}
            severity="success"
            sx={{ mt: 2 }}
          >
            Document uploaded successfully
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;