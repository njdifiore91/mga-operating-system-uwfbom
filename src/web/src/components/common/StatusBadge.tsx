import React, { useMemo } from 'react';
import { Chip, ChipProps } from '@mui/material';
import { styled, useTheme, Theme } from '@mui/material/styles';
import { PolicyStatus } from '../../types/policy.types';
import { CLAIM_STATUS } from '../../constants/claims.constants';

// Define status types supported by the badge
export type StatusType = 'policy' | 'claim' | 'underwriting';

// Props interface for the StatusBadge component
export interface StatusBadgeProps extends Omit<ChipProps, 'color'> {
  statusType: StatusType;
  status: string;
  label?: string;
  size?: 'small' | 'medium';
  className?: string;
}

// Styled Chip component with dynamic color mapping based on status
const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => !['statusType', 'status'].includes(prop as string),
})<{ statusType: StatusType; status: string }>(({ theme, statusType, status }) => {
  const getStatusColor = (type: StatusType, currentStatus: string): string => {
    const colors = {
      policy: {
        [PolicyStatus.DRAFT]: theme.palette.grey[500],
        [PolicyStatus.SUBMITTED]: theme.palette.info.main,
        [PolicyStatus.IN_REVIEW]: theme.palette.warning.main,
        [PolicyStatus.APPROVED]: theme.palette.success.main,
        [PolicyStatus.BOUND]: theme.palette.success.dark,
        [PolicyStatus.ACTIVE]: theme.palette.success.main,
        [PolicyStatus.CANCELLED]: theme.palette.error.main,
        [PolicyStatus.EXPIRED]: theme.palette.error.light
      },
      claim: {
        [CLAIM_STATUS.NEW]: theme.palette.info.main,
        [CLAIM_STATUS.UNDER_REVIEW]: theme.palette.warning.main,
        [CLAIM_STATUS.PENDING_INFO]: theme.palette.warning.light,
        [CLAIM_STATUS.APPROVED]: theme.palette.success.main,
        [CLAIM_STATUS.IN_PAYMENT]: theme.palette.success.light,
        [CLAIM_STATUS.PAID]: theme.palette.success.dark,
        [CLAIM_STATUS.DENIED]: theme.palette.error.main,
        [CLAIM_STATUS.CLOSED]: theme.palette.grey[700],
        [CLAIM_STATUS.REOPENED]: theme.palette.warning.dark
      },
      underwriting: {
        PENDING: theme.palette.warning.main,
        APPROVED: theme.palette.success.main,
        REJECTED: theme.palette.error.main,
        REFERRED: theme.palette.warning.light
      }
    };

    return colors[type]?.[currentStatus] || theme.palette.grey[500];
  };

  return {
    backgroundColor: getStatusColor(statusType, status),
    color: theme.palette.getContrastText(getStatusColor(statusType, status)),
    fontWeight: 500,
    '&:hover': {
      backgroundColor: getStatusColor(statusType, status),
      opacity: 0.9
    },
    // Ensure WCAG 2.1 AA contrast compliance
    '& .MuiChip-label': {
      color: theme.palette.getContrastText(getStatusColor(statusType, status))
    }
  };
});

/**
 * StatusBadge Component
 * Displays a colored badge to represent various status states across the application
 * with proper accessibility support and consistent styling.
 */
const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({
  statusType,
  status,
  label,
  size = 'small',
  className,
  ...props
}) => {
  const theme = useTheme();

  // Generate display label if not provided
  const displayLabel = useMemo(() => {
    if (label) return label;

    // Map status to human-readable labels
    const labels = {
      policy: {
        [PolicyStatus.DRAFT]: 'Draft',
        [PolicyStatus.SUBMITTED]: 'Submitted',
        [PolicyStatus.IN_REVIEW]: 'In Review',
        [PolicyStatus.APPROVED]: 'Approved',
        [PolicyStatus.BOUND]: 'Bound',
        [PolicyStatus.ACTIVE]: 'Active',
        [PolicyStatus.CANCELLED]: 'Cancelled',
        [PolicyStatus.EXPIRED]: 'Expired'
      },
      claim: CLAIM_STATUS,
      underwriting: {
        PENDING: 'Pending Review',
        APPROVED: 'Approved',
        REJECTED: 'Rejected',
        REFERRED: 'Referred'
      }
    };

    return labels[statusType]?.[status] || status;
  }, [statusType, status, label]);

  return (
    <StyledChip
      statusType={statusType}
      status={status}
      label={displayLabel}
      size={size}
      className={className}
      // Accessibility attributes
      role="status"
      aria-label={`Status: ${displayLabel}`}
      {...props}
    />
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;