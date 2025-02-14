import React, { useMemo } from 'react';
import { Timeline, TimelineItem, TimelineSeparator, TimelineContent, TimelineDot } from '@mui/lab';
import { Typography, Box, useTheme } from '@mui/material';
import { IPolicy } from '../../types/policy.types';
import StatusBadge from '../common/StatusBadge';
import { formatDate } from '../../utils/date.utils';
import { DateRange } from '../../types/common.types';

// Define importance levels for timeline events
enum EventImportance {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Interface for timeline events
interface TimelineEvent {
  id: string;
  date: Date;
  type: string;
  description: string;
  status?: string;
  metadata?: {
    premiumChange?: number;
    policyNumber?: string;
    changes?: Record<string, any>;
  };
  importance: EventImportance;
}

// Props interface for the PolicyTimeline component
interface PolicyTimelineProps {
  policy: IPolicy;
  className?: string;
  dateRange?: DateRange;
  eventTypes?: string[];
}

// Function to determine event dot color based on type and importance
const getEventDotColor = (eventType: string, importance: EventImportance): "error" | "success" | "primary" | "secondary" | "inherit" | "grey" | "warning" | "info" => {
  const colorMap: Record<string, Record<EventImportance, "error" | "success" | "primary" | "secondary" | "inherit" | "grey" | "warning" | "info">> = {
    status: {
      [EventImportance.HIGH]: 'error',
      [EventImportance.MEDIUM]: 'warning',
      [EventImportance.LOW]: 'info'
    },
    endorsement: {
      [EventImportance.HIGH]: 'secondary',
      [EventImportance.MEDIUM]: 'primary',
      [EventImportance.LOW]: 'info'
    },
    creation: {
      [EventImportance.HIGH]: 'success',
      [EventImportance.MEDIUM]: 'success',
      [EventImportance.LOW]: 'success'
    }
  };

  return colorMap[eventType]?.[importance] || 'grey';
};

// Function to generate timeline events from policy data
const generateTimelineEvents = (
  policy: IPolicy,
  dateRange?: DateRange,
  eventTypes?: string[]
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  // Add policy creation event
  events.push({
    id: `creation-${policy.id}`,
    date: new Date(policy.createdAt),
    type: 'creation',
    description: 'Policy Created',
    importance: EventImportance.MEDIUM,
    metadata: {
      policyNumber: policy.policyNumber
    }
  });

  // Add status change events
  if (policy.status) {
    events.push({
      id: `status-${policy.id}-${policy.status}`,
      date: new Date(policy.updatedAt),
      type: 'status',
      description: 'Status Changed',
      status: policy.status,
      importance: EventImportance.HIGH
    });
  }

  // Add endorsement events
  policy.endorsements?.forEach(endorsement => {
    events.push({
      id: `endorsement-${endorsement.id}`,
      date: new Date(endorsement.effectiveDate),
      type: 'endorsement',
      description: `Endorsement: ${endorsement.type}`,
      importance: endorsement.premiumChange > 0 ? EventImportance.HIGH : EventImportance.MEDIUM,
      metadata: {
        premiumChange: endorsement.premiumChange,
        changes: endorsement.changes
      }
    });
  });

  // Apply date range filter if specified
  let filteredEvents = events;
  if (dateRange) {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    filteredEvents = events.filter(event => 
      event.date >= startDate && event.date <= endDate
    );
  }

  // Apply event type filter if specified
  if (eventTypes?.length) {
    filteredEvents = filteredEvents.filter(event => 
      eventTypes.includes(event.type)
    );
  }

  // Sort events by date in descending order
  return filteredEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
};

/**
 * PolicyTimeline Component
 * Displays a chronological timeline of policy events with enhanced filtering and accessibility
 */
const PolicyTimeline: React.FC<PolicyTimelineProps> = ({
  policy,
  className,
  dateRange,
  eventTypes
}) => {
  const theme = useTheme();

  // Generate and memoize timeline events
  const events = useMemo(() => 
    generateTimelineEvents(policy, dateRange, eventTypes),
    [policy, dateRange, eventTypes]
  );

  return (
    <Box className={className} role="region" aria-label="Policy Timeline">
      <Timeline>
        {events.map(event => (
          <TimelineItem
            key={event.id}
            sx={{ minHeight: 70 }}
          >
            <TimelineSeparator>
              <TimelineDot 
                color={getEventDotColor(event.type, event.importance)}
                sx={{ margin: theme.spacing(1) }}
              />
            </TimelineSeparator>
            <TimelineContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  {formatDate(event.date)}
                </Typography>
                {event.status && (
                  <StatusBadge
                    statusType="policy"
                    status={event.status}
                    size="small"
                  />
                )}
              </Box>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {event.description}
              </Typography>
              {event.metadata?.premiumChange !== undefined && (
                <Typography 
                  variant="body2" 
                  color={event.metadata.premiumChange > 0 ? 'error' : 'success'}
                  sx={{ mt: 0.5 }}
                >
                  Premium Change: ${event.metadata.premiumChange.toLocaleString()}
                </Typography>
              )}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
};

export default PolicyTimeline;