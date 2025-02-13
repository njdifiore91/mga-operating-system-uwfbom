import React, { useCallback } from 'react';
import { Box, Typography, Divider, useTheme } from '@mui/material'; // v5.14.x
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.x
import Breadcrumbs from './Breadcrumbs';
import SearchBar from './SearchBar';

/**
 * Props interface for the PageHeader component
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBreadcrumbs?: boolean;
  showSearch?: boolean;
  onSearch?: (value: string) => void;
  actions?: React.ReactNode;
  className?: string;
  analyticsData?: Record<string, any>;
}

/**
 * Error fallback component for the PageHeader
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box role="alert" p={2}>
    <Typography variant="h6" color="error">Error in Page Header</Typography>
    <Typography variant="body2">{error.message}</Typography>
  </Box>
);

/**
 * PageHeader Component - Provides consistent header styling and navigation
 * Implements Material Design guidelines and WCAG 2.1 Level AA compliance
 */
const PageHeader: React.FC<PageHeaderProps> = React.memo(({
  title,
  subtitle,
  showBreadcrumbs = true,
  showSearch = false,
  onSearch,
  actions,
  className = '',
  analyticsData
}) => {
  const theme = useTheme();

  /**
   * Handles search with analytics tracking
   */
  const handleSearch = useCallback((value: string) => {
    if (onSearch) {
      // Track search analytics if analyticsData is provided
      if (analyticsData) {
        // Analytics implementation would go here
        console.debug('Search analytics:', { value, ...analyticsData });
      }
      onSearch(value);
    }
  }, [onSearch, analyticsData]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        component="header"
        className={`page-header ${className}`}
        sx={{
          width: '100%',
          mb: 4,
          '& > *:not(:last-child)': {
            mb: 2
          }
        }}
      >
        {/* Breadcrumb Navigation */}
        {showBreadcrumbs && (
          <Box mb={2}>
            <Breadcrumbs />
          </Box>
        )}

        {/* Header Content */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: {
              xs: 'column',
              md: 'row'
            },
            alignItems: {
              xs: 'flex-start',
              md: 'center'
            },
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          {/* Title Section */}
          <Box flex="1">
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: {
                  xs: theme.typography.h5.fontSize,
                  md: theme.typography.h4.fontSize
                },
                fontWeight: 600,
                color: 'text.primary',
                mb: subtitle ? 1 : 0
              }}
            >
              {title}
            </Typography>
            
            {subtitle && (
              <Typography
                variant="subtitle1"
                color="text.secondary"
                sx={{
                  fontSize: {
                    xs: theme.typography.body2.fontSize,
                    md: theme.typography.body1.fontSize
                  }
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Actions Section */}
          {actions && (
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              {actions}
            </Box>
          )}
        </Box>

        {/* Search Bar */}
        {showSearch && (
          <Box mt={2}>
            <SearchBar
              placeholder="Search..."
              onSearch={handleSearch}
              ariaLabel={`Search ${title}`}
              debounceMs={300}
            />
          </Box>
        )}

        <Divider 
          sx={{ 
            mt: 3,
            borderColor: theme.palette.divider
          }} 
        />
      </Box>
    </ErrorBoundary>
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;