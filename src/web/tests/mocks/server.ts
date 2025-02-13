/**
 * Mock Service Worker (MSW) server configuration for MGA OS web application testing
 * Provides comprehensive API mocking capabilities for frontend integration testing
 * @version 1.0.0
 */

import { setupServer } from 'msw/node'; // ^1.2.1
import { handlers } from './handlers';

/**
 * Create and configure MSW server instance with comprehensive request handlers
 * Supports policy, claims, and underwriting endpoint mocking with realistic delays
 * and response patterns matching production behavior
 */
const server = setupServer(...handlers);

// Configure request logging for development and debugging
if (process.env.NODE_ENV === 'development') {
  server.events.on('request:start', ({ request }) => {
    console.log('MSW intercepted:', request.method, request.url.toString());
  });

  server.events.on('request:match', ({ request }) => {
    console.log('MSW matched handler:', request.method, request.url.toString());
  });

  server.events.on('request:unhandled', ({ request }) => {
    console.warn('MSW no handler found:', request.method, request.url.toString());
  });
}

// Configure response logging for development and debugging
if (process.env.NODE_ENV === 'development') {
  server.events.on('response:mocked', ({ response, request }) => {
    console.log('MSW mocked response:', {
      url: request.url.toString(),
      status: response.status,
      statusText: response.statusText,
    });
  });

  server.events.on('response:bypass', ({ request }) => {
    console.log('MSW bypassed request:', request.method, request.url.toString());
  });
}

// Handle server lifecycle errors
server.events.on('error', (error) => {
  console.error('MSW server error:', error);
});

export { server };