import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Box, 
  Button, 
  CircularProgress, 
  Typography, 
  Alert, 
  Snackbar 
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Error as ErrorIcon } from '@mui/icons-material';
import { ValidationResult } from '../../types/common.types';

// File size constants in bytes
const MB_IN_BYTES = 1024 * 1024;
const DEFAULT_MAX_SIZE = 10 * MB_IN_BYTES; // 10MB default

interface FileUploadProps {
  acceptedTypes: string[];
  maxSize?: number;
  onUpload: (files: File[]) => Promise<void>;
  onError?: (error: string) => void;
  multiple?: boolean;
  label?: string;
  ariaLabel?: string;
}

interface FileValidationProps {
  acceptedTypes: string[];
  maxSize?: number;
}

const validateFile = (file: File, props: FileValidationProps): ValidationResult => {
  const errors: Record<string, string[]> = {};

  // Check if file exists
  if (!file) {
    errors.file = ['No file provided'];
    return { isValid: false, errors };
  }

  // Validate file type
  const fileType = file.type.toLowerCase();
  const isValidType = props.acceptedTypes.some(type => 
    fileType === type || type.endsWith('/*') && fileType.startsWith(type.slice(0, -2))
  );

  if (!isValidType) {
    errors.type = [`File type ${fileType} is not supported. Accepted types: ${props.acceptedTypes.join(', ')}`];
  }

  // Validate file size
  const maxSize = props.maxSize || DEFAULT_MAX_SIZE;
  if (file.size > maxSize) {
    errors.size = [`File size exceeds ${maxSize / MB_IN_BYTES}MB limit`];
  }

  // Validate filename
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
  if (invalidChars.test(file.name)) {
    errors.name = ['Filename contains invalid characters'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const FileUpload: React.FC<FileUploadProps> = ({
  acceptedTypes,
  maxSize = DEFAULT_MAX_SIZE,
  onUpload,
  onError,
  multiple = false,
  label = 'Drop files here or click to upload',
  ariaLabel = 'File upload area'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Announce messages to screen readers
  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.style.position = 'absolute';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 3000);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    onError?.(errorMessage);
    announceToScreenReader(`Error: ${errorMessage}`);
  }, [onError, announceToScreenReader]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    announceToScreenReader('File drag detected. Drop files to upload.');
  }, [announceToScreenReader]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      const validation = validateFile(file, { acceptedTypes, maxSize });
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(...Object.values(validation.errors).flat());
      }
    });

    if (errors.length) {
      handleError(errors.join('. '));
      return;
    }

    if (validFiles.length) {
      setSelectedFiles(multiple ? validFiles : [validFiles[0]]);
      announceToScreenReader(`${validFiles.length} file${validFiles.length > 1 ? 's' : ''} selected`);
    }
  }, [acceptedTypes, maxSize, multiple, handleError, announceToScreenReader]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  }, [processFiles]);

  const handleUpload = useCallback(async () => {
    if (!selectedFiles.length) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      await onUpload(selectedFiles);
      announceToScreenReader('Upload completed successfully');
      setSelectedFiles([]);
      setUploadProgress(100);
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, onUpload, handleError, announceToScreenReader]);

  // Keyboard handling for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement === dropZoneRef.current) {
          fileInputRef.current?.click();
        }
      }
    };

    dropZoneRef.current?.addEventListener('keydown', handleKeyDown);
    return () => dropZoneRef.current?.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      <Box
        ref={dropZoneRef}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: theme => `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.grey[300]}`,
          borderRadius: 1,
          p: 3,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease',
          '&:focus': {
            outline: theme => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px'
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="body1">{label}</Typography>
        <Typography variant="caption" color="textSecondary">
          Accepted types: {acceptedTypes.join(', ')} • Max size: {maxSize / MB_IN_BYTES}MB
        </Typography>
      </Box>

      {selectedFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            Selected files ({selectedFiles.length}):
          </Typography>
          {selectedFiles.map(file => (
            <Typography key={file.name} variant="body2">
              {file.name} ({(file.size / MB_IN_BYTES).toFixed(2)}MB)
            </Typography>
          ))}
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={isUploading}
            startIcon={isUploading ? <CircularProgress size={20} /> : undefined}
            sx={{ mt: 1 }}
          >
            {isUploading ? `Uploading ${uploadProgress}%` : 'Upload'}
          </Button>
        </Box>
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert
          severity="error"
          onClose={() => setError(null)}
          icon={<ErrorIcon />}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FileUpload;