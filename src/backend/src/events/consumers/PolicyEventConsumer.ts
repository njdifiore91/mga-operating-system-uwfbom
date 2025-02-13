/**
 * @file Advanced Kafka consumer implementation for policy-related events
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs'; // v2.2.4
import { retry } from 'retry-ts'; // v1.0.0
import { CircuitBreaker } from 'circuit-breaker-js'; // v1.0.1
import { MetricsService } from 'prometheus-client'; // v1.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { PolicyService } from '../../services/PolicyService';
import { IPolicy, PolicyStatus } from '../../types/policy.types';
import { logger } from '../../utils/logger';
import { oneshieldConfig } from '../../config/oneshield';

// Constants for consumer configuration
const CONSUMER_GROUP = 'policy-service';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const PROCESSING_TIMEOUT = 30000;
const BATCH_SIZE = 100;

/**
 * Advanced Kafka consumer for handling policy-related events with comprehensive
 * error handling, monitoring, and OneShield integration
 */
export class PolicyEventConsumer {
    private readonly consumer: Consumer;
    private readonly policyService: PolicyService;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly metricsService: MetricsService;
    private readonly processedEvents: Map<string, number>;
    private isRunning: boolean;

    constructor(
        consumer: Consumer,
        policyService: PolicyService,
        circuitBreaker: CircuitBreaker,
        metricsService: MetricsService
    ) {
        this.consumer = consumer;
        this.policyService = policyService;
        this.circuitBreaker = circuitBreaker;
        this.metricsService = metricsService;
        this.processedEvents = new Map();
        this.isRunning = false;

        // Initialize metrics collectors
        this.initializeMetrics();
    }

    /**
     * Initializes Prometheus metrics collectors
     * @private
     */
    private initializeMetrics(): void {
        this.metricsService.createCounter({
            name: 'policy_events_processed_total',
            help: 'Total number of policy events processed'
        });

        this.metricsService.createGauge({
            name: 'policy_events_processing_duration_seconds',
            help: 'Duration of policy event processing in seconds'
        });

        this.metricsService.createCounter({
            name: 'policy_events_errors_total',
            help: 'Total number of policy event processing errors'
        });
    }

    /**
     * Starts the Kafka consumer with enhanced error handling and monitoring
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        const correlationId = uuidv4();
        logger.info('Starting PolicyEventConsumer', { correlationId });

        try {
            await this.consumer.connect();

            await this.consumer.subscribe({
                topic: 'policy-events',
                fromBeginning: false
            });

            this.isRunning = true;

            await this.consumer.run({
                partitionsConsumedConcurrently: 3,
                eachMessage: async (payload: EachMessagePayload) => {
                    await this.handleMessage(payload);
                }
            });

            logger.info('PolicyEventConsumer started successfully', { correlationId });
        } catch (error) {
            logger.error('Failed to start PolicyEventConsumer', { correlationId, error });
            throw error;
        }
    }

    /**
     * Handles incoming Kafka messages with comprehensive error handling and monitoring
     * @private
     */
    private async handleMessage(payload: EachMessagePayload): Promise<void> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            const { topic, partition, message } = payload;
            const eventId = message.key?.toString();

            if (!eventId) {
                throw new Error('Missing event ID');
            }

            // Check for duplicate processing
            if (this.processedEvents.has(eventId)) {
                logger.warn('Duplicate event detected', { correlationId, eventId });
                return;
            }

            logger.info('Processing policy event', {
                correlationId,
                eventId,
                topic,
                partition
            });

            const event = this.parseEvent(message);
            await this.processEvent(event, correlationId);

            // Record successful processing
            this.processedEvents.set(eventId, Date.now());
            this.metricsService.increment('policy_events_processed_total');
            
            const duration = (Date.now() - startTime) / 1000;
            this.metricsService.gauge('policy_events_processing_duration_seconds', duration);

            logger.info('Successfully processed policy event', {
                correlationId,
                eventId,
                duration
            });

        } catch (error) {
            this.metricsService.increment('policy_events_errors_total');
            
            logger.error('Failed to process policy event', {
                correlationId,
                error,
                duration: (Date.now() - startTime) / 1000
            });

            // Handle dead letter queue if needed
            await this.handleDeadLetter(payload, error);
            
            throw error;
        }
    }

    /**
     * Processes policy event with circuit breaker and retry patterns
     * @private
     */
    private async processEvent(event: any, correlationId: string): Promise<void> {
        await this.circuitBreaker.fire(async () => {
            await retry(
                async () => {
                    switch (event.type) {
                        case 'POLICY_CREATED':
                            await this.handlePolicyCreated(event.payload);
                            break;

                        case 'POLICY_UPDATED':
                            await this.handlePolicyUpdated(event.payload);
                            break;

                        case 'POLICY_CANCELLED':
                            await this.handlePolicyCancelled(event.payload);
                            break;

                        default:
                            logger.warn('Unknown event type', {
                                correlationId,
                                eventType: event.type
                            });
                    }
                },
                {
                    retries: MAX_RETRIES,
                    delay: INITIAL_RETRY_DELAY,
                    onRetry: (error) => {
                        logger.warn('Retrying event processing', {
                            correlationId,
                            error: error.message,
                            eventType: event.type
                        });
                    }
                }
            );
        });
    }

    /**
     * Handles policy creation events
     * @private
     */
    private async handlePolicyCreated(payload: IPolicy): Promise<void> {
        await this.policyService.createPolicy(payload);
    }

    /**
     * Handles policy update events
     * @private
     */
    private async handlePolicyUpdated(payload: { id: string; updates: Partial<IPolicy> }): Promise<void> {
        await this.policyService.updatePolicy(payload.id, payload.updates);
    }

    /**
     * Handles policy cancellation events
     * @private
     */
    private async handlePolicyCancelled(payload: { id: string }): Promise<void> {
        await this.policyService.updatePolicy(payload.id, {
            status: PolicyStatus.CANCELLED
        });
    }

    /**
     * Parses Kafka message into event object
     * @private
     */
    private parseEvent(message: KafkaMessage): any {
        try {
            return JSON.parse(message.value?.toString() || '');
        } catch (error) {
            throw new Error(`Invalid event format: ${error.message}`);
        }
    }

    /**
     * Handles dead letter queue processing for failed events
     * @private
     */
    private async handleDeadLetter(payload: EachMessagePayload, error: Error): Promise<void> {
        const deadLetterTopic = 'policy-events-dlq';
        const correlationId = uuidv4();

        try {
            await this.consumer.send({
                topic: deadLetterTopic,
                messages: [{
                    key: payload.message.key,
                    value: payload.message.value,
                    headers: {
                        'X-Error-Message': Buffer.from(error.message),
                        'X-Original-Topic': Buffer.from(payload.topic),
                        'X-Correlation-ID': Buffer.from(correlationId)
                    }
                }]
            });

            logger.info('Message sent to dead letter queue', {
                correlationId,
                topic: deadLetterTopic,
                originalTopic: payload.topic
            });
        } catch (dlqError) {
            logger.error('Failed to send message to dead letter queue', {
                correlationId,
                error: dlqError
            });
        }
    }

    /**
     * Gracefully stops the consumer
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        const correlationId = uuidv4();
        logger.info('Stopping PolicyEventConsumer', { correlationId });

        try {
            await this.consumer.disconnect();
            this.isRunning = false;
            logger.info('PolicyEventConsumer stopped successfully', { correlationId });
        } catch (error) {
            logger.error('Error stopping PolicyEventConsumer', { correlationId, error });
            throw error;
        }
    }
}

export default PolicyEventConsumer;