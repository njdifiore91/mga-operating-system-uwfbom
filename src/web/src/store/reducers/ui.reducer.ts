/**
 * Redux reducer for managing global UI state including loading states, notifications,
 * modals, sidebar visibility, theme preferences, and responsive breakpoints.
 * Implements Material Design 3.0 integration and responsive layout management.
 * @version 1.0.0
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // v1.9.x
import { LoadingState } from '../../types/common.types';
import { 
  setLoading, 
  setThemeMode, 
  setBreakpoint, 
  setSidebarVisible, 
  setNotification,
  setModal,
  ThemeMode,
  Breakpoint,
  Notification,
  Modal
} from '../actions/ui.actions';

/**
 * Interface for theme transition state tracking
 */
interface ThemeTransitionState {
  status: 'none' | 'pending' | 'complete';
  from: ThemeMode | null;
  to: ThemeMode | null;
}

/**
 * Interface for notification state with enhanced lifecycle management
 */
interface NotificationState extends Notification {
  createdAt: Date;
  isPersistent: boolean;
}

/**
 * Interface defining the shape of the UI state slice
 */
interface UIState {
  loading: boolean;
  notificationQueue: NotificationState[];
  sidebarOpen: boolean;
  themeMode: ThemeMode;
  currentBreakpoint: Breakpoint;
  breakpointHistory: Breakpoint[];
  isTransitioning: boolean;
  themeTransition: ThemeTransitionState;
  activeModals: Modal[];
}

/**
 * Initial state for UI reducer with enhanced defaults
 */
const initialState: UIState = {
  loading: false,
  notificationQueue: [],
  sidebarOpen: true,
  themeMode: 'light',
  currentBreakpoint: 'lg',
  breakpointHistory: ['lg'],
  isTransitioning: false,
  themeTransition: {
    status: 'none',
    from: null,
    to: null
  },
  activeModals: []
};

/**
 * Maximum number of notifications to show in queue
 */
const MAX_NOTIFICATIONS = 5;

/**
 * Default notification duration in milliseconds
 */
const DEFAULT_NOTIFICATION_DURATION = 5000;

/**
 * UI reducer implementation with enhanced validation and transition handling
 */
export const uiReducer = createReducer(initialState, (builder) => {
  builder
    // Loading state management
    .addCase(setLoading, (state, action: PayloadAction<LoadingState>) => {
      state.loading = action.payload === 'loading';
    })

    // Theme mode management with transition tracking
    .addCase(setThemeMode, (state, action: PayloadAction<ThemeMode>) => {
      const previousTheme = state.themeMode;
      state.themeTransition = {
        status: 'pending',
        from: previousTheme,
        to: action.payload
      };
      state.themeMode = action.payload;
      state.isTransitioning = true;

      // Reset transition state after animation completes
      setTimeout(() => {
        state.themeTransition.status = 'complete';
        state.isTransitioning = false;
      }, 300);
    })

    // Breakpoint management with history tracking
    .addCase(setBreakpoint, (state, action: PayloadAction<Breakpoint>) => {
      const previousBreakpoint = state.currentBreakpoint;
      if (previousBreakpoint !== action.payload) {
        state.breakpointHistory = [
          action.payload,
          ...state.breakpointHistory.slice(0, 4)
        ];
        state.currentBreakpoint = action.payload;
        
        // Auto-collapse sidebar on mobile breakpoints
        if (['xs', 'sm'].includes(action.payload)) {
          state.sidebarOpen = false;
        }
      }
    })

    // Sidebar visibility management
    .addCase(setSidebarVisible, (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    })

    // Notification management with queue and lifecycle
    .addCase(setNotification, (state, action: PayloadAction<Notification | null>) => {
      if (!action.payload) {
        state.notificationQueue = [];
        return;
      }

      const newNotification: NotificationState = {
        ...action.payload,
        createdAt: new Date(),
        isPersistent: !action.payload.duration
      };

      // Maintain queue size limit
      state.notificationQueue = [
        newNotification,
        ...state.notificationQueue.slice(0, MAX_NOTIFICATIONS - 1)
      ];

      // Auto-dismiss non-persistent notifications
      if (!newNotification.isPersistent) {
        const duration = newNotification.duration || DEFAULT_NOTIFICATION_DURATION;
        setTimeout(() => {
          state.notificationQueue = state.notificationQueue.filter(
            n => n.id !== newNotification.id
          );
        }, duration);
      }
    })

    // Modal management
    .addCase(setModal, (state, action: PayloadAction<Modal | null>) => {
      if (!action.payload) {
        state.activeModals = [];
        return;
      }

      const existingModalIndex = state.activeModals.findIndex(
        m => m.id === action.payload!.id
      );

      if (existingModalIndex >= 0) {
        state.activeModals[existingModalIndex] = action.payload;
      } else {
        state.activeModals.push(action.payload);
      }

      // Remove closed modals
      if (!action.payload.isOpen) {
        state.activeModals = state.activeModals.filter(
          m => m.id !== action.payload!.id
        );
      }
    });
});

export default uiReducer;