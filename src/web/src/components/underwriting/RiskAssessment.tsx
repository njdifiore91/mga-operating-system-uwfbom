import React, { useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  CircularProgress,
  Divider,
  Tooltip,
  Alert,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  WarningAmber,
  CheckCircle,
  Error,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  InfoOutlined,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { IRiskAssessmentDisplay, RiskSeverity } from '../../types/underwriting.types';
import { useUnderwriting } from '../../hooks/useUnderwriting';
import StatusBadge from '../common/StatusBadge';
import { RISK_SEVERITY } from '../../constants/underwriting.constants';

// Styled components for enhanced visualization
const RiskScoreCircle = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: 120,
  height: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: theme.spacing(2),
}));

const RiskFactorItem = styled(ListItem)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface RiskAssessmentProps {
  policyId: string;
  showDetails?: boolean;
  onAssessmentComplete?: (assessment: IRiskAssessmentDisplay) => void;
  enableRealTime?: boolean;
}

type RiskTrend = 'INCREASING' | 'DECREASING' | 'STABLE';

const RiskAssessment: React.FC<RiskAssessmentProps> = ({
  policyId,
  showDetails = true,
  onAssessmentComplete,
  enableRealTime = true,
}) => {
  const {
    riskAssessment,
    isLoading,
    error,
    submitForUnderwriting,
  } = useUnderwriting({ policyId });

  // Handle real-time updates subscription
  useEffect(() => {
    if (enableRealTime && policyId) {
      submitForUnderwriting(policyId);
    }
  }, [enableRealTime, policyId, submitForUnderwriting]);

  // Notify parent component when assessment is complete
  useEffect(() => {
    if (riskAssessment && onAssessmentComplete) {
      onAssessmentComplete(riskAssessment);
    }
  }, [riskAssessment, onAssessmentComplete]);

  // Get appropriate icon for risk severity
  const getRiskSeverityIcon = useCallback((severity: RiskSeverity) => {
    const icons = {
      [RiskSeverity.LOW]: <CheckCircle color="success" />,
      [RiskSeverity.MEDIUM]: <WarningAmber color="warning" />,
      [RiskSeverity.HIGH]: <Error color="error" />,
    };
    return icons[severity] || <InfoOutlined />;
  }, []);

  // Get trend icon and color
  const getTrendIndicator = useCallback((trend: RiskTrend) => {
    const indicators = {
      INCREASING: { icon: <TrendingUp color="error" />, label: 'Risk Increasing' },
      DECREASING: { icon: <TrendingDown color="success" />, label: 'Risk Decreasing' },
      STABLE: { icon: <TrendingFlat color="info" />, label: 'Risk Stable' },
    };
    return indicators[trend] || indicators.STABLE;
  }, []);

  // Memoized risk factors list with sorting
  const sortedRiskFactors = useMemo(() => {
    if (!riskAssessment?.factors) return [];
    return [...riskAssessment.factors].sort((a, b) => {
      // Sort by severity first, then by score
      if (a.severity !== b.severity) {
        return b.severity.localeCompare(a.severity);
      }
      return b.score - a.score;
    });
  }, [riskAssessment?.factors]);

  if (isLoading) {
    return (
      <Card sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load risk assessment
      </Alert>
    );
  }

  if (!riskAssessment) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No risk assessment data available
      </Alert>
    );
  }

  return (
    <Card sx={{ p: 3 }}>
      {/* Risk Score Overview */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <RiskScoreCircle>
          <CircularProgress
            variant="determinate"
            value={riskAssessment.riskScore}
            size={120}
            thickness={8}
            sx={{
              color: RISK_SEVERITY[riskAssessment.severity as keyof typeof RISK_SEVERITY].color,
              position: 'absolute',
            }}
          />
          <Typography variant="h4" component="div">
            {riskAssessment.riskScore}
          </Typography>
        </RiskScoreCircle>
        <Box>
          <StatusBadge
            statusType="underwriting"
            status={riskAssessment.severity}
            label={RISK_SEVERITY[riskAssessment.severity as keyof typeof RISK_SEVERITY].label}
          />
          {riskAssessment.trend && (
            <Tooltip title={getTrendIndicator(riskAssessment.trend as RiskTrend).label}>
              <IconButton size="small" sx={{ ml: 1 }}>
                {getTrendIndicator(riskAssessment.trend as RiskTrend).icon}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Risk Factors List */}
      {showDetails && (
        <List>
          {sortedRiskFactors.map((factor, index) => (
            <RiskFactorItem
              key={`${factor.type}-${index}`}
              divider
            >
              <ListItemIcon>
                {getRiskSeverityIcon(factor.severity)}
              </ListItemIcon>
              <ListItemText
                primary={factor.type}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Score: {factor.score}
                    </Typography>
                    {factor.details?.description && (
                      <Typography variant="body2" color="text.secondary">
                        {factor.details.description}
                      </Typography>
                    )}
                  </Box>
                }
              />
              {factor.trend && (
                <Tooltip title={getTrendIndicator(factor.trend as RiskTrend).label}>
                  <IconButton size="small">
                    {getTrendIndicator(factor.trend as RiskTrend).icon}
                  </IconButton>
                </Tooltip>
              )}
            </RiskFactorItem>
          ))}
        </List>
      )}
    </Card>
  );
};

export default React.memo(RiskAssessment);