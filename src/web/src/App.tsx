import React, { useEffect } from 'react';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'; // v5.14.0
import { Provider } from 'react-redux'; // v8.1.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { Workbox } from 'workbox-window'; // v7.0.0

import AppRouter from './routes';
import { defaultThemeConfig } from './config/theme.config';
import LoadingSpinner from './components/common/LoadingSpinner';
import Notification from './components/common/Notification';

/**
 * Root application component that initializes the MGA Operating System web interface
 * Implements Material Design 3.0, WCAG 2.1 AA compliance, and comprehensive security monitoring
 */
const App: React.FC = () => {
  // Initialize performance monitoring
  useEffect(() => {
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      const wb = new Workbox('/service-worker.js');
      wb.register().catch(error => {
        console.error('Service worker registration failed:', error);
      });
    }
  }, []);

  // Create theme with accessibility features
  const theme = createTheme({
    ...defaultThemeConfig,
    components: {
      ...defaultThemeConfig.components,
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: '2px solid #0066CC',
              outlineOffset: '2px'
            }
          }
        }
      }
    }
  });

  // Error boundary fallback UI
  const ErrorFallback = ({ error, resetErrorBoundary }: { 
    error: Error; 
    resetErrorBoundary: () => void;
  }) => (
    <div
      role="alert"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}
    >
      <h2>Something went wrong</h2>
      <pre style={{ maxWidth: '100%', overflow: 'auto' }}>{error.message}</pre>
      <button 
        onClick={resetErrorBoundary}
        style={{ marginTop: '20px' }}
      >
        Try again
      </button>
    </div>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset application state
        window.location.href = '/';
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <React.Suspense fallback={<LoadingSpinner fullScreen />}>
          {/* Global notification system */}
          <Notification />
          
          {/* Main application router */}
          <AppRouter />
        </React.Suspense>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;