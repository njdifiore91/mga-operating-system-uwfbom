/**
 * Type definitions for analytics and reporting functionality in the MGA Operating System.
 * Provides comprehensive type definitions for metrics, reports, and analytics data structures.
 * @version 1.0.0
 */

import { ID, Timestamp, DateRange } from './common.types';

/**
 * Interface for metric definition configuration
 */
export interface MetricDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  aggregationType: 'sum' | 'average' | 'count';
  thresholds?: MetricThreshold;
}

/**
 * Interface for anomaly detection configuration
 */
export interface AnomalyConfig {
  metricKey: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  deviationThreshold: number;
  minDataPoints: number;
  detectionMethod: 'zscore' | 'iqr' | 'percentile';
}

/**
 * Type for trend analysis period configuration
 */
export type TrendPeriod = {
  duration: number;
  unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  comparisonOffset: number;
};

/**
 * Interface for policy-related metrics tracking
 */
export interface PolicyMetrics {
  totalPolicies: number;
  activePolicies: number;
  totalPremium: number;
  policyDistribution: Record<string, number>;
  renewalRate: number;
}

/**
 * Interface for tracking underwriting performance and automation metrics
 */
export interface UnderwritingMetrics {
  automationRate: number;
  averageProcessingTime: number;
  pendingReviews: number;
  riskScoreDistribution: Record<string, number>;
  historicalTrend: MetricTrend[];
}

/**
 * Interface for tracking compliance and regulatory metrics
 */
export interface ComplianceMetrics {
  complianceRate: number;
  openViolations: number;
  regulatoryFilings: number;
}

/**
 * Interface combining all dashboard metrics
 */
export interface DashboardMetrics {
  policy: PolicyMetrics;
  underwriting: UnderwritingMetrics;
  compliance: ComplianceMetrics;
  lastUpdated: Timestamp;
}

/**
 * Interface for analyzing metric trends and changes over time
 */
export interface MetricTrend {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Interface for comprehensive performance reporting
 */
export interface PerformanceReport {
  dateRange: DateRange;
  policyMetrics: PolicyMetrics;
  underwritingMetrics: UnderwritingMetrics;
  complianceMetrics: ComplianceMetrics;
  trends: Record<string, MetricTrend>;
}

/**
 * Enum defining supported report export formats
 */
export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel'
}

/**
 * Interface for configuring report generation options
 */
export interface ReportOptions {
  dateRange: DateRange;
  format: ReportFormat;
  metrics: string[];
  includeTrends: boolean;
}

/**
 * Type for metric comparison periods
 */
export type ComparisonPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Interface for metric threshold configuration
 */
export interface MetricThreshold {
  metricKey: string;
  warningThreshold: number;
  criticalThreshold: number;
  comparisonOperator: '>' | '<' | '>=' | '<=' | '=';
}

/**
 * Interface for custom analytics dashboard configuration
 */
export interface DashboardConfig {
  id: ID;
  name: string;
  metrics: string[];
  refreshInterval: number;
  layout: Record<string, unknown>;
  thresholds: MetricThreshold[];
}

/**
 * Type for supported chart types in analytics visualizations
 */
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'radar';

/**
 * Interface for chart configuration options
 */
export interface ChartOptions {
  type: ChartType;
  title: string;
  xAxis: string;
  yAxis: string;
  aggregation?: 'sum' | 'average' | 'count';
  showLegend: boolean;
  colors?: string[];
}

/**
 * Interface for metric data point with timestamp
 */
export interface MetricDataPoint {
  timestamp: Timestamp;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for time series metric data
 */
export interface TimeSeriesData {
  metricKey: string;
  dataPoints: MetricDataPoint[];
  aggregation: 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}