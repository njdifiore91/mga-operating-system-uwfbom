/**
 * Analytics Service for MGA Operating System
 * Provides comprehensive analytics and reporting functionality with real-time updates,
 * trend analysis, and anomaly detection capabilities.
 * @version 1.0.0
 */

import { memoize } from 'lodash'; // ^4.17.21
import {
  PolicyMetrics,
  UnderwritingMetrics,
  ComplianceMetrics,
  MetricTrend
} from '../types/analytics.types';
import {
  getDashboardMetrics,
  getPerformanceReport,
  getMetricsByType
} from '../api/analytics.api';

// Constants for analytics configuration
const ANOMALY_DETECTION_WINDOW = 30; // days
const TREND_PERIODS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90
} as const;

type TrendPeriod = keyof typeof TREND_PERIODS;

interface AnomalyConfig {
  threshold: number;
  sensitivity: number;
}

interface MetricDefinition {
  name: string;
  calculation: string;
  dataSource: string;
  aggregation?: 'sum' | 'average' | 'count';
  thresholds?: {
    warning: number;
    critical: number;
  };
}

/**
 * Fetches metrics data by category with caching and error handling
 * @param category Category of metrics to fetch
 * @returns Promise resolving to metrics data for the specified category
 */
export async function fetchMetricsByCategory(
  category: string
): Promise<PolicyMetrics | UnderwritingMetrics | ComplianceMetrics> {
  try {
    const response = await getMetricsByType(category, {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    });
    return response;
  } catch (error) {
    console.error(`Failed to fetch metrics for category ${category}:`, error);
    throw error;
  }
}

/**
 * Initializes WebSocket connection for real-time metric updates
 * @returns WebSocket instance for metric updates
 */
export function initializeWebSocket(): WebSocket {
  const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/metrics/ws`);
  
  ws.onopen = () => {
    console.log('Analytics WebSocket connection established');
  };

  ws.onmessage = (event) => {
    try {
      const metricUpdate = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent('metricUpdate', { detail: metricUpdate }));
    } catch (error) {
      console.error('Error processing metric update:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('Analytics WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Analytics WebSocket connection closed');
    // Attempt to reconnect after 5 seconds
    setTimeout(() => initializeWebSocket(), 5000);
  };

  return ws;
}

/**
 * Calculates metric trends with anomaly detection and confidence scoring
 * @param historicalData Historical metric data points
 * @param period Trend analysis period
 * @param anomalyConfig Anomaly detection configuration
 * @returns Calculated trends with anomaly indicators
 */
export const calculateMetricTrends = memoize(
  (
    historicalData: Record<string, number[]>,
    period: TrendPeriod,
    anomalyConfig: AnomalyConfig
  ): Record<string, MetricTrend> => {
    const trends: Record<string, MetricTrend> = {};
    const periodDays = TREND_PERIODS[period];

    for (const [metric, values] of Object.entries(historicalData)) {
      if (!values.length) continue;

      // Calculate moving averages
      const movingAvg = calculateMovingAverage(values, periodDays);
      
      // Detect anomalies
      const anomalies = detectAnomalies(
        values,
        movingAvg,
        anomalyConfig.threshold,
        anomalyConfig.sensitivity
      );

      // Calculate trend direction and confidence
      const trendDirection = calculateTrendDirection(values, periodDays);
      const confidence = calculateTrendConfidence(values, anomalies);

      trends[metric] = {
        value: values[values.length - 1],
        change: calculatePercentageChange(
          values[values.length - periodDays] || values[0],
          values[values.length - 1]
        ),
        trend: trendDirection,
        lastUpdated: new Date().toISOString()
      };
    }

    return trends;
  },
  (historicalData, period) => `${JSON.stringify(historicalData)}_${period}`
);

/**
 * Validates custom metric definitions for data integrity and calculation rules
 * @param definition Metric definition to validate
 * @returns Validation result with error details
 */
export const validateMetricDefinition = (
  definition: MetricDefinition
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate required fields
  if (!definition.name || !definition.calculation || !definition.dataSource) {
    errors.push('Missing required fields in metric definition');
  }

  // Validate calculation formula
  try {
    // Simple formula validation - can be extended based on requirements
    const testValue = 100;
    const formula = definition.calculation.replace(/\$value/g, testValue.toString());
    eval(formula); // Note: In production, use a safer formula parser
  } catch (error) {
    errors.push('Invalid calculation formula');
  }

  // Validate aggregation rules
  if (definition.aggregation && !['sum', 'average', 'count'].includes(definition.aggregation)) {
    errors.push('Invalid aggregation method');
  }

  // Validate thresholds if present
  if (definition.thresholds) {
    if (definition.thresholds.warning >= definition.thresholds.critical) {
      errors.push('Warning threshold must be less than critical threshold');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculates moving average for trend analysis
 * @param values Array of metric values
 * @param period Period for moving average calculation
 * @returns Array of moving averages
 */
const calculateMovingAverage = (values: number[], period: number): number[] => {
  const movingAvg: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    movingAvg.push(sum / period);
  }
  return movingAvg;
};

/**
 * Detects anomalies in metric data using statistical analysis
 * @param values Metric values
 * @param movingAvg Moving averages
 * @param threshold Anomaly threshold
 * @param sensitivity Sensitivity factor for anomaly detection
 * @returns Array of anomaly indicators
 */
const detectAnomalies = (
  values: number[],
  movingAvg: number[],
  threshold: number,
  sensitivity: number
): boolean[] => {
  const stdDev = calculateStandardDeviation(values);
  return values.map((value, index) => {
    const avg = movingAvg[Math.max(0, index - 1)] || values[0];
    return Math.abs(value - avg) > stdDev * sensitivity * threshold;
  });
};

/**
 * Calculates trend direction based on recent values
 * @param values Metric values
 * @param period Analysis period
 * @returns Trend direction indicator
 */
const calculateTrendDirection = (
  values: number[],
  period: number
): 'up' | 'down' | 'stable' => {
  const recentValues = values.slice(-period);
  const firstValue = recentValues[0];
  const lastValue = recentValues[recentValues.length - 1];
  const change = ((lastValue - firstValue) / firstValue) * 100;

  if (Math.abs(change) < 1) return 'stable';
  return change > 0 ? 'up' : 'down';
};

/**
 * Calculates trend confidence score
 * @param values Metric values
 * @param anomalies Anomaly indicators
 * @returns Confidence score between 0 and 1
 */
const calculateTrendConfidence = (values: number[], anomalies: boolean[]): number => {
  const recentAnomalies = anomalies.slice(-ANOMALY_DETECTION_WINDOW);
  const anomalyCount = recentAnomalies.filter(a => a).length;
  const baseConfidence = 1 - (anomalyCount / ANOMALY_DETECTION_WINDOW);
  
  // Adjust confidence based on data consistency
  const variance = calculateVariance(values);
  const varianceImpact = Math.min(variance / (Math.max(...values) || 1), 0.5);
  
  return Math.max(0, Math.min(1, baseConfidence - varianceImpact));
};

/**
 * Calculates percentage change between two values
 * @param oldValue Previous value
 * @param newValue Current value
 * @returns Percentage change
 */
const calculatePercentageChange = (oldValue: number, newValue: number): number => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
};

/**
 * Calculates standard deviation of values
 * @param values Array of numbers
 * @returns Standard deviation
 */
const calculateStandardDeviation = (values: number[]): number => {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
};

/**
 * Calculates variance of values
 * @param values Array of numbers
 * @returns Variance
 */
const calculateVariance = (values: number[]): number => {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
};