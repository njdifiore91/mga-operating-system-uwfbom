/**
 * Underwriting API Client Implementation
 * Provides secure and reliable access to underwriting operations with enhanced monitoring
 * @version 1.0.0
 */

import CircuitBreaker from 'opossum'; // ^6.0.0
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';

// Circuit breaker configuration for underwriting operations
const UNDERWRITING_CIRCUIT_BREAKER = new CircuitBreaker(
  async (promise: Promise<any>) => promise,
  {
    timeout: 30000, // 30 second timeout
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: 'underwriting-operations'
  }
);

// Types for risk assessment data
interface IRiskFactor {
  id: string;
  name: string;
  score: number;
  weight: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  details: Record<string, unknown>;
}

interface IRiskAssessmentDisplay {
  policyId: string;
  overallScore: number;
  recommendation: 'APPROVE' | 'REJECT' | 'REFER';
  factors: IRiskFactor[];
  timestamp: string;
  confidence: number;
}

interface IUnderwritingSubmission {
  policyId: string;
  riskData: {
    propertyDetails?: Record<string, unknown>;
    claimsHistory?: Record<string, unknown>;
    creditScore?: number;
    additionalFactors?: Record<string, unknown>;
  };
  documents: Array<{
    id: string;
    type: string;
    verified: boolean;
  }>;
}

/**
 * Retrieves risk assessment data for a specific policy
 * @param policyId Unique identifier of the policy
 * @returns Promise resolving to formatted risk assessment data
 */
export async function getRiskAssessment(
  policyId: string
): Promise<IRiskAssessmentDisplay> {
  try {
    // Validate policy ID format
    if (!policyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new Error('Invalid policy ID format');
    }

    // Add correlation ID for request tracking
    const correlationId = crypto.randomUUID();

    // Make request with circuit breaker protection
    const response = await UNDERWRITING_CIRCUIT_BREAKER.fire(
      apiClient.get<IRiskAssessmentDisplay>(
        `${API_ENDPOINTS.UNDERWRITING.BASE}/risk-assessment/${policyId}`,
        {
          headers: {
            'X-Correlation-ID': correlationId,
            'X-Request-Source': 'web-client',
            'Cache-Control': 'no-cache'
          }
        }
      )
    );

    // Transform response data for display
    const assessmentData = response.data;
    return {
      ...assessmentData,
      timestamp: new Date().toISOString(),
      factors: assessmentData.factors.sort((a: IRiskFactor, b: IRiskFactor) => b.score - a.score)
    };
  } catch (error) {
    // Log error with context
    console.error('Risk assessment retrieval failed:', {
      policyId,
      error,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Submits a policy for underwriting review with enhanced reliability features
 * @param policyId Unique identifier of the policy
 * @param underwritingData Submission data for underwriting
 * @returns Promise resolving to initial risk assessment
 */
export async function submitForUnderwriting(
  policyId: string,
  underwritingData: IUnderwritingSubmission
): Promise<IRiskAssessmentDisplay> {
  try {
    // Validate submission data
    if (!underwritingData.riskData || !underwritingData.documents.length) {
      throw new Error('Invalid underwriting submission data');
    }

    // Generate idempotency key for request deduplication
    const idempotencyKey = `uw-${policyId}-${Date.now()}`;

    // Prepare request with enhanced headers
    const requestConfig = {
      headers: {
        'X-Idempotency-Key': idempotencyKey,
        'X-Request-Priority': 'high',
        'Content-Type': 'application/json'
      },
      timeout: 45000 // 45 second timeout for underwriting submissions
    };

    // Submit request with circuit breaker protection
    const response = await UNDERWRITING_CIRCUIT_BREAKER.fire(
      apiClient.post<IRiskAssessmentDisplay>(
        API_ENDPOINTS.UNDERWRITING.ASSESS,
        {
          ...underwritingData,
          metadata: {
            submittedAt: new Date().toISOString(),
            source: 'web-client',
            version: '1.0.0'
          }
        },
        requestConfig
      )
    );

    // Process and return assessment data
    return {
      ...response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Enhanced error logging
    console.error('Underwriting submission failed:', {
      policyId,
      error,
      timestamp: new Date().toISOString(),
      submissionData: {
        ...underwritingData,
        documents: underwritingData.documents.map(d => ({ id: d.id, type: d.type }))
      }
    });
    throw error;
  }
}

// Event listener for circuit breaker state changes
UNDERWRITING_CIRCUIT_BREAKER.on('open', () => {
  console.warn('Underwriting circuit breaker opened:', {
    timestamp: new Date().toISOString(),
    failures: UNDERWRITING_CIRCUIT_BREAKER.stats.failures,
    latency: UNDERWRITING_CIRCUIT_BREAKER.stats.latency
  });
});

// Export types for consumers
export type {
  IRiskAssessmentDisplay,
  IRiskFactor,
  IUnderwritingSubmission
};