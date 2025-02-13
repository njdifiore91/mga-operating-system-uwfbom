import { Producer } from 'kafkajs'; // v2.2.4
import { createKafkaClient, createProducer } from '../../config/kafka';
import { IUnderwritingDecision, IRiskAssessment } from '../../types/underwriting.types';
import { error, info } from '../../utils/logger';

// Topic names for underwriting events
const UNDERWRITING_TOPIC = 'mga-os.underwriting';
const RISK_ASSESSMENT_TOPIC = 'mga-os.risk-assessment';

/**
 * Handles production of underwriting-related events to Kafka topics with enhanced monitoring,
 * metrics collection, and robust error handling.
 */
export class UnderwritingEventProducer {
    private producer: Producer;

    /**
     * Initializes the Kafka producer with optimized settings for underwriting events
     */
    constructor() {
        try {
            const client = createKafkaClient({
                clientId: 'underwriting-event-producer',
                retry: {
                    maxAttempts: 5,
                    initialRetryTime: 300,
                    maxRetryTime: 3000
                }
            });

            this.producer = createProducer(client);

            info('UnderwritingEventProducer initialized successfully');
        } catch (err) {
            error('Failed to initialize UnderwritingEventProducer', err);
            throw err;
        }
    }

    /**
     * Publishes a risk assessment event to the risk assessment topic with monitoring
     * @param riskAssessment Risk assessment data to publish
     */
    public async publishRiskAssessment(riskAssessment: IRiskAssessment): Promise<void> {
        const startTime = Date.now();
        const correlationId = `risk-${riskAssessment.policyId}-${Date.now()}`;

        try {
            info('Publishing risk assessment event', {
                correlationId,
                policyId: riskAssessment.policyId,
                policyType: riskAssessment.policyType,
                riskScore: riskAssessment.riskScore
            });

            const message = {
                key: riskAssessment.policyId,
                value: JSON.stringify(riskAssessment),
                headers: {
                    correlationId,
                    eventType: 'RISK_ASSESSMENT',
                    timestamp: new Date().toISOString(),
                    version: '1.0'
                }
            };

            await this.producer.send({
                topic: RISK_ASSESSMENT_TOPIC,
                messages: [message],
                acks: -1, // Wait for all replicas
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            info('Successfully published risk assessment event', {
                correlationId,
                duration,
                topic: RISK_ASSESSMENT_TOPIC,
                policyId: riskAssessment.policyId
            });

        } catch (err) {
            error('Failed to publish risk assessment event', err, {
                correlationId,
                policyId: riskAssessment.policyId,
                topic: RISK_ASSESSMENT_TOPIC
            });
            throw err;
        }
    }

    /**
     * Publishes an underwriting decision event to the underwriting topic with monitoring
     * @param decision Underwriting decision data to publish
     */
    public async publishUnderwritingDecision(decision: IUnderwritingDecision): Promise<void> {
        const startTime = Date.now();
        const correlationId = `decision-${decision.policyId}-${Date.now()}`;

        try {
            info('Publishing underwriting decision event', {
                correlationId,
                policyId: decision.policyId,
                status: decision.status,
                automationLevel: decision.automationLevel
            });

            const message = {
                key: decision.policyId,
                value: JSON.stringify(decision),
                headers: {
                    correlationId,
                    eventType: 'UNDERWRITING_DECISION',
                    timestamp: new Date().toISOString(),
                    version: '1.0',
                    status: decision.status,
                    automationLevel: decision.automationLevel
                }
            };

            await this.producer.send({
                topic: UNDERWRITING_TOPIC,
                messages: [message],
                acks: -1, // Wait for all replicas
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            info('Successfully published underwriting decision event', {
                correlationId,
                duration,
                topic: UNDERWRITING_TOPIC,
                policyId: decision.policyId,
                status: decision.status
            });

        } catch (err) {
            error('Failed to publish underwriting decision event', err, {
                correlationId,
                policyId: decision.policyId,
                topic: UNDERWRITING_TOPIC,
                status: decision.status
            });
            throw err;
        }
    }

    /**
     * Gracefully disconnects the Kafka producer with cleanup
     */
    public async disconnect(): Promise<void> {
        try {
            info('Disconnecting UnderwritingEventProducer');
            await this.producer.disconnect();
            info('Successfully disconnected UnderwritingEventProducer');
        } catch (err) {
            error('Failed to disconnect UnderwritingEventProducer', err);
            throw err;
        }
    }
}