import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, Typography, CircularProgress, Tooltip, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart, ResponsiveContainer, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import useWebSocket from 'react-use-websocket';

import { UnderwritingMetrics } from '../../types/analytics.types';
import StatusBadge from '../common/StatusBadge';

// WebSocket endpoint for real-time updates
const WS_ENDPOINT = `${process.env.REACT_APP_WS_URL}/analytics/risk-scores`;

interface RiskScoreWidgetProps {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  refreshInterval?: number;
}

interface RiskScoreDisplay {
  score: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

// Color mapping function with WCAG compliance
const getRiskLevelColor = (riskLevel: string, theme: any) => {
  const colors = {
    low: theme.palette.success.main,
    medium: theme.palette.warning.main,
    high: theme.palette.error.main
  };
  
  // Ensure contrast ratio meets WCAG AA standards
  return colors[riskLevel.toLowerCase()] || theme.palette.grey[500];
};

// Format risk score with trend analysis
const formatRiskScore = (
  score: number,
  historicalData: Array<{ date: string; score: number }>
): RiskScoreDisplay => {
  const currentScore = Math.round(score);
  const previousScore = historicalData[historicalData.length - 2]?.score || score;
  const change = ((currentScore - previousScore) / previousScore) * 100;
  
  return {
    score: currentScore,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
    change: Math.abs(change)
  };
};

const RiskScoreWidget: React.FC<RiskScoreWidgetProps> = ({
  dateRange,
  refreshInterval = 30000
}) => {
  const theme = useTheme();
  const [metrics, setMetrics] = useState<UnderwritingMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const { lastMessage, sendMessage } = useWebSocket(WS_ENDPOINT, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10
  });

  // Memoized risk distribution data for performance
  const riskDistributionData = useMemo(() => {
    if (!metrics?.riskScoreDistribution) return [];
    
    return Object.entries(metrics.riskScoreDistribution).map(([level, value]) => ({
      name: level,
      value,
      color: getRiskLevelColor(level, theme)
    }));
  }, [metrics?.riskScoreDistribution, theme]);

  // Virtual scroll for large datasets
  const rowVirtualizer = useVirtualizer({
    count: riskDistributionData.length,
    getScrollElement: () => document.querySelector('.risk-distribution-list'),
    estimateSize: () => 40,
    overscan: 5
  });

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const updatedMetrics = JSON.parse(lastMessage.data);
        setMetrics(prevMetrics => ({
          ...prevMetrics,
          ...updatedMetrics
        }));
        setLoading(false);
      } catch (err) {
        setError('Error processing real-time updates');
      }
    }
  }, [lastMessage]);

  // Request initial data and set up refresh interval
  useEffect(() => {
    const fetchData = () => {
      sendMessage(JSON.stringify({ dateRange }));
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);

    return () => clearInterval(interval);
  }, [dateRange, refreshInterval, sendMessage]);

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress aria-label="Loading risk score data" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" role="alert">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const formattedScore = metrics ? formatRiskScore(
    metrics.automationRate,
    metrics.historicalTrend || []
  ) : null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Risk Score Analysis
        </Typography>
        
        {/* Current Risk Score */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary">
            Current Automation Rate
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4">
              {formattedScore?.score}%
            </Typography>
            <StatusBadge
              statusType="underwriting"
              status={formattedScore?.trend === 'up' ? 'APPROVED' : 'PENDING'}
              label={`${formattedScore?.change.toFixed(1)}% ${formattedScore?.trend}`}
              aria-label={`Trend: ${formattedScore?.change.toFixed(1)}% ${formattedScore?.trend}`}
            />
          </Box>
        </Box>

        {/* Risk Distribution Chart */}
        <Box sx={{ height: 300 }} role="img" aria-label="Risk score distribution chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskDistributionData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
              >
                {riskDistributionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    aria-label={`${entry.name}: ${entry.value}%`}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{ backgroundColor: theme.palette.background.paper }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* Risk Level Legend */}
        <Box 
          className="risk-distribution-list"
          sx={{ 
            mt: 2,
            maxHeight: 200,
            overflowY: 'auto',
            '&:focus': { outline: `2px solid ${theme.palette.primary.main}` }
          }}
          tabIndex={0}
          role="list"
          aria-label="Risk level distribution"
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = riskDistributionData[virtualRow.index];
            return (
              <Box
                key={virtualRow.index}
                role="listitem"
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1,
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <Typography variant="body2">{item.name}</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {item.value}%
                </Typography>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

export default RiskScoreWidget;