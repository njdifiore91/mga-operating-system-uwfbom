import type { Config } from '@jest/types';

// Jest configuration for MGA Operating System backend service
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directories for tests and source files
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Pattern matching for test files
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],

  // Transform TypeScript files using ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Module path alias mapping
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1'
  },

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/db/migrations/**/*',
    '!src/db/seeds/**/*'
  ],

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: true
    }
  },

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Enable verbose test output
  verbose: true,

  // Test timeout in milliseconds
  testTimeout: 30000,

  // Limit parallel test execution to 50% of available CPU cores
  maxWorkers: '50%'
};

export default config;