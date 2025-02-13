/**
 * Redux action creators for managing global UI state including loading states, 
 * notifications, modals, sidebar visibility, theme preferences, and responsive breakpoints.
 * Implements Material Design 3.0 integration and responsive layout management.
 * @version 1.0.0
 */

import { createAction } from '@reduxjs/toolkit';
import { LoadingState } from '../../types/common.types';

// Action type constants
export const UI_ACTIONS = {
  SET_LOADING: 'ui/setLoading',
  SET_THEME_MODE: 'ui/setThemeMode',
  SET_BREAKPOINT: 'ui/setBreakpoint',
  SET_SIDEBAR_VISIBLE: 'ui/setSidebarVisible',
  SET_NOTIFICATION: 'ui/setNotification',
  SET_MODAL: 'ui/setModal',
} as const;

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'system';

// Breakpoint type aligned with Material Design 3.0
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Notification type
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Modal type
export interface Modal {
  id: string;
  isOpen: boolean;
  component: string;
  props?: Record<string, any>;
}

/**
 * Action creator for updating global loading state
 * @param state - Current loading state
 */
export const setLoading = createAction<LoadingState>(
  UI_ACTIONS.SET_LOADING,
  (state) => {
    // Validate loading state
    if (!['idle', 'loading', 'success', 'error'].includes(state)) {
      throw new Error(`Invalid loading state: ${state}`);
    }
    return { payload: state };
  }
);

/**
 * Action creator for updating theme mode with Material Design 3.0 tokens
 * @param mode - Theme mode selection
 */
export const setThemeMode = createAction<ThemeMode>(
  UI_ACTIONS.SET_THEME_MODE,
  (mode) => {
    // Validate theme mode
    if (!['light', 'dark', 'system'].includes(mode)) {
      throw new Error(`Invalid theme mode: ${mode}`);
    }
    return { payload: mode };
  }
);

/**
 * Action creator for updating responsive breakpoint
 * Manages layout transitions across defined breakpoints:
 * xs: 0-319px
 * sm: 320-767px
 * md: 768-1023px
 * lg: 1024-1439px
 * xl: 1440px+
 * @param breakpoint - Current breakpoint value
 */
export const setBreakpoint = createAction<Breakpoint>(
  UI_ACTIONS.SET_BREAKPOINT,
  (breakpoint) => {
    // Validate breakpoint
    if (!['xs', 'sm', 'md', 'lg', 'xl'].includes(breakpoint)) {
      throw new Error(`Invalid breakpoint: ${breakpoint}`);
    }
    return { payload: breakpoint };
  }
);

/**
 * Action creator for toggling sidebar visibility
 * @param isVisible - Sidebar visibility state
 */
export const setSidebarVisible = createAction<boolean>(
  UI_ACTIONS.SET_SIDEBAR_VISIBLE
);

/**
 * Action creator for managing notifications
 * @param notification - Notification object
 */
export const setNotification = createAction<Notification | null>(
  UI_ACTIONS.SET_NOTIFICATION,
  (notification) => {
    if (notification && !notification.id) {
      throw new Error('Notification must have an id');
    }
    return { payload: notification };
  }
);

/**
 * Action creator for managing modal state
 * @param modal - Modal configuration object
 */
export const setModal = createAction<Modal | null>(
  UI_ACTIONS.SET_MODAL,
  (modal) => {
    if (modal && !modal.id) {
      throw new Error('Modal must have an id');
    }
    return { payload: modal };
  }
);