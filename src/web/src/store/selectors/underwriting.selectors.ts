/**
 * Redux selectors for underwriting state management
 * Implements memoized selectors for accessing and computing underwriting-related state
 * with comprehensive type safety and performance optimization
 * @version 1.0.0
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../reducers';
import type {
  IRiskAssessmentDisplay,
  UnderwritingStatus,
} from '../../types/underwriting.types';
import { RiskSeverity } from '../../types/underwriting.types';

/**
 * Base selector for accessing the underwriting slice of state
 */
export const selectUnderwritingState = (state: RootState) => state.underwriting;

/**
 * Memoized selector for accessing the current risk assessment
 */
export const selectRiskAssessment = createSelector(
  [selectUnderwritingState],
  (underwriting) => underwriting.riskAssessment
);

/**
 * Memoized selector for accessing the filtered and sorted underwriting queue
 */
export const selectUnderwritingQueue = createSelector(
  [selectUnderwritingState],
  (underwriting) => {
    const { queueItems, filters } = underwriting;
    
    // Apply filters if present
    let filteredItems = queueItems;
    if (filters) {
      filteredItems = queueItems.filter((item: { status: string; severity: string; riskScore: number }) => {
        if (filters.status && item.status !== filters.status) return false;
        if (filters.severity && item.severity !== filters.severity) return false;
        if (filters.minScore && item.riskScore < filters.minScore) return false;
        if (filters.maxScore && item.riskScore > filters.maxScore) return false;
        return true;
      });
    }

    // Sort by submission date and risk score
    return [...filteredItems].sort((a, b) => {
      // Sort by submission date descending
      const dateComparison = new Date(b.submissionDate).getTime() - 
                           new Date(a.submissionDate).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      // Secondary sort by risk score descending
      return b.riskScore - a.riskScore;
    });
  }
);

/**
 * Memoized selector for computing comprehensive queue metrics
 */
export const selectQueueMetrics = createSelector(
  [selectUnderwritingQueue],
  (queue): IQueueMetrics => {
    const totalItems = queue.length;
    
    // Calculate items by status
    const itemsByStatus = queue.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<UnderwritingStatus, number>);

    // Calculate items by severity
    const itemsBySeverity = queue.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {} as Record<RiskSeverity, number>);

    // Calculate average risk score
    const averageRiskScore = queue.reduce((sum, item) => sum + item.riskScore, 0) / 
                            (totalItems || 1);

    // Calculate processing metrics
    const processingTimes = queue
      .filter(item => item.status !== 'PENDING_REVIEW')
      .map(item => {
        const submitted = new Date(item.submissionDate).getTime();
        const processed = new Date(item.lastActivityDate).getTime();
        return processed - submitted;
      });

    const averageProcessingTime = processingTimes.length ?
      processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length :
      0;

    return {
      totalItems,
      itemsByStatus,
      itemsBySeverity,
      averageRiskScore,
      averageProcessingTime,
      pendingReviews: itemsByStatus.PENDING_REVIEW || 0,
      inReview: itemsByStatus.IN_REVIEW || 0,
      completedToday: queue.filter(item => 
        new Date(item.lastActivityDate).toDateString() === new Date().toDateString()
      ).length
    };
  }
);

/**
 * Memoized selector for accessing the currently selected assessment with null safety
 */
export const selectSelectedAssessment = createSelector(
  [selectUnderwritingState],
  (underwriting): IRiskAssessmentDisplay | null => {
    const { riskAssessment } = underwriting;
    
    if (!riskAssessment) return null;

    // Ensure all required fields are present
    return {
      ...riskAssessment,
      factors: riskAssessment.factors.map((factor: { severity: any; score: number }) => ({
        ...factor,
        severity: factor.severity || calculateFactorSeverity(factor.score)
      }))
    };
  }
);

/**
 * Memoized selector for computing queue performance metrics
 */
export const selectQueuePerformance = createSelector(
  [selectUnderwritingQueue],
  (queue): IQueuePerformance => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    const recentItems = queue.filter(item => 
      new Date(item.submissionDate).getTime() > oneDayAgo
    );

    return {
      throughputLast24h: recentItems.length,
      averageResponseTime: recentItems.reduce((sum, item) => {
        const responseTime = new Date(item.lastActivityDate).getTime() -
                           new Date(item.submissionDate).getTime();
        return sum + responseTime;
      }, 0) / (recentItems.length || 1),
      autoApprovalRate: (recentItems.filter(item => 
        item.status === 'AUTO_APPROVED'
      ).length / (recentItems.length || 1)) * 100,
      manualReviewRate: (recentItems.filter(item =>
        item.status === 'MANUAL_REVIEW'
      ).length / (recentItems.length || 1)) * 100
    };
  }
);

// Helper function for calculating factor severity
const calculateFactorSeverity = (score: number): RiskSeverity => {
  if (score <= 0.3) return RiskSeverity.LOW;
  if (score <= 0.7) return RiskSeverity.MEDIUM;
  return RiskSeverity.HIGH;
};

// Type definitions for computed metrics
interface IQueueMetrics {
  totalItems: number;
  itemsByStatus: Record<UnderwritingStatus, number>;
  itemsBySeverity: Record<RiskSeverity, number>;
  averageRiskScore: number;
  averageProcessingTime: number;
  pendingReviews: number;
  inReview: number;
  completedToday: number;
}

interface IQueuePerformance {
  throughputLast24h: number;
  averageResponseTime: number;
  autoApprovalRate: number;
  manualReviewRate: number;
}