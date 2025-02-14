import React, { useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Collapse,
  Tooltip,
  styled
} from '@mui/material';
import {
  Dashboard,
  Policy,
  Assignment,
  Description,
  Assessment,
  Folder,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import {
  DASHBOARD_ROUTES,
  POLICY_ROUTES,
  CLAIMS_ROUTES,
  UNDERWRITING_ROUTES,
  DOCUMENT_ROUTES
} from '../../constants/routes.constants';

// Styled components for enhanced theme integration
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 280,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: 280,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`
  }
}));

const StyledListItem = styled(ListItem)<{ active?: boolean }>(({ theme, active }) => ({
  padding: theme.spacing(1.5, 2),
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  },
  ...(active && {
    backgroundColor: theme.palette.primary.light,
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main
    },
    '& .MuiListItemText-primary': {
      color: theme.palette.primary.main,
      fontWeight: 600
    }
  })
}));

// Types
interface NavItem {
  path: string;
  label: string;
  icon: React.ReactElement;
  requiredRoles: string[];
  children?: NavItem[];
  ariaLabel?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isPermanent?: boolean;
}

// Helper function to check role-based access
const hasRequiredRole = (requiredRoles: string[], userRoles: string[]): boolean => {
  if (!requiredRoles.length) return true;
  return userRoles.some(role => requiredRoles.includes(role));
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isPermanent = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Navigation items with role-based access control
  const navigationItems = useMemo((): NavItem[] => [
    {
      path: DASHBOARD_ROUTES.HOME,
      label: 'Dashboard',
      icon: <Dashboard />,
      requiredRoles: [],
      ariaLabel: 'Navigate to dashboard'
    },
    {
      path: POLICY_ROUTES.ROOT,
      label: 'Policies',
      icon: <Policy />,
      requiredRoles: ['MGA_ADMIN', 'UNDERWRITER'],
      children: [
        {
          path: POLICY_ROUTES.LIST,
          label: 'Policy List',
          icon: <Folder />,
          requiredRoles: ['MGA_ADMIN', 'UNDERWRITER']
        },
        {
          path: POLICY_ROUTES.NEW,
          label: 'New Policy',
          icon: <Description />,
          requiredRoles: ['MGA_ADMIN', 'UNDERWRITER']
        }
      ]
    },
    {
      path: UNDERWRITING_ROUTES.ROOT,
      label: 'Underwriting',
      icon: <Assessment />,
      requiredRoles: ['MGA_ADMIN', 'UNDERWRITER'],
      children: [
        {
          path: UNDERWRITING_ROUTES.QUEUE,
          label: 'Review Queue',
          icon: <Assignment />,
          requiredRoles: ['MGA_ADMIN', 'UNDERWRITER']
        },
        {
          path: UNDERWRITING_ROUTES.ANALYTICS,
          label: 'Analytics',
          icon: <Assessment />,
          requiredRoles: ['MGA_ADMIN']
        }
      ]
    },
    {
      path: CLAIMS_ROUTES.ROOT,
      label: 'Claims',
      icon: <Assignment />,
      requiredRoles: ['MGA_ADMIN', 'CLAIMS_HANDLER']
    },
    {
      path: DOCUMENT_ROUTES.ROOT,
      label: 'Documents',
      icon: <Folder />,
      requiredRoles: ['MGA_ADMIN', 'UNDERWRITER', 'CLAIMS_HANDLER', 'AUDITOR']
    }
  ], []);

  // Filter navigation items based on user roles
  const filteredNavItems = useMemo(() => {
    const filterItems = (items: NavItem[]): NavItem[] => {
      return items.filter(item => {
        const hasAccess = hasRequiredRole(item.requiredRoles, authState.user?.permissions || []);
        if (item.children) {
          item.children = filterItems(item.children);
          return hasAccess && item.children.length > 0;
        }
        return hasAccess;
      });
    };
    return filterItems(navigationItems);
  }, [navigationItems, authState.user]);

  // Handle navigation item click
  const handleNavClick = useCallback((path: string) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  }, [navigate, isMobile, onClose]);

  // Handle expand/collapse of nested items
  const handleExpand = useCallback((path: string) => {
    setExpandedItems(prev =>
      prev.includes(path)
        ? prev.filter(item => item !== path)
        : [...prev, path]
    );
  }, []);

  // Render navigation items recursively
  const renderNavItems = useCallback((items: NavItem[], level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedItems.includes(item.path);
      const isActive = location.pathname === item.path;
      const hasChildren = item.children && item.children.length > 0;

      return (
        <React.Fragment key={item.path}>
          <Tooltip title={item.label} placement="right" arrow>
            <StyledListItem
              onClick={() => hasChildren ? handleExpand(item.path) : handleNavClick(item.path)}
              sx={{ pl: theme.spacing(2 + level * 2) }}
              aria-label={item.ariaLabel}
              active={isActive}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {hasChildren && (
                <IconButton size="small">
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              )}
            </StyledListItem>
          </Tooltip>
          {hasChildren && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderNavItems(item.children, level + 1)}
              </List>
            </Collapse>
          )}
        </React.Fragment>
      );
    });
  }, [expandedItems, location.pathname, handleNavClick, handleExpand, theme]);

  return (
    <StyledDrawer
      variant={isPermanent ? 'permanent' : 'temporary'}
      open={isOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
    >
      <List component="nav" aria-label="Main navigation">
        {renderNavItems(filteredNavItems)}
      </List>
    </StyledDrawer>
  );
};

export default Sidebar;