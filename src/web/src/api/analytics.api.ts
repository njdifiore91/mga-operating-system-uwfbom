/**
 * Analytics API Client Module for MGA Operating System
 * Provides real-time metrics, performance monitoring, and report generation capabilities
 * with built-in caching, error handling and monitoring
 * @version 1.0.0
 */

import { AxiosError } from 'axios'; // ^1.4.0
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  PolicyMetrics,
  UnderwritingMetrics,
  ComplianceMetrics,
  PerformanceReport,
  ReportOptions,
  TimeSeriesData
} from '../types/analytics.types';
import { DateRange } from '../types/common.types';

/**
 * Retrieves real-time dashboard metrics with caching and monitoring
 * @returns Promise resolving to combined metrics for dashboard display
 */
export async function getDashboardMetrics(): Promise<PolicyMetrics & UnderwritingMetrics & ComplianceMetrics> {
  try {
    const response = await apiClient.get<PolicyMetrics & UnderwritingMetrics & ComplianceMetrics>(
      API_ENDPOINTS.ANALYTICS.DASHBOARD,
      {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes
          'X-Request-Type': 'Analytics'
        }
      }
    );

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Failed to fetch dashboard metrics:', axiosError);
    throw new Error(`Analytics API Error: ${axiosError.message}`);
  }
}

/**
 * Generates comprehensive performance report with caching and error handling
 * @param options Report generation options
 * @returns Promise resolving to performance report data
 */
export async function getPerformanceReport(options: ReportOptions): Promise<PerformanceReport> {
  try {
    const response = await apiClient.post<PerformanceReport>(
      API_ENDPOINTS.ANALYTICS.REPORTS,
      options,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Report-Type': options.format
        },
        timeout: 30000 // 30 second timeout for report generation
      }
    );

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Failed to generate performance report:', axiosError);
    throw new Error(`Report Generation Error: ${axiosError.message}`);
  }
}

/**
 * Retrieves metrics by type with real-time updates and monitoring
 * @param metricType Type of metrics to retrieve
 * @param dateRange Date range for metrics data
 * @returns Promise resolving to type-specific metrics data
 */
export async function getMetricsByType(
  metricType: string,
  dateRange: DateRange
): Promise<PolicyMetrics | UnderwritingMetrics | ComplianceMetrics> {
  try {
    const response = await apiClient.get<PolicyMetrics | UnderwritingMetrics | ComplianceMetrics>(
      `${API_ENDPOINTS.ANALYTICS.METRICS}/${metricType}`,
      {
        params: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        },
        headers: {
          'Cache-Control': 'max-age=600', // 10 minutes
          'X-Metric-Type': metricType
        }
      }
    );

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`Failed to fetch ${metricType} metrics:`, axiosError);
    throw new Error(`Metrics API Error: ${axiosError.message}`);
  }
}

/**
 * Retrieves time series data for specified metric with aggregation
 * @param metricKey Unique identifier for the metric
 * @param dateRange Date range for time series data
 * @param aggregation Aggregation level for data points
 * @returns Promise resolving to time series data
 */
export async function getTimeSeriesData(
  metricKey: string,
  dateRange: DateRange,
  aggregation: TimeSeriesData['aggregation'] = 'hourly'
): Promise<TimeSeriesData> {
  try {
    const response = await apiClient.get<TimeSeriesData>(
      `${API_ENDPOINTS.ANALYTICS.METRICS}/timeseries/${metricKey}`,
      {
        params: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          aggregation
        },
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes
          'X-Series-Type': 'timeseries'
        }
      }
    );

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Failed to fetch time series data:', axiosError);
    throw new Error(`Time Series API Error: ${axiosError.message}`);
  }
}

/**
 * Exports analytics data in specified format
 * @param reportOptions Report configuration options
 * @returns Promise resolving to exported data URL
 */
export async function exportAnalyticsData(reportOptions: ReportOptions): Promise<string> {
  try {
    const response = await apiClient.post<{ downloadUrl: string }>(
      API_ENDPOINTS.ANALYTICS.EXPORT,
      reportOptions,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Export-Format': reportOptions.format
        },
        responseType: 'json',
        timeout: 60000 // 60 second timeout for large exports
      }
    );

    return response.data.downloadUrl;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Failed to export analytics data:', axiosError);
    throw new Error(`Export API Error: ${axiosError.message}`);
  }
}

/**
 * Subscribes to real-time metric updates using WebSocket connection
 * @param metricKey Unique identifier for the metric to subscribe to
 * @param callback Function to handle incoming metric updates
 * @returns Function to unsubscribe from updates
 */
export function subscribeToMetricUpdates(
  metricKey: string,
  callback: (data: any) => void
): () => void {
  const wsEndpoint = `${API_ENDPOINTS.ANALYTICS.BASE}/ws/metrics/${metricKey}`;
  const ws = new WebSocket(wsEndpoint);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      callback(data);
    } catch (error) {
      console.error('Failed to process metric update:', error);
    }
  };

  return () => {
    ws.close();
  };
}