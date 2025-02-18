/**
 * Redux action creators for managing underwriting workflow state
 * Implements optimized state management with caching and performance tracking
 * @version 1.0.0
 */

import { createAction } from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';
import axiosRetry from 'axios-retry';
import Cache from 'node-cache';
import { trace, SpanStatusCode } from '@opentelemetry/api';

import { UnderwritingService } from '../../services/underwriting.service';
import { 
  IRiskAssessmentDisplay, 
  IUnderwritingQueueItem, 
  IUnderwritingDecisionForm
} from '../../types/underwriting.types';

// Initialize services
const underwritingService = new UnderwritingService();

// Configure cache for risk assessments
const riskAssessmentCache = new Cache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60,
  useClones: false
});

// Action Types
export const FETCH_RISK_ASSESSMENT = {
  START: 'underwriting/fetchRiskAssessment/start',
  SUCCESS: 'underwriting/fetchRiskAssessment/success',
  ERROR: 'underwriting/fetchRiskAssessment/error'
} as const;

export const SUBMIT_UNDERWRITING = {
  START: 'underwriting/submitUnderwriting/start',
  SUCCESS: 'underwriting/submitUnderwriting/success',
  ERROR: 'underwriting/submitUnderwriting/error'
} as const;

export const PROCESS_DECISION = {
  START: 'underwriting/processDecision/start',
  SUCCESS: 'underwriting/processDecision/success',
  ERROR: 'underwriting/processDecision/error'
} as const;

export const UPDATE_QUEUE = {
  START: 'underwriting/updateQueue/start',
  SUCCESS: 'underwriting/updateQueue/success',
  ERROR: 'underwriting/updateQueue/error'
} as const;

// Action Creators
export const fetchRiskAssessmentStart = createAction(FETCH_RISK_ASSESSMENT.START);
export const fetchRiskAssessmentSuccess = createAction<IRiskAssessmentDisplay>(
  FETCH_RISK_ASSESSMENT.SUCCESS
);
export const fetchRiskAssessmentError = createAction<Error>(
  FETCH_RISK_ASSESSMENT.ERROR
);

export const submitUnderwritingStart = createAction<string>(SUBMIT_UNDERWRITING.START);
export const submitUnderwritingSuccess = createAction<IRiskAssessmentDisplay>(
  SUBMIT_UNDERWRITING.SUCCESS
);
export const submitUnderwritingError = createAction<Error>(
  SUBMIT_UNDERWRITING.ERROR
);

export const processDecisionStart = createAction<string>(PROCESS_DECISION.START);
export const processDecisionSuccess = createAction<string>(PROCESS_DECISION.SUCCESS);
export const processDecisionError = createAction<Error>(PROCESS_DECISION.ERROR);

export const updateQueueStart = createAction(UPDATE_QUEUE.START);
export const updateQueueSuccess = createAction<IUnderwritingQueueItem[]>(
  UPDATE_QUEUE.SUCCESS
);
export const updateQueueError = createAction<Error>(UPDATE_QUEUE.ERROR);

// Thunk Actions
export const fetchRiskAssessment = (
  policyId: string
): ThunkAction<Promise<IRiskAssessmentDisplay>, any, unknown, any> => {
  return async (dispatch) => {
    const tracer = trace.getTracer('underwriting-actions');
    
    return tracer.startActiveSpan('fetchRiskAssessment', async (span) => {
      try {
        dispatch(fetchRiskAssessmentStart());

        // Check cache first
        const cachedAssessment = riskAssessmentCache.get<IRiskAssessmentDisplay>(policyId);
        if (cachedAssessment) {
          dispatch(fetchRiskAssessmentSuccess(cachedAssessment));
          span.setStatus({ code: SpanStatusCode.OK });
          return cachedAssessment;
        }

        // Fetch with retry logic
        const assessment = await axiosRetry(
          async () => await underwritingService.getRiskAssessmentWithFormatting(policyId),
          { 
            retries: 3,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 5000
          }
        );

        // Cache the result
        riskAssessmentCache.set(policyId, assessment);
        
        dispatch(fetchRiskAssessmentSuccess(assessment));
        span.setStatus({ code: SpanStatusCode.OK });
        return assessment;

      } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        dispatch(fetchRiskAssessmentError(typedError));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: typedError.message
        });
        throw typedError;
      } finally {
        span.end();
      }
    });
  };
};

export const submitUnderwritingRequest = (
  policyId: string,
  underwritingData: any
): ThunkAction<Promise<IRiskAssessmentDisplay>, any, unknown, any> => {
  return async (dispatch) => {
    const tracer = trace.getTracer('underwriting-actions');
    
    return tracer.startActiveSpan('submitUnderwriting', async (span) => {
      try {
        dispatch(submitUnderwritingStart(policyId));

        // Optimistic update for UI responsiveness
        dispatch(updateQueueStart());

        const assessment = await axiosRetry(
          async () => await underwritingService.submitPolicyForUnderwriting(
            policyId,
            underwritingData
          ),
          {
            retries: 2,
            factor: 2,
            minTimeout: 2000,
            maxTimeout: 10000
          }
        );

        // Update cache with new assessment
        riskAssessmentCache.set(policyId, assessment);
        
        dispatch(submitUnderwritingSuccess(assessment));
        span.setStatus({ code: SpanStatusCode.OK });
        return assessment;

      } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        dispatch(submitUnderwritingError(typedError));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: typedError.message
        });
        throw typedError;
      } finally {
        span.end();
      }
    });
  };
};

export const processUnderwritingDecision = (
  policyId: string,
  decision: IUnderwritingDecisionForm
): ThunkAction<Promise<void>, any, unknown, any> => {
  return async (dispatch) => {
    const tracer = trace.getTracer('underwriting-actions');
    
    return tracer.startActiveSpan('processDecision', async (span) => {
      try {
        dispatch(processDecisionStart(policyId));

        await axiosRetry(
          async () => await underwritingService.processUnderwritingDecision(
            policyId,
            decision
          ),
          {
            retries: 2,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 5000
          }
        );

        // Invalidate cached assessment
        riskAssessmentCache.del(policyId);
        
        dispatch(processDecisionSuccess(policyId));
        span.setStatus({ code: SpanStatusCode.OK });

      } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        dispatch(processDecisionError(typedError));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: typedError.message
        });
        throw typedError;
      } finally {
        span.end();
      }
    });
  };
};

export const updateUnderwritingQueue = (
  filters: any
): ThunkAction<Promise<IUnderwritingQueueItem[]>, any, unknown, any> => {
  return async (dispatch) => {
    const tracer = trace.getTracer('underwriting-actions');
    
    return tracer.startActiveSpan('updateQueue', async (span) => {
      try {
        dispatch(updateQueueStart());

        const queue = await underwritingService.getFilteredUnderwritingQueue(filters)
          .toPromise() || [];

        dispatch(updateQueueSuccess(queue));
        span.setStatus({ code: SpanStatusCode.OK });
        return queue;

      } catch (error) {
        const typedError = error instanceof Error ? error : new Error('Unknown error');
        dispatch(updateQueueError(typedError));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: typedError.message
        });
        throw typedError;
      } finally {
        span.end();
      }
    });
  };
};