/**
 * Redux reducer for managing underwriting workflow state
 * Implements optimized state management with caching and error handling
 * @version 1.0.0
 */

import { createReducer } from '@reduxjs/toolkit';
import {
  IRiskAssessmentDisplay,
  IUnderwritingQueueItem,
  UnderwritingStatus,
  RiskSeverity
} from '../../types/underwriting.types';
import {
  fetchRiskAssessment,
  submitUnderwritingRequest,
  processUnderwritingDecision,
  updateUnderwritingQueue
} from '../actions/underwriting.actions';
import {
  UNDERWRITING_STATUS,
  RISK_SEVERITY,
  RISK_SCORE_RANGES
} from '../../constants/underwriting.constants';

// Interface for cache entries with metadata
interface ICacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Interface for error state tracking
interface IErrorState {
  message: string;
  code?: string;
  context?: string;
  timestamp: number;
  recoveryAttempts: number;
}

// Interface for state metadata
interface IStateMetadata {
  lastUpdated: number;
  version: string;
  pendingOperations: string[];
}

// Interface for the complete underwriting state
interface UnderwritingState {
  riskAssessment: IRiskAssessmentDisplay | null;
  queueItems: IUnderwritingQueueItem[];
  loading: boolean;
  error: IErrorState | null;
  cache: {
    assessments: Record<string, ICacheEntry<IRiskAssessmentDisplay>>;
    queue: ICacheEntry<IUnderwritingQueueItem[]> | null;
  };
  metadata: IStateMetadata;
}

// Cache configuration
const CACHE_CONFIG = {
  ASSESSMENT_TTL: 5 * 60 * 1000, // 5 minutes
  QUEUE_TTL: 30 * 1000, // 30 seconds
  MAX_CACHE_SIZE: 100,
  MAX_RECOVERY_ATTEMPTS: 3
};

// Initial state with enhanced error handling and caching
const initialState: UnderwritingState = {
  riskAssessment: null,
  queueItems: [],
  loading: false,
  error: null,
  cache: {
    assessments: {},
    queue: null
  },
  metadata: {
    lastUpdated: Date.now(),
    version: '1.0.0',
    pendingOperations: []
  }
};

// Create the reducer with enhanced type safety and performance optimizations
export const underwritingReducer = createReducer(initialState, (builder) => {
  builder
    // Risk Assessment Actions
    .addCase(fetchRiskAssessment.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.metadata.pendingOperations.push('FETCH_RISK_ASSESSMENT');
    })
    .addCase(fetchRiskAssessment.fulfilled, (state, action) => {
      state.loading = false;
      state.riskAssessment = action.payload;
      state.error = null;
      
      // Update cache with new assessment
      state.cache.assessments[action.payload.policyId] = {
        data: action.payload,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_CONFIG.ASSESSMENT_TTL
      };

      // Clean up old cache entries if needed
      if (Object.keys(state.cache.assessments).length > CACHE_CONFIG.MAX_CACHE_SIZE) {
        const oldestKey = Object.keys(state.cache.assessments)
          .sort((a, b) => state.cache.assessments[a].timestamp - state.cache.assessments[b].timestamp)[0];
        delete state.cache.assessments[oldestKey];
      }

      state.metadata = {
        ...state.metadata,
        lastUpdated: Date.now(),
        pendingOperations: state.metadata.pendingOperations.filter(op => op !== 'FETCH_RISK_ASSESSMENT')
      };
    })
    .addCase(fetchRiskAssessment.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.error.message || 'Failed to fetch risk assessment',
        code: action.error.code || 'FETCH_ERROR',
        timestamp: Date.now(),
        recoveryAttempts: (state.error?.recoveryAttempts || 0) + 1
      };
      state.metadata.pendingOperations = state.metadata.pendingOperations
        .filter(op => op !== 'FETCH_RISK_ASSESSMENT');
    })

    // Underwriting Submission Actions
    .addCase(submitUnderwritingRequest.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.metadata.pendingOperations.push('SUBMIT_UNDERWRITING');
    })
    .addCase(submitUnderwritingRequest.fulfilled, (state, action) => {
      state.loading = false;
      state.riskAssessment = action.payload;
      
      // Invalidate queue cache on new submission
      state.cache.queue = null;
      
      state.metadata = {
        ...state.metadata,
        lastUpdated: Date.now(),
        pendingOperations: state.metadata.pendingOperations
          .filter(op => op !== 'SUBMIT_UNDERWRITING')
      };
    })
    .addCase(submitUnderwritingRequest.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.error.message || 'Failed to submit underwriting request',
        code: 'SUBMISSION_ERROR',
        timestamp: Date.now(),
        recoveryAttempts: (state.error?.recoveryAttempts || 0) + 1
      };
    })

    // Queue Management Actions
    .addCase(updateUnderwritingQueue.pending, (state) => {
      state.loading = true;
      state.metadata.pendingOperations.push('UPDATE_QUEUE');
    })
    .addCase(updateUnderwritingQueue.fulfilled, (state, action) => {
      state.loading = false;
      state.queueItems = action.payload;
      
      // Update queue cache
      state.cache.queue = {
        data: action.payload,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_CONFIG.QUEUE_TTL
      };

      state.metadata = {
        ...state.metadata,
        lastUpdated: Date.now(),
        pendingOperations: state.metadata.pendingOperations
          .filter(op => op !== 'UPDATE_QUEUE')
      };
    })
    .addCase(updateUnderwritingQueue.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.error.message || 'Failed to update underwriting queue',
        code: 'QUEUE_UPDATE_ERROR',
        timestamp: Date.now(),
        recoveryAttempts: (state.error?.recoveryAttempts || 0) + 1
      };
    })

    // Decision Processing Actions
    .addCase(processUnderwritingDecision.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.metadata.pendingOperations.push('PROCESS_DECISION');
    })
    .addCase(processUnderwritingDecision.fulfilled, (state, action) => {
      state.loading = false;
      
      // Invalidate affected caches
      delete state.cache.assessments[action.meta.arg.policyId];
      state.cache.queue = null;

      state.metadata = {
        ...state.metadata,
        lastUpdated: Date.now(),
        pendingOperations: state.metadata.pendingOperations
          .filter(op => op !== 'PROCESS_DECISION')
      };
    })
    .addCase(processUnderwritingDecision.rejected, (state, action) => {
      state.loading = false;
      state.error = {
        message: action.error.message || 'Failed to process underwriting decision',
        code: 'DECISION_ERROR',
        timestamp: Date.now(),
        recoveryAttempts: (state.error?.recoveryAttempts || 0) + 1
      };
    });
});

export default underwritingReducer;