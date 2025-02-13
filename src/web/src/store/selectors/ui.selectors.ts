/**
 * Redux selectors for accessing global UI state with memoization and type safety.
 * Implements Material Design 3.0 integration and responsive layout management.
 * @version 1.0.0
 */

import { createSelector } from '@reduxjs/toolkit'; // v1.9.x
import type { RootState } from '../reducers';
import type { ThemeMode, Breakpoint, Notification, Modal } from '../actions/ui.actions';

/**
 * Base selector for accessing UI state slice with type safety
 */
export const selectUI = (state: RootState) => state.ui;

/**
 * Memoized selector for global loading state
 */
export const selectLoading = createSelector(
  [selectUI],
  (ui) => ui.loading
);

/**
 * Memoized selector for active notifications with Material Design styling
 */
export const selectNotifications = createSelector(
  [selectUI],
  (ui) => ui.notificationQueue.map(notification => ({
    ...notification,
    // Map notification types to Material Design tokens
    severity: notification.type === 'error' ? 'error' :
              notification.type === 'warning' ? 'warning' :
              notification.type === 'success' ? 'success' : 'info',
    // Add display duration
    displayDuration: notification.isPersistent ? null : (notification.duration || 5000)
  }))
);

/**
 * Memoized selector for sidebar visibility with responsive awareness
 */
export const selectSidebarOpen = createSelector(
  [selectUI],
  (ui) => {
    // Auto-collapse on mobile breakpoints
    if (['xs', 'sm'].includes(ui.currentBreakpoint)) {
      return false;
    }
    return ui.sidebarOpen;
  }
);

/**
 * Memoized selector for theme mode with Material Design 3.0 token support
 */
export const selectThemeMode = createSelector(
  [selectUI],
  (ui) => ({
    mode: ui.themeMode,
    isTransitioning: ui.isTransitioning,
    transition: ui.themeTransition,
    // Map to Material Design tokens
    palette: ui.themeMode === 'dark' ? 'dark' : 'light'
  })
);

/**
 * Memoized selector for current breakpoint with responsive layout context
 */
export const selectBreakpoint = createSelector(
  [selectUI],
  (ui) => ({
    current: ui.currentBreakpoint,
    history: ui.breakpointHistory,
    // Map to layout constraints
    isMobile: ['xs', 'sm'].includes(ui.currentBreakpoint),
    isTablet: ui.currentBreakpoint === 'md',
    isDesktop: ['lg', 'xl'].includes(ui.currentBreakpoint),
    // Map to container widths
    containerWidth: 
      ui.currentBreakpoint === 'xs' ? '100%' :
      ui.currentBreakpoint === 'sm' ? '540px' :
      ui.currentBreakpoint === 'md' ? '720px' :
      ui.currentBreakpoint === 'lg' ? '960px' : '1140px'
  })
);

/**
 * Memoized selector for active modals
 */
export const selectModals = createSelector(
  [selectUI],
  (ui) => ui.activeModals
);

/**
 * Memoized selector for UI metadata and performance tracking
 */
export const selectUIMetadata = createSelector(
  [selectUI],
  (ui) => ({
    lastUpdated: ui.metadata.lastUpdated,
    version: ui.metadata.version,
    pendingOperations: ui.metadata.pendingOperations
  })
);

/**
 * Memoized selector for responsive layout configuration
 */
export const selectLayoutConfig = createSelector(
  [selectBreakpoint, selectSidebarOpen],
  (breakpoint, sidebarOpen) => ({
    sidebarWidth: sidebarOpen ? (breakpoint.isMobile ? '100%' : '280px') : '0px',
    mainContentMargin: sidebarOpen ? (breakpoint.isMobile ? '0px' : '280px') : '0px',
    topBarHeight: breakpoint.isMobile ? '56px' : '64px',
    containerPadding: breakpoint.isMobile ? '16px' : '24px'
  })
);