import React, { useCallback, memo } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button,
  CircularProgress 
} from '@mui/material'; // v5.14.x
import { LoadingState } from '../../types/common.types';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  content: React.ReactNode;
  confirmButtonText: string;
  cancelButtonText: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loadingState: LoadingState;
  errorMessage?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = memo(({
  open,
  title,
  content,
  confirmButtonText,
  cancelButtonText,
  onConfirm,
  onCancel,
  loadingState,
  errorMessage
}) => {
  // Handle confirm action with loading state management
  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm();
    } catch (error) {
      // Error handling is managed by parent component through loadingState
      console.error('Confirmation action failed:', error);
    }
  }, [onConfirm]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const isLoading = loadingState === 'loading';
  const hasError = loadingState === 'error';

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      // Prevent closing by clicking outside while loading
      disableEscapeKeyDown={isLoading}
      disableBackdropClick={isLoading}
    >
      <DialogTitle id="confirm-dialog-title">
        {title}
      </DialogTitle>
      
      <DialogContent id="confirm-dialog-description">
        {content}
        {hasError && errorMessage && (
          <div 
            role="alert" 
            aria-live="polite" 
            style={{ 
              color: 'error.main',
              marginTop: 2 
            }}
          >
            {errorMessage}
          </div>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleCancel}
          color="inherit"
          disabled={isLoading}
          aria-label="Cancel action"
        >
          {cancelButtonText}
        </Button>
        
        <Button
          onClick={handleConfirm}
          color="primary"
          disabled={isLoading}
          aria-label="Confirm action"
          endIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
});

// Display name for debugging
ConfirmDialog.displayName = 'ConfirmDialog';

export default ConfirmDialog;