import { injectable } from 'inversify';
import { Consumer, KafkaMessage } from 'kafkajs';
import { retry } from 'retry-ts';
import CircuitBreaker from 'opossum';
import { MetricsCollector } from '@opentelemetry/metrics';
import { Claim } from '../../types/claims.types';
import { ClaimsService } from '../../services/ClaimsService';
import { Logger } from '../../utils/logger';
import { createKafkaClient, createConsumer } from '../../config/kafka';
import { metricsManager } from '../../utils/metrics';

// Kafka configuration
const CLAIMS_TOPIC = 'mga-os.claims';
const CLAIMS_STATUS_TOPIC = 'mga-os.claims.status';
const CONSUMER_GROUP = 'claims-processor';
const DLQ_TOPIC = 'mga-os.claims.dlq';

// Circuit breaker configuration
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10
};

// Retry configuration
const RETRY_OPTIONS = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffFactor: 2
};

/**
 * Advanced Kafka consumer implementation for processing claims-related events
 * with comprehensive error handling, monitoring, and OneShield integration.
 */
@injectable()
export class ClaimsEventConsumer {
  private consumer: Consumer;
  private readonly claimsService: ClaimsService;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly metricsCollector: MetricsCollector;
  private isRunning: boolean = false;
  private healthCheck: NodeJS.Timeout;

  constructor(
    claimsService: ClaimsService,
    circuitBreaker: CircuitBreaker,
    metricsCollector: MetricsCollector
  ) {
    this.claimsService = claimsService;
    this.circuitBreaker = new CircuitBreaker(this.processMessage.bind(this), CIRCUIT_BREAKER_OPTIONS);
    this.metricsCollector = metricsCollector;
    this.setupCircuitBreakerEvents();
  }

  /**
   * Initializes and starts the Kafka consumer with monitoring
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('Claims event consumer already running');
      return;
    }

    try {
      const startTime = Date.now();
      const kafka = createKafkaClient();
      this.consumer = await createConsumer(kafka, CONSUMER_GROUP);

      // Subscribe to claims topics
      await this.consumer.subscribe({
        topics: [CLAIMS_TOPIC, CLAIMS_STATUS_TOPIC],
        fromBeginning: false
      });

      // Start consuming messages
      await this.consumer.run({
        partitionsConsumedConcurrently: 3,
        eachBatchAutoResolve: true,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          for (const message of batch.messages) {
            if (!isRunning() || isStale()) break;

            try {
              await this.handleMessage(message);
              await resolveOffset(message.offset);
              await heartbeat();
            } catch (error) {
              Logger.error('Error processing batch message', error, {
                topic: batch.topic,
                partition: batch.partition,
                offset: message.offset
              });
            }
          }
        }
      });

      this.isRunning = true;
      this.setupHealthCheck();

      const duration = Date.now() - startTime;
      Logger.info('Claims event consumer started successfully', { duration });
      
      metricsManager.recordCacheMetrics({
        operation: 'consumer_start',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });
    } catch (error) {
      Logger.error('Failed to start claims event consumer', error);
      throw error;
    }
  }

  /**
   * Gracefully stops the consumer and cleans up resources
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const startTime = Date.now();
      this.isRunning = false;
      clearInterval(this.healthCheck);

      // Wait for in-flight messages to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      await this.consumer.disconnect();
      
      const duration = Date.now() - startTime;
      Logger.info('Claims event consumer stopped successfully', { duration });

      metricsManager.recordCacheMetrics({
        operation: 'consumer_stop',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });
    } catch (error) {
      Logger.error('Error stopping claims event consumer', error);
      throw error;
    }
  }

  /**
   * Processes incoming Kafka messages with comprehensive error handling
   */
  private async handleMessage(message: KafkaMessage): Promise<void> {
    const startTime = Date.now();
    const messageId = message.key?.toString();

    try {
      // Validate message structure
      if (!message.value) {
        throw new Error('Empty message value received');
      }

      // Parse message with error handling
      const event = JSON.parse(message.value.toString());
      
      // Process message through circuit breaker
      await this.circuitBreaker.fire(event);

      const duration = Date.now() - startTime;
      Logger.info('Message processed successfully', {
        messageId,
        duration,
        topic: message.topic
      });

      metricsManager.recordCacheMetrics({
        operation: 'message_process',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });
    } catch (error) {
      Logger.error('Error processing message', error, { messageId });

      // Implement retry logic with exponential backoff
      await retry(
        async () => this.processMessageWithRetry(message),
        RETRY_OPTIONS
      );

      // If retries exhausted, send to DLQ
      await this.sendToDLQ(message, error);
    }
  }

  /**
   * Processes messages with retry logic and monitoring
   */
  private async processMessageWithRetry(message: KafkaMessage): Promise<void> {
    const event = JSON.parse(message.value!.toString());
    
    switch (event.eventType) {
      case 'CLAIM_CREATED':
        await this.claimsService.createClaim(event.payload);
        break;
      case 'CLAIM_STATUS_CHANGED':
        await this.claimsService.updateClaimStatus(
          event.payload.claimId,
          event.payload
        );
        break;
      default:
        throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }

  /**
   * Sends failed messages to Dead Letter Queue
   */
  private async sendToDLQ(message: KafkaMessage, error: Error): Promise<void> {
    try {
      const kafka = createKafkaClient();
      const producer = await kafka.producer();
      
      await producer.send({
        topic: DLQ_TOPIC,
        messages: [{
          key: message.key,
          value: message.value,
          headers: {
            ...message.headers,
            error: error.message,
            originalTopic: message.topic,
            failedAt: new Date().toISOString()
          }
        }]
      });

      Logger.info('Message sent to DLQ', {
        messageId: message.key?.toString(),
        error: error.message
      });
    } catch (dlqError) {
      Logger.error('Failed to send message to DLQ', dlqError, {
        messageId: message.key?.toString()
      });
    }
  }

  /**
   * Sets up circuit breaker event handlers and monitoring
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      Logger.warn('Circuit breaker opened');
      metricsManager.recordCacheMetrics({
        operation: 'circuit_breaker_open',
        hitRate: 0,
        memoryUsage: 0,
        evictionCount: 0,
        latency: 0
      });
    });

    this.circuitBreaker.on('halfOpen', () => {
      Logger.info('Circuit breaker half-open');
    });

    this.circuitBreaker.on('close', () => {
      Logger.info('Circuit breaker closed');
      metricsManager.recordCacheMetrics({
        operation: 'circuit_breaker_closed',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: 0
      });
    });
  }

  /**
   * Sets up periodic health checks for the consumer
   */
  private setupHealthCheck(): void {
    this.healthCheck = setInterval(() => {
      if (this.consumer.isRunning()) {
        metricsManager.recordCacheMetrics({
          operation: 'consumer_health',
          hitRate: 1,
          memoryUsage: 0,
          evictionCount: 0,
          latency: 0
        });
      } else {
        Logger.error('Consumer health check failed');
        metricsManager.recordCacheMetrics({
          operation: 'consumer_health',
          hitRate: 0,
          memoryUsage: 0,
          evictionCount: 0,
          latency: 0
        });
      }
    }, 30000); // Every 30 seconds
  }
}