import { Kafka, Consumer, Producer, KafkaConfig as KafkaJSConfig } from 'kafkajs'; // v2.2.4
import { Logger } from '../utils/logger';
import { MetricsClient } from '../utils/metrics';

// Environment-based configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'mga-os-service';
const KAFKA_SSL_ENABLED = process.env.KAFKA_SSL_ENABLED === 'true';
const KAFKA_SASL_ENABLED = process.env.KAFKA_SASL_ENABLED === 'true';
const KAFKA_SASL_MECHANISM = process.env.KAFKA_SASL_MECHANISM || 'plain';
const KAFKA_SASL_USERNAME = process.env.KAFKA_SASL_USERNAME;
const KAFKA_SASL_PASSWORD = process.env.KAFKA_SASL_PASSWORD;
const KAFKA_SSL_CA_LOCATION = process.env.KAFKA_SSL_CA_LOCATION;
const KAFKA_SSL_CERT_LOCATION = process.env.KAFKA_SSL_CERT_LOCATION;
const KAFKA_SSL_KEY_LOCATION = process.env.KAFKA_SSL_KEY_LOCATION;
const KAFKA_RETRY_MAX_ATTEMPTS = parseInt(process.env.KAFKA_RETRY_MAX_ATTEMPTS || '5');
const KAFKA_RETRY_INITIAL_DELAY = parseInt(process.env.KAFKA_RETRY_INITIAL_DELAY || '300');
const KAFKA_CONNECTION_TIMEOUT = parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '3000');
const KAFKA_REQUEST_TIMEOUT = parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000');

// Enhanced Kafka configuration interface
export interface KafkaConfig extends KafkaJSConfig {
  ssl?: {
    enabled: boolean;
    ca?: string[];
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  };
  sasl?: {
    enabled: boolean;
    mechanism?: string;
    username?: string;
    password?: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    maxAttempts: number;
    initialRetryTime: number;
    maxRetryTime?: number;
  };
}

/**
 * Creates and configures a new Kafka client instance with enhanced security and monitoring
 */
export const createKafkaClient = (config?: Partial<KafkaConfig>): Kafka => {
  const defaultConfig: KafkaConfig = {
    clientId: KAFKA_CLIENT_ID,
    brokers: KAFKA_BROKERS,
    connectionTimeout: KAFKA_CONNECTION_TIMEOUT,
    requestTimeout: KAFKA_REQUEST_TIMEOUT,
    retry: {
      maxAttempts: KAFKA_RETRY_MAX_ATTEMPTS,
      initialRetryTime: KAFKA_RETRY_INITIAL_DELAY,
      maxRetryTime: KAFKA_RETRY_INITIAL_DELAY * 10
    }
  };

  // Configure SSL if enabled
  if (KAFKA_SSL_ENABLED) {
    defaultConfig.ssl = {
      enabled: true,
      rejectUnauthorized: true,
      ca: KAFKA_SSL_CA_LOCATION ? [KAFKA_SSL_CA_LOCATION] : undefined,
      cert: KAFKA_SSL_CERT_LOCATION,
      key: KAFKA_SSL_KEY_LOCATION
    };
  }

  // Configure SASL if enabled
  if (KAFKA_SASL_ENABLED) {
    defaultConfig.sasl = {
      enabled: true,
      mechanism: KAFKA_SASL_MECHANISM,
      username: KAFKA_SASL_USERNAME,
      password: KAFKA_SASL_PASSWORD
    };
  }

  const mergedConfig = { ...defaultConfig, ...config };
  Logger.info('Creating Kafka client with configuration', { 
    clientId: mergedConfig.clientId,
    brokers: mergedConfig.brokers,
    ssl: mergedConfig.ssl?.enabled,
    sasl: mergedConfig.sasl?.enabled
  });

  return new Kafka(mergedConfig);
};

/**
 * Creates a configured Kafka producer with reliability features and monitoring
 */
export const createProducer = async (client: Kafka): Promise<Producer> => {
  const producer = client.producer({
    allowAutoTopicCreation: false,
    transactionTimeout: 30000,
    maxInFlightRequests: 5,
    idempotent: true
  });

  producer.on('producer.connect', () => {
    Logger.info('Kafka producer connected');
    MetricsClient.recordKafkaMetric('producer_connected', 1);
  });

  producer.on('producer.disconnect', () => {
    Logger.warn('Kafka producer disconnected');
    MetricsClient.recordKafkaMetric('producer_connected', 0);
  });

  producer.on('producer.network.request_timeout', (error) => {
    Logger.error('Kafka producer request timeout', error);
    MetricsClient.recordKafkaError('producer_timeout');
  });

  await producer.connect();
  return producer;
};

/**
 * Creates a configured Kafka consumer with advanced monitoring
 */
export const createConsumer = async (client: Kafka, groupId: string): Promise<Consumer> => {
  const consumer = client.consumer({
    groupId,
    maxInFlightRequests: 5,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB
    retry: {
      maxAttempts: KAFKA_RETRY_MAX_ATTEMPTS,
      initialRetryTime: KAFKA_RETRY_INITIAL_DELAY,
      maxRetryTime: KAFKA_RETRY_INITIAL_DELAY * 10
    }
  });

  consumer.on('consumer.connect', () => {
    Logger.info('Kafka consumer connected', { groupId });
    MetricsClient.recordKafkaMetric('consumer_connected', 1, { groupId });
  });

  consumer.on('consumer.disconnect', () => {
    Logger.warn('Kafka consumer disconnected', { groupId });
    MetricsClient.recordKafkaMetric('consumer_connected', 0, { groupId });
  });

  consumer.on('consumer.group_join', ({ payload }) => {
    Logger.info('Consumer joined group', { 
      groupId,
      memberId: payload.memberId,
      assignments: payload.memberAssignment
    });
  });

  consumer.on('consumer.fetch_start', ({ payload }) => {
    MetricsClient.recordKafkaMetric('consumer_lag', payload.lag, { 
      groupId,
      topic: payload.topic,
      partition: payload.partition
    });
  });

  consumer.on('consumer.fetch', ({ payload }) => {
    MetricsClient.recordKafkaMetric('messages_consumed', payload.records.length, { 
      groupId,
      topic: payload.topic
    });
  });

  await consumer.connect();
  return consumer;
};