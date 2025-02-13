import axios, { AxiosInstance, AxiosError } from 'axios'; // v1.4.0
import rax from 'retry-axios'; // v3.0.0
import CircuitBreaker from 'opossum'; // v7.1.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { 
    IOneShieldConfig, 
    IOneShieldBillingRequest, 
    IOneShieldError,
    OneShieldTransactionType
} from './types';
import { logger } from '../../utils/logger';

/**
 * Client for interacting with OneShield's Billing API with enhanced error handling,
 * circuit breaker pattern, retry mechanism, and comprehensive monitoring.
 */
export class BillingClient {
    private readonly config: IOneShieldConfig;
    private readonly httpClient: AxiosInstance;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly metricsPrefix = 'oneshield.billing';

    constructor(config: IOneShieldConfig) {
        this.config = config;
        this.httpClient = this.initializeHttpClient();
        this.circuitBreaker = this.initializeCircuitBreaker();
    }

    /**
     * Processes a premium payment through OneShield's billing system
     * @param request Payment request details
     * @returns Promise resolving to payment success status
     */
    public async processPremiumPayment(request: IOneShieldBillingRequest): Promise<boolean> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            logger.info('Processing premium payment', {
                correlationId,
                policyId: request.policyId,
                amount: request.amount,
                transactionType: request.transactionType
            });

            const response = await this.circuitBreaker.fire(async () => {
                return this.httpClient.post('/billing/payments', {
                    ...request,
                    timestamp: new Date().toISOString()
                });
            });

            const duration = Date.now() - startTime;
            this.recordMetrics('processPremiumPayment', duration, true);

            logger.info('Premium payment processed successfully', {
                correlationId,
                policyId: request.policyId,
                transactionId: response.data.transactionId,
                duration
            });

            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.recordMetrics('processPremiumPayment', duration, false);
            throw this.handleError(error as Error, correlationId);
        }
    }

    /**
     * Processes commission payments for brokers/agents
     * @param request Commission payment details
     * @returns Promise resolving to payment success status
     */
    public async processCommission(request: IOneShieldBillingRequest): Promise<boolean> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            logger.info('Processing commission payment', {
                correlationId,
                policyId: request.policyId,
                amount: request.amount
            });

            const response = await this.circuitBreaker.fire(async () => {
                return this.httpClient.post('/billing/commission', {
                    ...request,
                    transactionType: OneShieldTransactionType.NEW_BUSINESS,
                    timestamp: new Date().toISOString()
                });
            });

            const duration = Date.now() - startTime;
            this.recordMetrics('processCommission', duration, true);

            logger.info('Commission payment processed successfully', {
                correlationId,
                policyId: request.policyId,
                transactionId: response.data.transactionId,
                duration
            });

            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.recordMetrics('processCommission', duration, false);
            throw this.handleError(error as Error, correlationId);
        }
    }

    /**
     * Retrieves billing statement for a policy
     * @param policyId Policy identifier
     * @returns Promise resolving to billing statement details
     */
    public async getBillingStatement(policyId: string): Promise<any> {
        const correlationId = uuidv4();
        const startTime = Date.now();

        try {
            logger.info('Retrieving billing statement', {
                correlationId,
                policyId
            });

            const response = await this.circuitBreaker.fire(async () => {
                return this.httpClient.get(`/billing/statements/${policyId}`);
            });

            const duration = Date.now() - startTime;
            this.recordMetrics('getBillingStatement', duration, true);

            logger.info('Billing statement retrieved successfully', {
                correlationId,
                policyId,
                duration
            });

            return response.data;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.recordMetrics('getBillingStatement', duration, false);
            throw this.handleError(error as Error, correlationId);
        }
    }

    /**
     * Initializes axios instance with interceptors and retry configuration
     */
    private initializeHttpClient(): AxiosInstance {
        const client = axios.create({
            baseURL: this.config.baseUrl,
            timeout: 30000,
            headers: {
                'X-API-Key': this.config.apiKey,
                'Content-Type': 'application/json'
            }
        });

        // Configure retry-axios
        const retryConfig = {
            retry: 3,
            retryDelay: (retryCount: number) => {
                return retryCount * 1000; // exponential backoff
            },
            httpMethodsToRetry: ['GET', 'POST', 'PUT'],
            statusCodesToRetry: [[408, 429, 500, 502, 503, 504]]
        };

        client.defaults.raxConfig = retryConfig;
        rax.attach(client);

        // Add request interceptor for correlation IDs
        client.interceptors.request.use((config) => {
            config.headers['X-Correlation-ID'] = uuidv4();
            return config;
        });

        return client;
    }

    /**
     * Initializes circuit breaker with configured thresholds
     */
    private initializeCircuitBreaker(): CircuitBreaker {
        return new CircuitBreaker(async (fn: Function) => fn(), {
            timeout: 30000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000,
            volumeThreshold: 10
        });
    }

    /**
     * Records metrics for monitoring and alerting
     */
    private recordMetrics(operation: string, duration: number, success: boolean): void {
        // Implementation would depend on metrics collection system
        // Example using StatsD or similar
        const tags = {
            operation,
            environment: this.config.environment,
            success: success.toString()
        };

        logger.debug('Recording metrics', {
            metric: `${this.metricsPrefix}.${operation}`,
            duration,
            success,
            tags
        });
    }

    /**
     * Handles and standardizes error responses
     */
    private handleError(error: Error, correlationId: string): IOneShieldError {
        const errorResponse: IOneShieldError = {
            code: 'BILLING_ERROR',
            message: error.message,
            details: {},
            timestamp: new Date().toISOString(),
            transactionId: correlationId
        };

        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            errorResponse.code = `ONESHIELD_${axiosError.response?.status || 500}`;
            errorResponse.details = axiosError.response?.data || {};
        }

        logger.error('OneShield billing operation failed', {
            correlationId,
            error: errorResponse,
            stack: error.stack
        });

        return errorResponse;
    }
}