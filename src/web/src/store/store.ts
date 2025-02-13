/**
 * Redux store configuration for MGA Operating System
 * Implements high-performance state management with comprehensive middleware stack
 * @version 1.0.0
 */

import { configureStore, Middleware, isPlainObject } from '@reduxjs/toolkit'; // v1.9.5
import { createStateSyncMiddleware, initMessageListener } from 'redux-state-sync'; // v3.1.4
import { createLogger } from 'redux-logger'; // v3.0.6
import { persistStore, persistReducer } from 'redux-persist'; // v6.0.0
import storage from 'redux-persist/lib/storage';
import rootReducer from './reducers';

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  maxTransactionsPerMinute: 10000,
  responseTimeThreshold: 2000,
  monitoringEnabled: process.env.NODE_ENV === 'production'
};

// State sync configuration for cross-tab communication
const STATE_SYNC_CONFIG = {
  blacklist: ['ui.loading', 'ui.notificationQueue'],
  broadcastChannelOption: {
    type: 'localstorage'
  }
};

// Persistence configuration
const PERSIST_CONFIG = {
  key: 'mga-os-root',
  storage,
  whitelist: ['auth', 'ui.themeMode'],
  blacklist: ['ui.loading', 'ui.notificationQueue']
};

// Create performance monitoring middleware
const createPerformanceMiddleware = (): Middleware => {
  let transactionCount = 0;
  let lastResetTime = Date.now();

  return () => next => action => {
    const startTime = Date.now();

    // Reset transaction count every minute
    if (startTime - lastResetTime >= 60000) {
      transactionCount = 0;
      lastResetTime = startTime;
    }

    // Check transaction limits
    if (transactionCount >= PERFORMANCE_CONFIG.maxTransactionsPerMinute) {
      console.warn('Transaction limit exceeded');
      return;
    }

    const result = next(action);
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (duration > PERFORMANCE_CONFIG.responseTimeThreshold) {
      console.warn(`Slow action detected: ${action.type} took ${duration}ms`);
    }

    transactionCount++;
    return result;
  };
};

// Create error tracking middleware
const errorMiddleware: Middleware = () => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Action error:', {
      action,
      error,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

// Configure store with middleware stack and development tools
const configureAppStore = () => {
  // Create middleware array
  const middleware = [
    createStateSyncMiddleware(STATE_SYNC_CONFIG),
    createPerformanceMiddleware(),
    errorMiddleware
  ];

  // Add development middleware
  if (process.env.NODE_ENV === 'development') {
    middleware.push(
      createLogger({
        collapsed: true,
        duration: true,
        timestamp: true
      })
    );
  }

  // Create persisted reducer
  const persistedReducer = persistReducer(PERSIST_CONFIG, rootReducer);

  // Configure store with middleware and development tools
  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
          ignoredPaths: ['ui.themeTransition']
        },
        immutableCheck: {
          ignoredPaths: ['ui.notificationQueue']
        }
      }).concat(middleware),
    devTools: process.env.NODE_ENV !== 'production' && {
      name: 'MGA OS Store',
      trace: true,
      traceLimit: 25
    }
  });

  // Initialize cross-tab state sync
  initMessageListener(store);

  // Create persistor
  const persistor = persistStore(store);

  return { store, persistor };
};

// Create store instance
const { store, persistor } = configureAppStore();

// Export store instance and types
export { store, persistor };
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type guard for action validation
export const isValidAction = (action: unknown): boolean => {
  return (
    isPlainObject(action) &&
    typeof (action as any).type === 'string' &&
    Object.keys(action as object).every(key => ['type', 'payload', 'meta', 'error'].includes(key))
  );
};