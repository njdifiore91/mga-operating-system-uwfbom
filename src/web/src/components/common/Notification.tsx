import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, Snackbar, IconButton } from '@mui/material'; // v5.14.x
import CloseIcon from '@mui/icons-material/Close'; // v5.14.x
import { useNotification } from '../../hooks/useNotification';

/**
 * Props interface for the Notification component
 * Implements WCAG 2.1 Level AA compliance requirements
 */
interface NotificationProps {
  className?: string;
  testId?: string;
}

/**
 * A reusable notification component that displays alerts using Material UI
 * with enhanced accessibility features and screen reader support.
 * 
 * @component
 * @example
 * <Notification className="custom-notification" testId="custom-notification" />
 */
const Notification: React.FC<NotificationProps> = ({
  className = 'mga-notification',
  testId = 'notification-alert'
}) => {
  const { notification, hideNotification } = useNotification();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Store the currently focused element when notification appears
   */
  useEffect(() => {
    if (notification) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [notification]);

  /**
   * Handle notification close events with accessibility cleanup
   */
  const handleClose = useCallback((
    event: React.SyntheticEvent | null,
    reason?: string
  ) => {
    // Prevent closing on clickaway for better accessibility
    if (reason === 'clickaway') {
      return;
    }

    hideNotification();

    // Return focus to previous element for keyboard navigation
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [hideNotification]);

  /**
   * Handle cleanup after notification exit animation
   */
  const handleExited = useCallback(() => {
    // Remove ARIA live region after exit
    const liveRegion = document.querySelector('[aria-live]');
    if (liveRegion) {
      liveRegion.remove();
    }
  }, []);

  if (!notification) {
    return null;
  }

  return (
    <Snackbar
      open={!!notification}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right'
      }}
      autoHideDuration={notification.duration || 6000}
      onClose={handleClose}
      TransitionProps={{
        onExited: handleExited
      }}
      className={className}
    >
      <Alert
        severity={notification.type}
        onClose={notification.dismissible ? handleClose : undefined}
        variant="filled"
        elevation={6}
        data-testid={testId}
        // Accessibility attributes
        role="alert"
        aria-live={notification.ariaLive || 'polite'}
        aria-atomic="true"
        tabIndex={-1}
        action={
          notification.dismissible ? (
            <IconButton
              aria-label="Close notification"
              color="inherit"
              size="small"
              onClick={handleClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : undefined
        }
        sx={{
          width: '100%',
          alignItems: 'center',
          // High contrast colors for accessibility
          '&.MuiAlert-standardSuccess': {
            backgroundColor: '#e8f5e9',
            color: '#1b5e20'
          },
          '&.MuiAlert-standardError': {
            backgroundColor: '#ffebee',
            color: '#c62828'
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: '#fff3e0',
            color: '#e65100'
          },
          '&.MuiAlert-standardInfo': {
            backgroundColor: '#e3f2fd',
            color: '#0d47a1'
          }
        }}
      >
        {notification.message}
      </Alert>
    </Snackbar>
  );
};

export default Notification;