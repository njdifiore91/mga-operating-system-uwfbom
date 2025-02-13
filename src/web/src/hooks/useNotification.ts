import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useRef } from 'react';
import { setNotification } from '../store/actions/ui.actions';
import type { Notification } from '../store/actions/ui.actions';

/**
 * Interface for notification payload with accessibility support
 */
export interface NotificationPayload {
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  dismissible?: boolean;
  ariaLive?: 'polite' | 'assertive';
}

/**
 * Interface for notification state with enhanced type safety
 */
interface NotificationState extends Notification {
  dismissible: boolean;
  ariaLive: 'polite' | 'assertive';
}

/**
 * Default configuration for notifications
 */
const DEFAULT_NOTIFICATION_CONFIG = {
  duration: 6000, // 6 seconds
  dismissible: true,
  ariaLive: 'polite' as const,
};

/**
 * Custom hook for managing notifications with accessibility support
 * Implements WCAG 2.1 Level AA compliance
 * @returns Object containing notification state and control functions
 */
export const useNotification = () => {
  const dispatch = useDispatch();
  const timeoutRef = useRef<number>();

  // Select notification state from Redux store
  const notification = useSelector<any, NotificationState | null>(
    (state) => state.ui.notification
  );

  /**
   * Cleanup function for notification timeout
   */
  const clearNotificationTimeout = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  /**
   * Show notification with type safety and accessibility support
   */
  const showNotification = useCallback((payload: NotificationPayload) => {
    clearNotificationTimeout();

    const config = {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...payload,
    };

    // Generate unique ID for notification
    const id = `notification-${Date.now()}`;

    // Dispatch notification with enhanced type checking
    dispatch(
      setNotification({
        id,
        type: config.severity,
        message: config.message,
        dismissible: config.dismissible,
        ariaLive: config.ariaLive,
        duration: config.duration,
      })
    );

    // Set up auto-dismiss if duration is provided
    if (config.duration && config.duration > 0) {
      timeoutRef.current = window.setTimeout(() => {
        hideNotification();
      }, config.duration);
    }
  }, [dispatch]);

  /**
   * Hide notification with cleanup
   */
  const hideNotification = useCallback(() => {
    clearNotificationTimeout();
    dispatch(setNotification(null));
  }, [dispatch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearNotificationTimeout();
    };
  }, []);

  /**
   * Screen reader announcement setup
   */
  useEffect(() => {
    if (notification) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', notification.ariaLive);
      announcer.className = 'sr-only';
      announcer.textContent = notification.message;
      
      document.body.appendChild(announcer);
      
      return () => {
        document.body.removeChild(announcer);
      };
    }
  }, [notification]);

  return {
    notification,
    showNotification,
    hideNotification,
  };
};

/**
 * Type guard for notification severity
 */
export const isValidSeverity = (
  severity: string
): severity is NotificationPayload['severity'] => {
  return ['success', 'error', 'warning', 'info'].includes(severity);
};