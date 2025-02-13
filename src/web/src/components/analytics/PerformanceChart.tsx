/**
 * PerformanceChart Component
 * Renders interactive performance charts for visualizing MGA OS metrics and trends
 * with real-time updates, accessibility support, and responsive design.
 * @version 1.0.0
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, BarChart, AreaChart, XAxis, YAxis, 
  Tooltip, Legend, ResponsiveContainer, CartesianGrid, Brush
} from 'recharts'; // ^2.7.2
import { format, subDays, isValid } from 'date-fns'; // ^2.30.0
import {
  PolicyMetrics,
  UnderwritingMetrics,
  ComplianceMetrics,
  MetricTrend,
  ChartType
} from '../../types/analytics.types';
import {
  fetchMetricsByCategory,
  calculateMetricTrends,
  initializeWebSocket
} from '../../services/analytics.service';

// Chart configuration types
interface ChartProps {
  chartType: ChartType;
  metricCategory: 'policy' | 'underwriting' | 'compliance';
  dateRange: { startDate: string; endDate: string };
  chartConfig?: ChartConfig;
  enableRealTime?: boolean;
}

interface ChartConfig {
  height?: number;
  colors?: string[];
  animation?: boolean;
  showBrush?: boolean;
  accessibility?: {
    enableKeyboardNav?: boolean;
    announceDataPoints?: boolean;
  };
}

// Default chart configuration
const DEFAULT_CONFIG: ChartConfig = {
  height: 400,
  colors: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'],
  animation: true,
  showBrush: true,
  accessibility: {
    enableKeyboardNav: true,
    announceDataPoints: true
  }
};

// Chart customization options
const CHART_CUSTOMIZATION = {
  margin: { top: 10, right: 30, left: 0, bottom: 0 },
  gridStroke: '#E5E5E5',
  tooltipStyle: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    borderRadius: '4px',
    padding: '10px'
  }
};

export const PerformanceChart: React.FC<ChartProps> = ({
  chartType,
  metricCategory,
  dateRange,
  chartConfig = DEFAULT_CONFIG,
  enableRealTime = false
}) => {
  // State management
  const [data, setData] = useState<Array<any>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Merge configuration with defaults
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...chartConfig
  }), [chartConfig]);

  // Format data for chart rendering
  const formatChartData = useCallback((rawData: any) => {
    try {
      return Object.entries(rawData).map(([timestamp, metrics]) => ({
        timestamp: format(new Date(timestamp), 'yyyy-MM-dd HH:mm'),
        ...metrics,
      }));
    } catch (err) {
      console.error('Error formatting chart data:', err);
      return [];
    }
  }, []);

  // Initialize WebSocket for real-time updates
  useEffect(() => {
    if (enableRealTime) {
      const ws = initializeWebSocket(`metrics/${metricCategory}`);
      
      ws.onmessage = (event) => {
        const newMetric = JSON.parse(event.data);
        setData(prevData => [...prevData.slice(-99), formatChartData([newMetric])[0]]);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError(new Error('Real-time updates failed'));
      };

      wsRef.current = ws;

      return () => {
        ws.close();
        wsRef.current = null;
      };
    }
  }, [enableRealTime, metricCategory, formatChartData]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetchMetricsByCategory(metricCategory, dateRange);
        const formattedData = formatChartData(response);
        setData(formattedData);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [metricCategory, dateRange, formatChartData]);

  // Render appropriate chart component
  const renderChart = useCallback(() => {
    const ChartComponent = {
      line: LineChart,
      bar: BarChart,
      area: AreaChart
    }[chartType];

    if (!ChartComponent) {
      console.error(`Unsupported chart type: ${chartType}`);
      return null;
    }

    return (
      <ResponsiveContainer width="100%" height={config.height}>
        <ChartComponent
          data={data}
          margin={CHART_CUSTOMIZATION.margin}
          role="img"
          aria-label={`${metricCategory} metrics chart`}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_CUSTOMIZATION.gridStroke} />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => format(new Date(value), 'MMM dd')}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={CHART_CUSTOMIZATION.tooltipStyle}
            formatter={(value: number) => [value.toLocaleString(), '']}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            role="list"
            aria-label="Chart legend"
          />
          {config.showBrush && (
            <Brush
              dataKey="timestamp"
              height={30}
              stroke={config.colors?.[0]}
              role="slider"
              aria-label="Date range selector"
            />
          )}
          {Object.keys(data[0] || {})
            .filter(key => key !== 'timestamp')
            .map((key, index) => (
              <ChartComponent.type
                key={key}
                type="monotone"
                dataKey={key}
                stroke={config.colors?.[index % (config.colors?.length || 1)]}
                fill={config.colors?.[index % (config.colors?.length || 1)]}
                animationDuration={config.animation ? 300 : 0}
                role="presentation"
                aria-label={`${key} data series`}
              />
            ))}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }, [chartType, data, config, metricCategory]);

  if (loading) {
    return <div role="alert" aria-busy="true">Loading chart data...</div>;
  }

  if (error) {
    return <div role="alert" aria-live="polite">Error loading chart: {error.message}</div>;
  }

  if (!data.length) {
    return <div role="alert">No data available for the selected period</div>;
  }

  return (
    <div
      className="performance-chart"
      role="region"
      aria-label={`${metricCategory} performance chart`}
    >
      {renderChart()}
    </div>
  );
};

export default PerformanceChart;