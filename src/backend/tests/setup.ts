import { initializeDatabase, closeDatabase } from '../src/config/database';
import { RedisManager } from '../src/config/redis';
import { createKafkaClient } from '../src/config/kafka';
import { error, info } from '../utils/logger';

// Test environment configuration constants
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/mga_test';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
const TEST_KAFKA_BROKER = process.env.TEST_KAFKA_BROKER || 'localhost:9092';
const TEST_ENV = 'test';

// Redis manager instance for test environment
const redisManager = new RedisManager({ clusterMode: false });

/**
 * Initializes test database connection with test-specific configurations
 */
export const setupTestDatabase = async (): Promise<void> => {
  try {
    // Override database configuration for tests
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'mga_test';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
    process.env.NODE_ENV = TEST_ENV;

    // Initialize database with test-specific pool settings
    await initializeDatabase();
    info('Test database initialized successfully');

  } catch (err) {
    error('Failed to initialize test database', err);
    throw err;
  }
};

/**
 * Initializes Redis client for test environment with isolation and prefixing
 */
export const setupTestRedis = async (): Promise<void> => {
  try {
    // Configure Redis for test environment
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_DB = '1';
    process.env.REDIS_KEY_PREFIX = 'mga_test:';

    // Initialize Redis manager with test configuration
    await redisManager.initialize();
    
    // Clear any existing test data
    const client = await redisManager.getClient();
    await client.flushdb();
    
    info('Test Redis initialized successfully');

  } catch (err) {
    error('Failed to initialize test Redis', err);
    throw err;
  }
};

/**
 * Sets up Kafka client and topics for test environment
 */
export const setupTestKafka = async (): Promise<void> => {
  try {
    // Configure Kafka for test environment
    process.env.KAFKA_BROKERS = TEST_KAFKA_BROKER;
    process.env.KAFKA_CLIENT_ID = 'mga-test-client';
    
    // Create Kafka client with test configuration
    const kafka = createKafkaClient({
      clientId: 'mga-test-client',
      brokers: [TEST_KAFKA_BROKER],
      retry: {
        maxAttempts: 3,
        initialRetryTime: 100
      }
    });

    // Create test-specific topics
    const admin = kafka.admin();
    await admin.createTopics({
      topics: [
        { topic: 'test-policies', numPartitions: 1, replicationFactor: 1 },
        { topic: 'test-claims', numPartitions: 1, replicationFactor: 1 },
        { topic: 'test-underwriting', numPartitions: 1, replicationFactor: 1 }
      ]
    });

    info('Test Kafka initialized successfully');

  } catch (err) {
    error('Failed to initialize test Kafka', err);
    throw err;
  }
};

/**
 * Comprehensive cleanup of test environment and resources
 */
export const teardownTestEnvironment = async (): Promise<void> => {
  try {
    // Close database connections
    await closeDatabase();

    // Clear Redis test data
    const client = await redisManager.getClient();
    await client.flushdb();

    // Delete Kafka test topics
    const kafka = createKafkaClient({
      clientId: 'mga-test-client',
      brokers: [TEST_KAFKA_BROKER]
    });
    const admin = kafka.admin();
    await admin.deleteTopics({
      topics: ['test-policies', 'test-claims', 'test-underwriting']
    });

    // Reset environment variables
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_DB;
    delete process.env.REDIS_KEY_PREFIX;
    delete process.env.KAFKA_BROKERS;
    delete process.env.KAFKA_CLIENT_ID;

    info('Test environment cleanup completed successfully');

  } catch (err) {
    error('Failed to cleanup test environment', err);
    throw err;
  }
};

// Configure Jest hooks for global setup and teardown
beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
  await setupTestKafka();
});

afterAll(async () => {
  await teardownTestEnvironment();
});