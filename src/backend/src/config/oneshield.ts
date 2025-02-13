/**
 * @file OneShield integration configuration module for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import dotenv from 'dotenv'; // v16.3.1
import { OneShieldEnvironment, IOneShieldConfig } from '../integrations/oneshield/types';

// Load environment variables
dotenv.config();

// Global configuration constants
const ONESHIELD_API_TIMEOUT = 30000;
const ONESHIELD_RETRY_ATTEMPTS = 3;
const ONESHIELD_CONNECTION_POOL_SIZE = 50;
const ONESHIELD_CIRCUIT_BREAKER_THRESHOLD = 0.5;
const ONESHIELD_HEALTH_CHECK_INTERVAL = 60000;

/**
 * Validates OneShield configuration settings
 * @param config - OneShield configuration object
 * @returns boolean indicating if configuration is valid
 */
const validateConfig = (config: IOneShieldConfig): boolean => {
  if (!config.baseUrl || !config.apiKey || !config.environment) {
    throw new Error('Missing required OneShield configuration parameters');
  }

  const urlPattern = /^https:\/\/.+/;
  if (!urlPattern.test(config.baseUrl)) {
    throw new Error('Invalid OneShield base URL format - HTTPS required');
  }

  if (typeof config.timeout !== 'number' || config.timeout <= 0) {
    throw new Error('Invalid timeout configuration');
  }

  return true;
};

/**
 * Retrieves environment-specific OneShield configuration
 * @returns Complete OneShield configuration object
 */
const getOneShieldConfig = (): IOneShieldConfig => {
  const environment = (process.env.NODE_ENV || 'development').toLowerCase();
  
  const config: IOneShieldConfig = {
    baseUrl: process.env.ONESHIELD_BASE_URL || '',
    apiKey: process.env.ONESHIELD_API_KEY || '',
    environment: OneShieldEnvironment[environment.toUpperCase() as keyof typeof OneShieldEnvironment] || OneShieldEnvironment.DEVELOPMENT,
    timeout: ONESHIELD_API_TIMEOUT,
    version: process.env.ONESHIELD_API_VERSION || '1.0',
    retryConfig: {
      maxRetries: ONESHIELD_RETRY_ATTEMPTS,
      backoffFactor: 2,
      initialDelay: 1000,
      maxDelay: 10000
    }
  };

  validateConfig(config);
  return config;
};

/**
 * Comprehensive OneShield configuration object with enhanced security and monitoring
 */
export const oneshieldConfig = {
  connection: {
    ...getOneShieldConfig(),
    poolSize: ONESHIELD_CONNECTION_POOL_SIZE,
    keepAlive: true,
    keepAliveTimeout: 60000
  },

  policy: {
    endpoints: {
      create: '/api/policy/v1/policies',
      update: '/api/policy/v1/policies/:id',
      get: '/api/policy/v1/policies/:id',
      search: '/api/policy/v1/policies/search',
      bind: '/api/policy/v1/policies/:id/bind'
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 1000
    }
  },

  billing: {
    endpoints: {
      invoice: '/api/billing/v1/invoices',
      payment: '/api/billing/v1/payments',
      plan: '/api/billing/v1/payment-plans'
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 500
    }
  },

  security: {
    tls: {
      minVersion: 'TLSv1.2',
      ciphers: [
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384'
      ],
      rejectUnauthorized: true
    },
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
  },

  monitoring: {
    circuitBreaker: {
      threshold: ONESHIELD_CIRCUIT_BREAKER_THRESHOLD,
      resetTimeout: 30000
    },
    metrics: {
      enabled: true,
      collectInterval: 10000
    },
    logging: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: 'json'
    }
  },

  health: {
    checkInterval: ONESHIELD_HEALTH_CHECK_INTERVAL,
    endpoints: {
      policy: '/api/health/policy',
      billing: '/api/health/billing'
    },
    threshold: {
      successRate: 0.95,
      latency: 2000
    }
  }
};

export default oneshieldConfig;