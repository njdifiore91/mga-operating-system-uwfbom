import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box, Tooltip, Skeleton } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { MetricTrend } from '../../types/analytics.types';
import { StatusBadge } from '../common/StatusBadge';

/**
 * Props interface for the MetricsCard component
 */
interface MetricsCardProps {
  title: string;
  value: number;
  format: 'percentage' | 'currency' | 'number' | 'compact';
  trend: MetricTrend;
  previousValue?: number;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  error?: Error | null;
  tooltipContent?: string;
  locale?: string;
  currencyCode?: string;
  animationDuration?: number;
}

/**
 * Formats numeric values based on specified format type and locale
 */
const formatValue = (
  value: number,
  format: MetricsCardProps['format'],
  locale = 'en-US',
  currencyCode = 'USD'
): string => {
  try {
    const options: Intl.NumberFormatOptions = {
      maximumFractionDigits: 2,
    };

    switch (format) {
      case 'percentage':
        options.style = 'percent';
        options.minimumFractionDigits = 1;
        return new Intl.NumberFormat(locale, options).format(value / 100);
      
      case 'currency':
        options.style = 'currency';
        options.currency = currencyCode;
        return new Intl.NumberFormat(locale, options).format(value);
      
      case 'compact':
        options.notation = 'compact';
        options.compactDisplay = 'short';
        return new Intl.NumberFormat(locale, options).format(value);
      
      default:
        return new Intl.NumberFormat(locale, options).format(value);
    }
  } catch (error) {
    console.error('Error formatting value:', error);
    return value.toString();
  }
};

/**
 * Returns appropriate trend icon with accessibility attributes
 */
const getTrendIcon = (trend: MetricTrend['trend']) => {
  const iconProps = {
    fontSize: 'small',
    sx: { 
      verticalAlign: 'middle',
      ml: 1
    },
    'aria-hidden': true
  };

  switch (trend) {
    case 'up':
      return <TrendingUp {...iconProps} color="success" />;
    case 'down':
      return <TrendingDown {...iconProps} color="error" />;
    default:
      return <TrendingFlat {...iconProps} color="action" />;
  }
};

/**
 * MetricsCard Component
 * Displays a single metric with trend indicator in a Material Design 3.0 card layout
 */
const MetricsCard: React.FC<MetricsCardProps> = React.memo(({
  title,
  value,
  format,
  trend,
  previousValue,
  className,
  style,
  loading = false,
  error = null,
  tooltipContent,
  locale = 'en-US',
  currencyCode = 'USD',
  animationDuration = 300
}) => {
  // Memoize formatted value to prevent unnecessary recalculations
  const formattedValue = useMemo(() => 
    formatValue(value, format, locale, currencyCode),
    [value, format, locale, currencyCode]
  );

  // Calculate and memoize percentage change
  const percentageChange = useMemo(() => {
    if (previousValue) {
      const change = ((value - previousValue) / previousValue) * 100;
      return formatValue(Math.abs(change), 'percentage', locale);
    }
    return null;
  }, [value, previousValue, locale]);

  if (error) {
    return (
      <Card 
        className={className}
        style={style}
        sx={{ bgcolor: 'error.light', minHeight: 140 }}
      >
        <CardContent>
          <Typography color="error.main" variant="h6">{title}</Typography>
          <Typography color="error.main" variant="body2">
            Error loading metric data
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tooltip title={tooltipContent || ''} arrow>
      <Card 
        className={className}
        style={style}
        sx={{
          minHeight: 140,
          transition: `all ${animationDuration}ms ease-in-out`,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) => theme.shadows[4]
          }
        }}
      >
        <CardContent>
          <Typography
            variant="subtitle2"
            color="textSecondary"
            gutterBottom
            sx={{ fontWeight: 500 }}
          >
            {title}
          </Typography>

          {loading ? (
            <>
              <Skeleton variant="text" width="60%" height={40} />
              <Skeleton variant="text" width="40%" />
            </>
          ) : (
            <>
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant="h4"
                  component="div"
                  sx={{
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  {formattedValue}
                  {getTrendIcon(trend.trend)}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StatusBadge
                  statusType="underwriting"
                  status={trend.trend === 'up' ? 'APPROVED' : trend.trend === 'down' ? 'REJECTED' : 'PENDING'}
                  label={`${trend.trend === 'up' ? '+' : trend.trend === 'down' ? '-' : ''}${percentageChange}`}
                  size="small"
                />
                
                {previousValue && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ ml: 1 }}
                  >
                    vs previous period
                  </Typography>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Tooltip>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;