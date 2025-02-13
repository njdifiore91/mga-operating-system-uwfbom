/**
 * Type definitions for analytics and reporting functionality in the MGA Operating System.
 * Provides comprehensive type definitions for metrics, reports, and analytics data structures.
 * @version 1.0.0
 */

import { ID, Timestamp, DateRange } from './common.types';

/**
 * Interface for policy-related metrics tracking
 */
export interface PolicyMetrics {
  totalPolicies: number;
  activePolicies: number;
  totalPremium: number;
  policyDistribution: Record<string, number>; // Distribution by policy type/status
  renewalRate: number; // Percentage of policies renewed
}

/**
 * Interface for tracking underwriting performance and automation metrics
 */
export interface UnderwritingMetrics {
  automationRate: number; // Percentage of automated underwriting decisions
  averageProcessingTime: number; // Average time in minutes
  pendingReviews: number;
  riskScoreDistribution: Record<string, number>; // Distribution of risk scores
}

/**
 * Interface for tracking compliance and regulatory metrics
 */
export interface ComplianceMetrics {
  complianceRate: number; // Overall compliance percentage
  openViolations: number;
  regulatoryFilings: number;
}

/**
 * Interface for analyzing metric trends and changes over time
 */
export interface MetricTrend {
  value: number;
  change: number; // Percentage change from previous period
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
  metrics: string[]; // Array of metric keys to include
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
  refreshInterval: number; // in seconds
  layout: Record<string, unknown>; // Dashboard widget layout configuration
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