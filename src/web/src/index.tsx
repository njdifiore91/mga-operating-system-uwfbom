import { StrictMode } from 'react'; // v18.2.0
import { createRoot } from 'react-dom/client'; // v18.2.0
import { init as initSentry, BrowserTracing } from '@sentry/react'; // v7.x.x
import { PerformanceMonitor } from '@mga/performance-monitoring'; // v1.x.x

import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';

/**
 * Initialize error monitoring and performance tracking
 */
if (process.env.NODE_ENV === 'production') {
  initSentry({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    integrations: [
      new BrowserTracing({
        tracingOrigins: ['localhost', /^\//],
      }),
    ],
  });
}

/**
 * Initialize service worker for offline support and caching
 */
const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              // Notify user of available update
              window.dispatchEvent(new CustomEvent('swUpdate'));
            }
          });
        }
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
};

/**
 * Initialize the React application with all necessary providers
 * and monitoring configurations
 */
const initializeApp = (): void => {
  // Set up performance marks
  performance.mark('app-init-start');

  // Configure Content Security Policy
  if (process.env.NODE_ENV === 'production') {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self';
      script-src 'self' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self' ${process.env.REACT_APP_API_URL};
    `;
    document.head.appendChild(meta);
  }

  // Get root element
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React 18 root
  const root = createRoot(rootElement);

  // Initialize cross-tab communication for auth state
  const broadcastChannel = new BroadcastChannel('mga_auth_channel');
  broadcastChannel.addEventListener('message', (event) => {
    if (event.data.type === 'AUTH_STATE_CHANGE') {
      window.dispatchEvent(new CustomEvent('authStateChange', { 
        detail: event.data.payload 
      }));
    }
  });

  // Register service worker
  registerServiceWorker();

  // Render application with providers
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <PerformanceMonitor
          enabled={process.env.REACT_APP_PERFORMANCE_MONITORING_ENABLED === 'true'}
          sampleRate={0.1}
          reportingEndpoint="/api/metrics"
        >
          <App />
        </PerformanceMonitor>
      </ErrorBoundary>
    </StrictMode>
  );

  // Set final performance mark
  performance.mark('app-init-end');
  performance.measure('app-initialization', 'app-init-start', 'app-init-end');
};

// Initialize application
initializeApp();

// Enable hot module replacement in development
declare global {
  interface NodeModule {
    hot?: {
      accept(path: string, callback: () => void): void;
    };
  }
}

if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    initializeApp();
  });
}