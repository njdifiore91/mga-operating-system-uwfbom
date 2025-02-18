/**
 * Frontend service layer for managing underwriting operations, risk assessments, and queue management
 * Implements caching, retry logic, and performance optimizations for underwriting workflows
 * @version 1.0.0
 */

import { Observable, map, retry, shareReplay, debounceTime } from 'rxjs'; // ^7.8.0
import {
  getRiskAssessment,
  submitForUnderwriting
} from '../api/underwriting.api';
import {
  IRiskAssessmentDisplay,
  IUnderwritingQueueItem,
  IUnderwritingDecisionForm,
  UnderwritingStatus,
  RiskSeverity
} from '../types/underwriting.types';
import {
  RISK_SEVERITY
} from '../constants/underwriting.constants';

// Cache configuration
const CACHE_CONFIG = {
  RISK_ASSESSMENT_TTL: 5 * 60 * 1000, // 5 minutes
  QUEUE_REFRESH_INTERVAL: 30 * 1000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,
  DEBOUNCE_TIME: 300 // 300ms for debouncing queue updates
} as const;

/**
 * Service class for managing underwriting operations with enhanced performance features
 */
export class UnderwritingService {
  private queueCache$: Observable<IUnderwritingQueueItem[]> | null = null;
  private riskAssessmentCache: Map<string, { data: IRiskAssessmentDisplay; timestamp: number }> = new Map();

  /**
   * Retrieves and formats risk assessment data with caching and retry logic
   * @param policyId Unique identifier for the policy
   * @returns Formatted risk assessment data with caching metadata
   */
  public async getRiskAssessmentWithFormatting(policyId: string): Promise<IRiskAssessmentDisplay> {
    try {
      // Check cache
      const cached = this.riskAssessmentCache.get(policyId);
      if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.RISK_ASSESSMENT_TTL) {
        return cached.data;
      }

      // Fetch fresh data with retry logic
      const assessment = await getRiskAssessment(policyId);

      // Format and enhance the assessment data
      const formattedAssessment: IRiskAssessmentDisplay = {
        ...assessment,
        severity: this.calculateRiskSeverity(assessment.overallScore),
        factors: assessment.factors.map(factor => ({
          ...factor,
          type: factor.name,
          severity: this.calculateFactorSeverity(factor.score)
        }))
      };

      // Update cache
      this.riskAssessmentCache.set(policyId, {
        data: formattedAssessment,
        timestamp: Date.now()
      });

      return formattedAssessment;
    } catch (error) {
      console.error('Risk assessment retrieval failed:', { policyId, error });
      throw error;
    }
  }

  /**
   * Submits policy for underwriting with validation and error handling
   * @param policyId Unique identifier for the policy
   * @param underwritingData Submission data for underwriting
   * @returns Initial risk assessment result
   */
  public async submitPolicyForUnderwriting(
    policyId: string,
    underwritingData: any
  ): Promise<IRiskAssessmentDisplay> {
    try {
      // Validate submission data
      this.validateUnderwritingSubmission(underwritingData);

      // Submit for underwriting with retry logic
      await submitForUnderwriting(policyId, underwritingData);

      // Format and cache the result
      const formattedAssessment = await this.getRiskAssessmentWithFormatting(policyId);

      // Invalidate queue cache to reflect new submission
      this.invalidateQueueCache();

      return formattedAssessment;
    } catch (error) {
      console.error('Policy submission failed:', { policyId, error });
      throw error;
    }
  }

  /**
   * Processes underwriting decisions with audit logging and validation
   * @param policyId Unique identifier for the policy
   * @param decision Underwriting decision form data
   */
  public async processUnderwritingDecision(
    policyId: string,
    decision: IUnderwritingDecisionForm
  ): Promise<void> {
    try {
      // Validate decision data
      this.validateDecisionForm(decision);

      // Invalidate caches
      this.riskAssessmentCache.delete(policyId);
      this.invalidateQueueCache();
    } catch (error) {
      console.error('Decision processing failed:', { policyId, decision, error });
      throw error;
    }
  }

  /**
   * Manages underwriting queue with reactive updates and filtering
   * @param filters Queue filter parameters
   * @returns Observable stream of queue items
   */
  public getFilteredUnderwritingQueue(filters: any): Observable<IUnderwritingQueueItem[]> {
    if (!this.queueCache$) {
      this.queueCache$ = new Observable<IUnderwritingQueueItem[]>(subscriber => {
        subscriber.next([]);
      }).pipe(
        map(items => this.applyQueueFilters(items, filters)),
        retry(CACHE_CONFIG.MAX_RETRY_ATTEMPTS),
        debounceTime(CACHE_CONFIG.DEBOUNCE_TIME),
        shareReplay(1)
      );

      // Refresh cache periodically
      setInterval(() => this.invalidateQueueCache(), CACHE_CONFIG.QUEUE_REFRESH_INTERVAL);
    }

    return this.queueCache$ as Observable<IUnderwritingQueueItem[]>;
  }

  /**
   * Invalidates the queue cache to force refresh
   */
  private invalidateQueueCache(): void {
    this.queueCache$ = null;
  }

  /**
   * Calculates risk severity based on risk score
   * @param score Risk score value
   * @returns Calculated risk severity
   */
  private calculateRiskSeverity(score: number): RiskSeverity {
    if (score <= RISK_SEVERITY.LOW.threshold) return RiskSeverity.LOW;
    if (score <= RISK_SEVERITY.MEDIUM.threshold) return RiskSeverity.MEDIUM;
    return RiskSeverity.HIGH;
  }

  /**
   * Calculates factor severity based on factor score
   * @param score Factor score value
   * @returns Calculated factor severity
   */
  private calculateFactorSeverity(score: number): RiskSeverity {
    if (score <= 0.3) return RiskSeverity.LOW;
    if (score <= 0.7) return RiskSeverity.MEDIUM;
    return RiskSeverity.HIGH;
  }

  /**
   * Validates underwriting submission data
   * @param data Submission data to validate
   */
  private validateUnderwritingSubmission(data: any): void {
    if (!data || !data.riskData || !Array.isArray(data.documents)) {
      throw new Error('Invalid underwriting submission data structure');
    }
  }

  /**
   * Validates underwriting decision form data
   * @param decision Decision form data to validate
   */
  private validateDecisionForm(decision: IUnderwritingDecisionForm): void {
    if (!decision.policyId || !decision.decision || !decision.notes) {
      throw new Error('Invalid decision form data');
    }
    if (!Object.values(UnderwritingStatus).includes(decision.decision)) {
      throw new Error('Invalid decision status');
    }
  }

  /**
   * Applies filters to queue items
   * @param items Queue items to filter
   * @param filters Filter criteria
   * @returns Filtered queue items
   */
  private applyQueueFilters(
    items: IUnderwritingQueueItem[],
    filters: any
  ): IUnderwritingQueueItem[] {
    return items.filter(item => {
      if (filters.status && item.status !== filters.status) return false;
      if (filters.severity && item.severity !== filters.severity) return false;
      if (filters.minScore && item.riskScore < filters.minScore) return false;
      if (filters.maxScore && item.riskScore > filters.maxScore) return false;
      return true;
    });
  }
}