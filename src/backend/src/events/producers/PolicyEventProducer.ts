import { Producer } from 'kafkajs'; // v2.2.4
import { createKafkaClient, createProducer } from '../../config/kafka';
import { IPolicy } from '../../types/policy.types';
import { Logger } from '../../utils/logger';
import { MetricsClient } from '../../utils/metrics';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Topic constants
const POLICY_EVENTS_TOPIC = 'mga-os.policy-events';
const POLICY_STATUS_TOPIC = 'mga-os.policy-status';

/**
 * Handles production of policy-related events to Kafka topics with guaranteed delivery,
 * monitoring, and optimized performance
 */
export class PolicyEventProducer {
    private producer: Producer;
    private readonly logger: typeof Logger;
    private readonly metricsClient: typeof MetricsClient;

    constructor() {
        this.logger = Logger;
        this.metricsClient = MetricsClient;
        this.initialize();
    }

    /**
     * Initializes the Kafka producer with optimized settings
     */
    private async initialize(): Promise<void> {
        try {
            const kafkaClient = createKafkaClient();
            this.producer = await createProducer(kafkaClient);

            // Configure producer settings
            await this.producer.connect();
            
            this.logger.info('PolicyEventProducer initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize PolicyEventProducer', error);
            throw error;
        }
    }

    /**
     * Publishes a policy creation event with guaranteed delivery and monitoring
     */
    public async publishPolicyCreated(policy: IPolicy): Promise<void> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            const event = {
                type: 'POLICY_CREATED',
                timestamp: new Date().toISOString(),
                correlationId,
                data: {
                    policyId: policy.id,
                    policyNumber: policy.policyNumber,
                    status: policy.status,
                    effectiveDate: policy.effectiveDate,
                    premium: policy.premium
                }
            };

            await this.producer.send({
                topic: POLICY_EVENTS_TOPIC,
                messages: [{
                    key: policy.id,
                    value: JSON.stringify(event),
                    headers: {
                        correlationId,
                        eventType: 'POLICY_CREATED'
                    }
                }],
                acks: -1, // Wait for all replicas
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            this.metricsClient.recordKafkaMetric('policy_event_published', 1, {
                eventType: 'POLICY_CREATED',
                topic: POLICY_EVENTS_TOPIC
            });
            this.metricsClient.recordKafkaMetric('policy_event_latency', duration);

            this.logger.info('Policy created event published successfully', {
                correlationId,
                policyId: policy.id,
                duration
            });
        } catch (error) {
            this.logger.error('Failed to publish policy created event', error, {
                correlationId,
                policyId: policy.id
            });
            throw error;
        }
    }

    /**
     * Publishes a policy update event with idempotence guarantees
     */
    public async publishPolicyUpdated(policy: IPolicy): Promise<void> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            const event = {
                type: 'POLICY_UPDATED',
                timestamp: new Date().toISOString(),
                correlationId,
                data: {
                    policyId: policy.id,
                    policyNumber: policy.policyNumber,
                    status: policy.status,
                    updatedAt: policy.updatedAt
                }
            };

            await this.producer.send({
                topic: POLICY_EVENTS_TOPIC,
                messages: [{
                    key: policy.id,
                    value: JSON.stringify(event),
                    headers: {
                        correlationId,
                        eventType: 'POLICY_UPDATED'
                    }
                }],
                acks: -1,
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            this.metricsClient.recordKafkaMetric('policy_event_published', 1, {
                eventType: 'POLICY_UPDATED',
                topic: POLICY_EVENTS_TOPIC
            });
            this.metricsClient.recordKafkaMetric('policy_event_latency', duration);

            this.logger.info('Policy updated event published successfully', {
                correlationId,
                policyId: policy.id,
                duration
            });
        } catch (error) {
            this.logger.error('Failed to publish policy updated event', error, {
                correlationId,
                policyId: policy.id
            });
            throw error;
        }
    }

    /**
     * Publishes a policy status change event with ordering guarantees
     */
    public async publishPolicyStatusChanged(policy: IPolicy, previousStatus: string): Promise<void> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            const event = {
                type: 'POLICY_STATUS_CHANGED',
                timestamp: new Date().toISOString(),
                correlationId,
                data: {
                    policyId: policy.id,
                    policyNumber: policy.policyNumber,
                    previousStatus,
                    currentStatus: policy.status,
                    updatedAt: policy.updatedAt
                }
            };

            await this.producer.send({
                topic: POLICY_STATUS_TOPIC,
                messages: [{
                    key: policy.id,
                    value: JSON.stringify(event),
                    headers: {
                        correlationId,
                        eventType: 'POLICY_STATUS_CHANGED'
                    }
                }],
                acks: -1,
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            this.metricsClient.recordKafkaMetric('policy_event_published', 1, {
                eventType: 'POLICY_STATUS_CHANGED',
                topic: POLICY_STATUS_TOPIC
            });
            this.metricsClient.recordKafkaMetric('policy_event_latency', duration);

            this.logger.info('Policy status change event published successfully', {
                correlationId,
                policyId: policy.id,
                previousStatus,
                currentStatus: policy.status,
                duration
            });
        } catch (error) {
            this.logger.error('Failed to publish policy status change event', error, {
                correlationId,
                policyId: policy.id
            });
            throw error;
        }
    }

    /**
     * Gracefully shuts down the Kafka producer with cleanup
     */
    public async shutdown(): Promise<void> {
        try {
            await this.producer.disconnect();
            this.logger.info('PolicyEventProducer shut down successfully');
        } catch (error) {
            this.logger.error('Error shutting down PolicyEventProducer', error);
            throw error;
        }
    }
}

export default PolicyEventProducer;