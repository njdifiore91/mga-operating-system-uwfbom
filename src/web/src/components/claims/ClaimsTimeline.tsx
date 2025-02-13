import React, { useMemo, useCallback } from 'react';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import { useVirtualizer } from '@tanstack/react-virtual';
import { styled } from '@mui/material/styles';
import { Box, Typography, useTheme } from '@mui/material';
import {
  Description as DocumentIcon,
  Event as StatusIcon,
  FiberManualRecord as DefaultIcon,
} from '@mui/icons-material';
import { Claim } from '../../types/claims.types';
import { CLAIM_STATUS } from '../../constants/claims.constants';
import StatusBadge from '../common/StatusBadge';

// Version of external packages used
// @mui/lab: ^5.14.x
// @tanstack/react-virtual: ^3.0.x

interface ClaimsTimelineProps {
  claim: Claim;
  className?: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'status' | 'document' | 'creation';
  status: keyof typeof CLAIM_STATUS;
  description: string;
  metadata?: Record<string, unknown>;
  icon: React.ComponentType;
}

const StyledTimeline = styled(Timeline)(({ theme }) => ({
  padding: theme.spacing(2),
  margin: 0,
  '& .MuiTimelineItem-root': {
    minHeight: 70,
  },
  '& .MuiTimelineContent-root': {
    padding: theme.spacing(1, 2),
  },
}));

const TimelineContainer = styled(Box)(({ theme }) => ({
  height: '100%',
  maxHeight: 600,
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  '&::-webkit-scrollbar': {
    width: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.background.default,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[400],
    borderRadius: 4,
  },
}));

const generateTimelineEvents = (claim: Claim): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  // Add claim creation event
  events.push({
    id: `creation-${claim.id}`,
    date: claim.createdAt,
    type: 'creation',
    status: claim.status,
    description: 'Claim created',
    metadata: {
      claimNumber: claim.claimNumber,
      initialStatus: claim.status,
    },
    icon: StatusIcon,
  });

  // Add status change events
  if (claim.statusHistory) {
    claim.statusHistory.forEach((change, index) => {
      events.push({
        id: `status-${claim.id}-${index}`,
        date: change.date,
        type: 'status',
        status: change.status,
        description: `Status changed to ${change.status}`,
        metadata: {
          previousStatus: change.previousStatus,
          reason: change.reason,
        },
        icon: StatusIcon,
      });
    });
  }

  // Add document events
  claim.documents.forEach((doc) => {
    events.push({
      id: `document-${doc.id}`,
      date: doc.uploadedAt,
      type: 'document',
      status: claim.status,
      description: `Document uploaded: ${doc.fileName}`,
      metadata: {
        documentId: doc.id,
        documentType: doc.type,
        fileSize: doc.fileSize,
        uploadedBy: doc.uploadedBy,
      },
      icon: DocumentIcon,
    });
  });

  // Sort events by date in descending order
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const ClaimsTimeline: React.FC<ClaimsTimelineProps> = React.memo(({ claim, className }) => {
  const theme = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Generate and memoize timeline events
  const events = useMemo(() => generateTimelineEvents(claim), [claim]);

  // Set up virtualization
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 70,
    overscan: 5,
  });

  // Format date for display
  const formatDate = useCallback((date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown' && index < events.length - 1) {
      virtualizer.scrollToIndex(index + 1);
    } else if (event.key === 'ArrowUp' && index > 0) {
      virtualizer.scrollToIndex(index - 1);
    }
  }, [events.length, virtualizer]);

  return (
    <TimelineContainer ref={containerRef} className={className}>
      <StyledTimeline>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const event = events[virtualRow.index];
            return (
              <TimelineItem
                key={event.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, virtualRow.index)}
                role="listitem"
                aria-label={`${event.description} on ${formatDate(event.date)}`}
              >
                <TimelineSeparator>
                  <TimelineDot
                    color={event.type === 'status' ? 'primary' : 'secondary'}
                    sx={{ p: 1 }}
                  >
                    <event.icon fontSize="small" />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1" component="div">
                      {event.description}
                    </Typography>
                    <StatusBadge
                      statusType="claim"
                      status={event.status}
                      size="small"
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="div"
                    sx={{ mt: 0.5 }}
                  >
                    {formatDate(event.date)}
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </div>
      </StyledTimeline>
    </TimelineContainer>
  );
});

ClaimsTimeline.displayName = 'ClaimsTimeline';

export default ClaimsTimeline;