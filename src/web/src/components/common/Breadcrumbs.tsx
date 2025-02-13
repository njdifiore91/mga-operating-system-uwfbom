import React, { useMemo } from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { POLICY_ROUTES, CLAIMS_ROUTES } from 'constants/routes.constants';

/**
 * Interface for breadcrumb items with enhanced type safety
 * @property label - Human-readable label for the breadcrumb
 * @property path - URL path for the breadcrumb
 * @property isActive - Whether this is the current active breadcrumb
 */
interface BreadcrumbItem {
  label: string;
  path: string;
  isActive: boolean;
}

/**
 * Maps route paths to human-readable labels
 * Supports internationalization through key mapping
 */
const routeLabels: Record<string, string> = {
  [POLICY_ROUTES.LIST]: 'Policies',
  [POLICY_ROUTES.DETAILS]: 'Policy Details',
  [CLAIMS_ROUTES.LIST]: 'Claims',
  [CLAIMS_ROUTES.DETAILS]: 'Claim Details',
  dashboard: 'Dashboard',
  underwriting: 'Underwriting',
  documents: 'Documents',
};

/**
 * Generates breadcrumb items from the current path with error handling and caching
 * @param currentPath - Current application route path
 * @returns Array of breadcrumb items
 */
const generateBreadcrumbs = (currentPath: string): BreadcrumbItem[] => {
  try {
    // Remove trailing slashes and split path
    const pathSegments = currentPath.replace(/^\/+|\/+$/g, '').split('/');
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPathBuilder = '';

    // Generate breadcrumb items
    pathSegments.forEach((segment, index) => {
      currentPathBuilder += `/${segment}`;
      
      // Handle dynamic route parameters
      const isIdSegment = segment.match(/^[0-9a-fA-F-]+$/);
      const label = isIdSegment ? 'Details' : (routeLabels[segment] || segment);
      
      breadcrumbs.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        path: currentPathBuilder,
        isActive: index === pathSegments.length - 1
      });
    });

    return breadcrumbs;
  } catch (error) {
    console.error('Error generating breadcrumbs:', error);
    return [{ label: 'Home', path: '/', isActive: true }];
  }
};

/**
 * BreadcrumbsComponent - Renders navigation breadcrumbs with enhanced accessibility
 * @returns JSX.Element - Rendered breadcrumb navigation
 */
const BreadcrumbsComponent: React.FC = React.memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Memoize breadcrumb generation
  const breadcrumbs = useMemo(() => 
    generateBreadcrumbs(location.pathname),
    [location.pathname]
  );

  /**
   * Handles breadcrumb click navigation with analytics tracking
   * @param path - Target navigation path
   * @param event - Click event
   */
  const handleClick = (path: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    // Add analytics tracking here if needed
    navigate(path);
  };

  return (
    <nav aria-label="Breadcrumb navigation">
      <MuiBreadcrumbs
        aria-label="Navigation breadcrumbs"
        sx={{
          padding: '8px 0',
          '& .MuiBreadcrumbs-separator': {
            margin: '0 8px'
          }
        }}
      >
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return isLast ? (
            <Typography
              key={breadcrumb.path}
              color="text.primary"
              aria-current="page"
              sx={{ fontWeight: 500 }}
            >
              {breadcrumb.label}
            </Typography>
          ) : (
            <Link
              key={breadcrumb.path}
              href={breadcrumb.path}
              onClick={(e) => handleClick(breadcrumb.path, e)}
              underline="hover"
              color="inherit"
              sx={{
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              {breadcrumb.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </nav>
  );
});

BreadcrumbsComponent.displayName = 'BreadcrumbsComponent';

export default BreadcrumbsComponent;