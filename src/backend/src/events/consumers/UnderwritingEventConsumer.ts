/**
 * @file Kafka consumer implementation for underwriting event processing
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Injectable } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { CircuitBreaker } from 'opossum';
import { MetricsService } from '@prometheus/client';
import { UnderwritingService } from '../../services/UnderwritingService';
import { createKafkaClient, createConsumer } from '../../config/kafka';
import { error, info, debug } from '../../utils/logger';
import { IUnderwritingDecision, UnderwritingStatus } from '../../types/underwriting.types';
import { PolicyType } from '../../constants/policyTypes';

// Kafka configuration constants
const UNDERWRITING_TOPIC = 'underwriting.requests';
const CONSUMER_GROUP_ID = 'underwriting-service-group';
const DLQ_TOPIC = 'underwriting.dlq';
const MAX_RETRIES = 3;

@Injectable()
export class UnderwritingEventConsumer {
    private consumer: Consumer;
    private isRunning: boolean = false;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(
        private readonly underwritingService: UnderwritingService,
        private readonly metricsService: MetricsService
    ) {
        // Initialize circuit breaker for OneShield integration
        this.circuitBreaker = new CircuitBreaker(
            async (decision: IUnderwritingDecision) => {
                return await this.underwritingService.syncWithOneShield(decision, decision.riskAssessment.policyType);
            },
            {
                timeout: 10000, // 10 second timeout
                errorThresholdPercentage: 50,
                resetTimeout: 30000, // 30 second reset
                name: 'oneshield-sync'
            }
        );

        // Circuit breaker event handlers
        this.circuitBreaker.on('open', () => {
            error('OneShield circuit breaker opened');
            this.metricsService.recordKafkaMetric('circuit_breaker_state', 0);
        });

        this.circuitBreaker.on('close', () => {
            info('OneShield circuit breaker closed');
            this.metricsService.recordKafkaMetric('circuit_breaker_state', 1);
        });
    }

    /**
     * Starts the Kafka consumer with enhanced monitoring
     */
    public async start(): Promise<void> {
        try {
            const kafkaClient = createKafkaClient();
            this.consumer = await createConsumer(kafkaClient, CONSUMER_GROUP_ID);

            await this.consumer.subscribe({
                topic: UNDERWRITING_TOPIC,
                fromBeginning: false
            });

            this.isRunning = true;

            await this.consumer.run({
                autoCommit: false,
                eachBatchAutoResolve: true,
                eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
                    const startTime = Date.now();
                    const correlationId = `batch-${batch.firstOffset()}-${batch.lastOffset()}`;

                    debug('Processing underwriting batch', {
                        correlationId,
                        messageCount: batch.messages.length,
                        topic: batch.topic,
                        partition: batch.partition
                    });

                    for (const message of batch.messages) {
                        try {
                            await this.processUnderwritingRequest(message);
                            await resolveOffset(message.offset);
                            await heartbeat();
                        } catch (err) {
                            error('Failed to process underwriting message', err, {
                                correlationId,
                                messageOffset: message.offset
                            });

                            // Handle DLQ routing
                            if (message.headers?.retryCount >= MAX_RETRIES) {
                                await this.routeToDLQ(message);
                            }
                        }
                    }

                    await commitOffsetsIfNecessary();

                    // Record batch processing metrics
                    const processingTime = Date.now() - startTime;
                    this.metricsService.recordKafkaMetric('batch_processing_time', processingTime, {
                        topic: batch.topic,
                        partition: batch.partition.toString()
                    });
                }
            });

            info('Underwriting event consumer started successfully');
        } catch (err) {
            error('Failed to start underwriting event consumer', err);
            throw err;
        }
    }

    /**
     * Gracefully stops the Kafka consumer
     */
    public async stop(): Promise<void> {
        try {
            this.isRunning = false;
            await this.consumer?.disconnect();
            info('Underwriting event consumer stopped successfully');
        } catch (err) {
            error('Error stopping underwriting event consumer', err);
            throw err;
        }
    }

    /**
     * Processes an individual underwriting request message
     */
    private async processUnderwritingRequest(message: any): Promise<void> {
        const startTime = Date.now();
        const correlationId = `msg-${message.offset}-${Date.now()}`;

        try {
            const payload = JSON.parse(message.value.toString());
            
            // Validate message schema
            if (!payload.policyId || !payload.policyType) {
                throw new Error('Invalid message schema');
            }

            // Perform risk assessment
            const riskAssessment = await this.underwritingService.assessRisk(
                payload.policyId,
                payload.policyType as PolicyType,
                true // Use cache
            );

            // Make underwriting decision
            const decision = await this.underwritingService.makeUnderwritingDecision(
                riskAssessment,
                payload.policyType as PolicyType
            );

            // Sync with OneShield using circuit breaker
            if (decision.status === UnderwritingStatus.APPROVED) {
                await this.circuitBreaker.fire(decision);
            }

            // Record processing metrics
            const processingTime = Date.now() - startTime;
            this.metricsService.recordKafkaMetric('message_processing_time', processingTime, {
                topic: UNDERWRITING_TOPIC,
                status: decision.status
            });

            info('Processed underwriting request successfully', {
                correlationId,
                policyId: payload.policyId,
                decision: decision.status,
                processingTime
            });
        } catch (err) {
            error('Error processing underwriting request', err, { correlationId });
            throw err;
        }
    }

    /**
     * Routes failed messages to DLQ after max retries
     */
    private async routeToDLQ(message: any): Promise<void> {
        try {
            const kafkaClient = createKafkaClient();
            const producer = kafkaClient.producer();
            await producer.connect();

            await producer.send({
                topic: DLQ_TOPIC,
                messages: [{
                    key: message.key,
                    value: message.value,
                    headers: {
                        ...message.headers,
                        failureReason: 'Max retries exceeded',
                        originalTopic: UNDERWRITING_TOPIC,
                        timestamp: Date.now().toString()
                    }
                }]
            });

            await producer.disconnect();
            
            info('Routed failed message to DLQ', {
                messageOffset: message.offset,
                dlqTopic: DLQ_TOPIC
            });
        } catch (err) {
            error('Failed to route message to DLQ', err);
        }
    }

    /**
     * Returns the health status of the consumer
     */
    public async healthCheck(): Promise<boolean> {
        return this.isRunning && this.consumer?.isRunning();
    }
}

export { UnderwritingEventConsumer };