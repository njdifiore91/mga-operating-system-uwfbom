import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  useTheme,
  useMediaQuery,
  styled
} from '@mui/material';
import Sidebar from '../common/Sidebar';
import Topbar from '../common/Topbar';
import useBreakpoints from '../../hooks/useBreakpoints';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components for enhanced theme integration
const StyledRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default
}));

const StyledMain = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.standard,
  }),
}));

const StyledContent = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  width: '100%',
  padding: theme.spacing(3),
  marginTop: 64, // Height of Topbar
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(5),
  },
}));

// Props interface
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  initialSidebarState?: boolean;
}

/**
 * DashboardLayout component providing the main application structure
 * Implements responsive layout with Material Design 3.0 and WCAG 2.1 Level AA compliance
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className = '',
  initialSidebarState = true
}) => {
  const theme = useTheme();
  const { isMobile } = useBreakpoints();
  const isPermanentSidebar = useMediaQuery(theme.breakpoints.up('lg'));

  // State management
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const savedState = localStorage.getItem('mga_sidebar_state');
    return savedState ? JSON.parse(savedState) : initialSidebarState;
  });

  // Handle sidebar toggle with persistence
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev: boolean) => {
      const newState = !prev;
      localStorage.setItem('mga_sidebar_state', JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Handle window resize events with debouncing
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (isPermanentSidebar && !isSidebarOpen) {
          setIsSidebarOpen(true);
        }
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [isPermanentSidebar, isSidebarOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === '[' && event.ctrlKey) {
        handleSidebarToggle();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleSidebarToggle]);

  return (
    <ErrorBoundary>
      <StyledRoot className={className}>
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isPermanent={isPermanentSidebar}
        />

        {/* Main content area */}
        <StyledMain
          role="main"
          sx={{
            marginLeft: {
              lg: isSidebarOpen ? '280px' : 0
            },
            width: {
              lg: isSidebarOpen ? 'calc(100% - 280px)' : '100%'
            }
          }}
        >
          {/* Top navigation bar */}
          <Topbar
            isMobile={isMobile}
            onMenuClick={handleSidebarToggle}
            enableNotifications
          />

          {/* Page content */}
          <StyledContent
            maxWidth={false}
            role="main"
            aria-label="Page content"
          >
            {children}
          </StyledContent>
        </StyledMain>
      </StyledRoot>
    </ErrorBoundary>
  );
};

export default DashboardLayout;