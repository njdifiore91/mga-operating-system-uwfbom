import axios, { AxiosInstance, AxiosError } from 'axios'; // ^1.4.0
import rax from 'retry-axios'; // ^3.0.0
import { CircuitBreaker } from 'circuit-breaker-ts'; // ^1.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { 
    IOneShieldConfig, 
    IOneShieldPolicyRequest, 
    IOneShieldPolicyResponse,
    IOneShieldError,
    OneShieldPolicyStatus
} from './types';
import { oneshieldConfig } from '../../config/oneshield';
import { logger } from '../../utils/logger';

/**
 * Client for interacting with OneShield Policy API with comprehensive retry,
 * circuit breaking, and error handling capabilities
 */
export class PolicyClient {
    private readonly config: IOneShieldConfig;
    private readonly httpClient: AxiosInstance;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly requestTimeout: number = 30000;

    constructor(config: IOneShieldConfig) {
        this.config = config;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,
            resetTimeout: oneshieldConfig.monitoring.circuitBreaker.resetTimeout,
            failureThresholdPercentage: oneshieldConfig.monitoring.circuitBreaker.threshold * 100
        });

        // Initialize Axios instance with base configuration
        this.httpClient = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.requestTimeout,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-Version': this.config.version
            },
            maxContentLength: 10 * 1024 * 1024, // 10MB
            maxBodyLength: 10 * 1024 * 1024 // 10MB
        });

        // Configure retry mechanism
        const retryConfig = {
            retry: this.config.retryConfig.maxRetries,
            retryDelay: (retryCount: number) => {
                const delay = Math.min(
                    this.config.retryConfig.initialDelay * Math.pow(this.config.retryConfig.backoffFactor, retryCount),
                    this.config.retryConfig.maxDelay
                );
                return delay;
            },
            statusCodesToRetry: [[408, 429, 500, 502, 503, 504]],
            onRetryAttempt: (err: AxiosError) => {
                const retryCount = rax.getConfig(err)?.currentRetryAttempt || 0;
                logger.warn('Retrying OneShield API request', {
                    retryCount,
                    error: err.message,
                    endpoint: err.config?.url
                });
            }
        };

        rax.attach(this.httpClient);
        this.httpClient.defaults.raxConfig = retryConfig;

        // Configure request interceptor
        this.httpClient.interceptors.request.use((config) => {
            config.headers['X-API-Key'] = this.config.apiKey;
            config.headers['X-Correlation-ID'] = uuidv4();
            return config;
        });

        // Configure response interceptor
        this.httpClient.interceptors.response.use(
            (response) => response,
            (error: AxiosError<IOneShieldError>) => {
                this.handleApiError(error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Creates a new policy in OneShield system with retry and circuit breaker protection
     */
    public async createPolicy(policyRequest: IOneShieldPolicyRequest): Promise<IOneShieldPolicyResponse> {
        const correlationId = uuidv4();
        logger.info('Creating policy in OneShield', {
            correlationId,
            policyNumber: policyRequest.policyNumber
        });

        try {
            await this.circuitBreaker.execute(async () => {
                const response = await this.httpClient.post<IOneShieldPolicyResponse>(
                    oneshieldConfig.policy.endpoints.create,
                    policyRequest
                );

                logger.info('Successfully created policy in OneShield', {
                    correlationId,
                    policyId: response.data.policyId,
                    status: response.data.status
                });

                return response.data;
            });

            const response = await this.httpClient.post<IOneShieldPolicyResponse>(
                oneshieldConfig.policy.endpoints.create,
                policyRequest
            );

            return response.data;
        } catch (error) {
            logger.error('Failed to create policy in OneShield', {
                correlationId,
                error,
                policyRequest
            });
            throw this.transformError(error as AxiosError<IOneShieldError>);
        }
    }

    /**
     * Retrieves policy details from OneShield with caching support
     */
    public async getPolicy(policyId: string): Promise<IOneShieldPolicyResponse> {
        const correlationId = uuidv4();
        logger.info('Retrieving policy from OneShield', {
            correlationId,
            policyId
        });

        try {
            await this.circuitBreaker.execute(async () => {
                const endpoint = oneshieldConfig.policy.endpoints.get.replace(':id', policyId);
                const response = await this.httpClient.get<IOneShieldPolicyResponse>(endpoint);

                logger.info('Successfully retrieved policy from OneShield', {
                    correlationId,
                    policyId,
                    status: response.data.status
                });

                return response.data;
            });

            const endpoint = oneshieldConfig.policy.endpoints.get.replace(':id', policyId);
            const response = await this.httpClient.get<IOneShieldPolicyResponse>(endpoint);

            return response.data;
        } catch (error) {
            logger.error('Failed to retrieve policy from OneShield', {
                correlationId,
                error,
                policyId
            });
            throw this.transformError(error as AxiosError<IOneShieldError>);
        }
    }

    /**
     * Updates an existing policy in OneShield with validation
     */
    public async updatePolicy(
        policyId: string,
        policyRequest: IOneShieldPolicyRequest
    ): Promise<IOneShieldPolicyResponse> {
        const correlationId = uuidv4();
        logger.info('Updating policy in OneShield', {
            correlationId,
            policyId,
            policyNumber: policyRequest.policyNumber
        });

        try {
            await this.circuitBreaker.execute(async () => {
                const endpoint = oneshieldConfig.policy.endpoints.update.replace(':id', policyId);
                const response = await this.httpClient.put<IOneShieldPolicyResponse>(
                    endpoint,
                    policyRequest
                );

                logger.info('Successfully updated policy in OneShield', {
                    correlationId,
                    policyId,
                    status: response.data.status
                });

                return response.data;
            });

            const endpoint = oneshieldConfig.policy.endpoints.update.replace(':id', policyId);
            const response = await this.httpClient.put<IOneShieldPolicyResponse>(
                endpoint,
                policyRequest
            );

            return response.data;
        } catch (error) {
            logger.error('Failed to update policy in OneShield', {
                correlationId,
                error,
                policyId,
                policyRequest
            });
            throw this.transformError(error as AxiosError<IOneShieldError>);
        }
    }

    /**
     * Handles and transforms OneShield API errors
     */
    private handleApiError(error: AxiosError<IOneShieldError>): never {
        const errorResponse = error.response?.data;
        const status = error.response?.status;

        logger.error('OneShield API error', {
            status,
            error: errorResponse,
            request: {
                method: error.config?.method,
                url: error.config?.url
            }
        });

        throw this.transformError(error);
    }

    /**
     * Transforms API errors into standardized format
     */
    private transformError(error: AxiosError<IOneShieldError>): Error {
        const status = error.response?.status;
        const errorResponse = error.response?.data;

        if (errorResponse) {
            return new Error(`OneShield API Error (${status}): ${errorResponse.message}`);
        }

        if (error.code === 'ECONNABORTED') {
            return new Error('OneShield API request timeout');
        }

        return new Error('Unknown OneShield API error');
    }
}