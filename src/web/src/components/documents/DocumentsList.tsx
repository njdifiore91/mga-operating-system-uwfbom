import React, { useCallback, useMemo, useState } from 'react';
import { 
  IconButton, 
  Menu, 
  MenuItem, 
  Box, 
  Tooltip, 
  CircularProgress, 
  Skeleton 
} from '@mui/material';
import { 
  Downloading as DownloadIcon, 
  Delete as DeleteIcon, 
  MoreVert as MoreVertIcon, 
  Lock as LockIcon, 
  Security 
} from '@mui/icons-material';
import DataGrid from '../common/DataGrid';
import { useDocuments } from '../../hooks/useDocuments';
import { 
  IDocument, 
  DocumentType, 
  DocumentStatus
} from '../../types/documents.types';

interface DocumentsListProps {
  policyId?: string;
  documentType?: DocumentType;
  onDocumentSelect?: (document: IDocument) => void;
  securityLevel?: string;
  enableBulkActions?: boolean;
  onError?: (error: Error) => void;
}

const DocumentsList: React.FC<DocumentsListProps> = ({
  policyId,
  documentType,
  onDocumentSelect,
  securityLevel = 'STANDARD',
  onError
}) => {
  // State for action menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<IDocument | null>(null);

  // Initialize documents hook with security context
  const {
    documents,
    isLoading,
    error,
    uploadState,
    getDownloadUrl,
    deleteDocument
  } = useDocuments({
    policyId,
    documentType,
    securityClass: securityLevel
  });

  // Handle document action menu
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, document: IDocument) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedDocument(document);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedDocument(null);
  }, []);

  // Handle document download with security checks
  const handleDownload = useCallback(async (document: IDocument) => {
    try {
      await getDownloadUrl(document.id);
      handleMenuClose();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [getDownloadUrl, handleMenuClose, onError]);

  // Handle document deletion with confirmation
  const handleDelete = useCallback(async (document: IDocument) => {
    try {
      if (window.confirm('Are you sure you want to delete this document?')) {
        await deleteDocument(document.id);
        handleMenuClose();
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [deleteDocument, handleMenuClose, onError]);

  // Configure grid columns with security indicators
  const columns = useMemo(() => [
    {
      field: 'fileName',
      headerName: 'Document Name',
      flex: 2,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {params.row.isEncrypted && (
            <Tooltip title="Encrypted Document">
              <LockIcon fontSize="small" color="primary" />
            </Tooltip>
          )}
          {params.row.securityClassification !== 'PUBLIC' && (
            <Tooltip title={`Security Level: ${params.row.securityClassification}`}>
              <Security fontSize="small" color="warning" />
            </Tooltip>
          )}
          {params.value}
        </Box>
      )
    },
    {
      field: 'documentType',
      headerName: 'Type',
      flex: 1
    },
    {
      field: 'uploadedAt',
      headerName: 'Upload Date',
      flex: 1,
      valueFormatter: ({ value }: { value: string }) => 
        new Date(value).toLocaleDateString()
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      renderCell: (params: any) => {
        const uploadProgress = uploadState.get(params.row.fileName)?.progress;
        if (params.value === DocumentStatus.PROCESSING && uploadProgress !== undefined) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} variant="determinate" value={uploadProgress} />
              {`${uploadProgress}%`}
            </Box>
          );
        }
        return params.value;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      sortable: false,
      renderCell: (params: any) => (
        <>
          <IconButton
            aria-label="document actions"
            onClick={(e) => handleMenuOpen(e, params.row)}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl && selectedDocument?.id === params.row.id)}
            onClose={handleMenuClose}
          >
            <MenuItem
              onClick={() => handleDownload(params.row)}
              disabled={params.row.status !== DocumentStatus.COMPLETED}
            >
              <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
              Download
            </MenuItem>
            <MenuItem 
              onClick={() => handleDelete(params.row)}
              disabled={!params.row.status || params.row.status === DocumentStatus.DELETED}
            >
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          </Menu>
        </>
      )
    }
  ], [anchorEl, selectedDocument, uploadState, handleMenuOpen, handleMenuClose, handleDownload, handleDelete]);

  // Handle loading and error states
  if (error) {
    return (
      <Box role="alert" aria-live="polite" sx={{ color: 'error.main', p: 2 }}>
        Error loading documents: {error.message}
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        {[...Array(5)].map((_, index) => (
          <Skeleton 
            key={index}
            variant="rectangular"
            height={52}
            sx={{ my: 1 }}
            animation="wave"
          />
        ))}
      </Box>
    );
  }

  return (
    <DataGrid
      rows={documents}
      columns={columns}
      loading={isLoading}
      totalRows={documents.length}
      paginationParams={{
        page: 0,
        limit: 10,
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      }}
      onPaginationChange={() => {}}
      ariaLabel="Documents list"
      sx={{
        '& .MuiDataGrid-row': {
          cursor: onDocumentSelect ? 'pointer' : 'default'
        }
      }}
      onRowClick={onDocumentSelect ? (params) => onDocumentSelect(params.row) : undefined}
    />
  );
};

export default DocumentsList;