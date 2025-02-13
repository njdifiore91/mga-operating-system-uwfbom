import { Producer } from 'kafkajs'; // v2.2.4
import { Logger } from '../../utils/logger'; // v3.8.2
import { Claim } from '../../types/claims.types';
import { CLAIM_STATUS } from '../../constants/claimStatus';
import { createProducer } from '../../config/kafka';
import { metricsManager } from '../../utils/metrics';

// Kafka topics for claims events
const CLAIMS_TOPIC = 'mga-os.claims';
const CLAIMS_STATUS_TOPIC = 'mga-os.claims.status';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Decorator for implementing retry logic with exponential backoff
 */
function retryable(maxRetries: number, initialDelay: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      let delay = initialDelay;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;
          if (attempt === maxRetries) break;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          
          Logger.warn(`Retrying ${propertyKey} after failure`, {
            attempt,
            error: lastError.message,
            nextDelay: delay
          });
        }
      }
      throw lastError;
    };
    return descriptor;
  };
}

/**
 * Manages the production of claims-related events to Kafka topics with comprehensive
 * error handling, monitoring, and lifecycle management.
 */
export class ClaimsEventProducer {
  private producer: Producer;
  private logger: Logger;
  private isInitialized: boolean;

  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initializes the Kafka producer with monitoring and health checks
   */
  public async initialize(): Promise<void> {
    try {
      const kafkaClient = createProducer();
      this.producer = await kafkaClient;
      this.isInitialized = true;

      Logger.info('Claims event producer initialized successfully');
      metricsManager.recordCacheMetrics({
        operation: 'producer_init',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: 0
      });
    } catch (error) {
      Logger.error('Failed to initialize claims event producer', error);
      throw error;
    }
  }

  /**
   * Publishes a claim creation event to the claims topic
   */
  @retryable(MAX_RETRIES, RETRY_DELAY_MS)
  public async publishClaimCreated(claim: Claim): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Producer not initialized');
    }

    const event = {
      eventType: 'CLAIM_CREATED',
      timestamp: new Date().toISOString(),
      payload: {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        policyId: claim.policyId,
        status: claim.status,
        incidentDate: claim.incidentDate,
        reportedDate: claim.reportedDate,
        claimantInfo: claim.claimantInfo,
        location: claim.location,
        reserveAmount: claim.reserveAmount
      }
    };

    try {
      const startTime = Date.now();
      await this.producer.send({
        topic: CLAIMS_TOPIC,
        messages: [{
          key: claim.id,
          value: JSON.stringify(event),
          headers: {
            'correlation-id': `claim-${claim.id}`,
            'event-type': 'CLAIM_CREATED',
            'timestamp': new Date().toISOString()
          }
        }]
      });

      const duration = Date.now() - startTime;
      Logger.info('Claim creation event published successfully', {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        duration
      });

      metricsManager.recordCacheMetrics({
        operation: 'publish_claim',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });
    } catch (error) {
      Logger.error('Failed to publish claim creation event', error, {
        claimId: claim.id,
        claimNumber: claim.claimNumber
      });
      throw error;
    }
  }

  /**
   * Publishes a claim status change event to the status topic
   */
  @retryable(MAX_RETRIES, RETRY_DELAY_MS)
  public async publishClaimStatusChanged(claim: Claim, newStatus: CLAIM_STATUS): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Producer not initialized');
    }

    const event = {
      eventType: 'CLAIM_STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      payload: {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        previousStatus: claim.status,
        newStatus: newStatus,
        updatedAt: new Date().toISOString()
      }
    };

    try {
      const startTime = Date.now();
      await this.producer.send({
        topic: CLAIMS_STATUS_TOPIC,
        messages: [{
          key: claim.id,
          value: JSON.stringify(event),
          headers: {
            'correlation-id': `claim-status-${claim.id}`,
            'event-type': 'CLAIM_STATUS_CHANGED',
            'timestamp': new Date().toISOString()
          }
        }]
      });

      const duration = Date.now() - startTime;
      Logger.info('Claim status change event published successfully', {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        previousStatus: claim.status,
        newStatus,
        duration
      });

      metricsManager.recordCacheMetrics({
        operation: 'publish_status_change',
        hitRate: 1,
        memoryUsage: 0,
        evictionCount: 0,
        latency: duration
      });
    } catch (error) {
      Logger.error('Failed to publish claim status change event', error, {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        newStatus
      });
      throw error;
    }
  }

  /**
   * Gracefully shuts down the Kafka producer
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.producer.disconnect();
      this.isInitialized = false;
      Logger.info('Claims event producer shut down successfully');
    } catch (error) {
      Logger.error('Error shutting down claims event producer', error);
      throw error;
    }
  }
}

export default ClaimsEventProducer;