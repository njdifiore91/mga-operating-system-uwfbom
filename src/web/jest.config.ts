import type { Config } from '@jest/types';

/**
 * Jest configuration for MGA OS web application testing environment
 * Configures comprehensive test coverage, module resolution, and security-focused testing
 * @version 1.0.0
 */
const config: Config.InitialOptions = {
  // Root directory for test discovery
  rootDir: '.',

  // Test environment configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // TypeScript configuration
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      isolatedModules: true
    }]
  },

  // Module resolution configuration
  moduleNameMapper: {
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/mocks/fileMock.ts',
    // Handle path aliases
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}'
  ],

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.next/',
    '/coverage/',
    '/public/'
  ],

  // Module directories for resolution
  moduleDirectories: [
    'node_modules',
    'src'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__mocks__/**',
    '!src/test-utils/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Performance and execution configuration
  maxWorkers: '50%',
  testTimeout: 10000,

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Verbose output for detailed test results
  verbose: true,

  // Global configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      isolatedModules: true
    }
  },

  // Error handling
  bail: 1,
  errorOnDeprecated: true
};

export default config;