import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Lock as LockIcon,
  Download as DownloadIcon,
  ErrorOutline,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { Document, Page } from 'react-pdf/dist/esm/entry.webpack';
import { IDocument } from '../../types/documents.types';
import LoadingSpinner from '../common/LoadingSpinner';
import { DocumentService } from '../../services/documents.service';

// Configure PDF.js worker
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentPreviewProps {
  document: IDocument;
  showControls?: boolean;
  onClose?: () => void;
  onError?: (error: Error) => void;
  userAccessLevel: string;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  showControls = true,
  onError,
  userAccessLevel
}) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [showWatermark, setShowWatermark] = useState(false);

  // Security validation
  useEffect(() => {
    const validateAccess = async () => {
      try {
        const hasAccess = await DocumentService.validateAccess(document.id, userAccessLevel);
        if (!hasAccess) {
          throw new Error('Insufficient permissions to view this document');
        }
        setShowWatermark(document.securityClassification === 'RESTRICTED');
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        onError?.(error);
      }
    };

    validateAccess();
  }, [document.id, userAccessLevel, onError]);

  // Document download handler
  const handleDownload = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    
    try {
      setLoading(true);
      
      // Track download progress
      const handleProgress = (progress: number) => {
        setDownloadProgress(progress);
      };

      const blob = await DocumentService.downloadDocumentFile(
        document.id,
        handleProgress
      );

      // Create secure download link
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
      window.URL.revokeObjectURL(url);

      setDownloadProgress(0);
    } catch (err) {
      const error = err as Error;
      setError(`Download failed: ${error.message}`);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [document, onError]);

  // Zoom controls
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  // Render document preview based on file type
  const renderPreview = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <LoadingSpinner size={40} color="primary" />
        </Box>
      );
    }

    if (error) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" p={3}>
          <ErrorOutline color="error" sx={{ fontSize: 48, mb: 2 }} />
          <Typography color="error" align="center">
            {error}
          </Typography>
        </Box>
      );
    }

    const PreviewContent = (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'auto'
        }}
      >
        {showWatermark && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.2,
              transform: 'rotate(-45deg)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <Typography variant="h2" color="text.secondary">
              CONFIDENTIAL
            </Typography>
          </Box>
        )}

        {document.fileType.includes('pdf') ? (
          <Document
            onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
            loading={<LoadingSpinner size={40} color="primary" />}
            error={
              <Typography color="error">
                Failed to load PDF document
              </Typography>
            }
          >
            <Page
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        ) : (
          <Box
            component="img"
            src={`/api/documents/${document.id}/content`}
            alt={document.fileName}
            sx={{
              maxWidth: '100%',
              height: 'auto',
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}
          />
        )}
      </Box>
    );

    return PreviewContent;
  };

  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Document Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6" component="h2">
            {document.fileName}
          </Typography>
          {document.isEncrypted && (
            <Tooltip title="Encrypted Document">
              <LockIcon color="primary" fontSize="small" />
            </Tooltip>
          )}
        </Box>

        {showControls && (
          <Box display="flex" gap={1}>
            <Tooltip title="Zoom Out">
              <IconButton onClick={handleZoomOut} disabled={loading}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom In">
              <IconButton onClick={handleZoomIn} disabled={loading}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print">
              <IconButton
                onClick={() => window.print()}
                disabled={loading || document.securityClassification === 'RESTRICTED'}
              >
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton
                onClick={handleDownload}
                disabled={loading || document.securityClassification === 'RESTRICTED'}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Document Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          bgcolor: 'background.default'
        }}
      >
        {renderPreview()}
      </Box>

      {/* Progress Indicator */}
      <Snackbar
        open={downloadProgress > 0 && downloadProgress < 100}
        message={
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress
              size={24}
              variant="determinate"
              value={downloadProgress}
            />
            <Typography>Downloading: {downloadProgress}%</Typography>
          </Box>
        }
      />
    </Paper>
  );
};

export default DocumentPreview;