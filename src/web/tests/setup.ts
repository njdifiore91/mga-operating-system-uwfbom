/**
 * Global test setup configuration for MGA OS web application
 * Configures Jest testing environment with enhanced security and integration testing capabilities
 * @version 1.0.0
 */

import '@testing-library/jest-dom'; // ^5.16.5
import { userEvent } from '@testing-library/user-event'; // ^14.4.3
import server from './mocks/server';

/**
 * Configure global test environment before all tests
 * Sets up MSW server, security headers, and test isolation boundaries
 */
beforeAll(async () => {
  // Start MSW server with enhanced error logging
  await server.listen({
    onUnhandledRequest: 'warn',
  });

  // Configure global fetch mocking with security headers
  global.fetch = jest.fn();
  
  // Configure secure localStorage mock
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  
  // Configure secure sessionStorage mock
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

  // Configure performance monitoring
  jest.spyOn(window, 'performance', 'get').mockImplementation(() => ({
    now: jest.fn(),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(),
    getEntriesByType: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  } as unknown as Performance));

  // Configure secure window.crypto mock
  Object.defineProperty(window, 'crypto', {
    value: {
      subtle: {
        digest: jest.fn(),
        generateKey: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
      },
      getRandomValues: jest.fn(),
    },
  });

  // Configure secure headers for fetch requests
  global.Headers = jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    set: jest.fn(),
    forEach: jest.fn(),
  }));
});

/**
 * Clean up test environment after all tests complete
 * Closes MSW server and resets all mocks and configurations
 */
afterAll(async () => {
  server.close();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

/**
 * Reset test environment before each test
 * Ensures test isolation and clean state
 */
beforeEach(() => {
  // Reset MSW request handlers
  server.resetHandlers();
  
  // Clear storage
  window.localStorage.clear();
  window.sessionStorage.clear();
  
  // Reset document
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Clear all mock function calls
  jest.clearAllMocks();
  
  // Reset user event instance
  userEvent.setup();
  
  // Clear all timers
  jest.clearAllTimers();
  
  // Reset performance measurements
  window.performance.clearMarks();
  window.performance.clearMeasures();
});

/**
 * Clean up after each test
 * Removes any remaining test artifacts
 */
afterEach(() => {
  // Clean up mounted components
  jest.clearAllMocks();
  
  // Clear any remaining timeouts
  jest.clearAllTimers();
  
  // Reset any modified globals
  jest.restoreAllMocks();
  
  // Clear any pending promises
  jest.useRealTimers();
  
  // Clear any error handlers
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

/**
 * Configure global Jest environment settings
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress React 18 console warnings in test output
const originalError = console.error;
console.error = (...args) => {
  if (/Warning.*not wrapped in act/.test(args[0])) {
    return;
  }
  originalError.call(console, ...args);
};