import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, useTheme, useMediaQuery } from '@mui/material'; // v5.14.0
import Sidebar from '../common/Sidebar';
import Topbar from '../common/Topbar';
import useBreakpoints from '../../hooks/useBreakpoints';
import { useAuth } from '../../hooks/useAuth';

/**
 * Props interface for MainLayout component with accessibility and styling options
 */
interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

/**
 * Main layout component that provides the primary application structure
 * Implements WCAG 2.1 Level AA compliance and responsive design
 * @version 1.0.0
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  className = '',
  role = 'main',
  'aria-label': ariaLabel = 'Main content'
}) => {
  // Theme and responsive breakpoints
  const theme = useTheme();
  const { isMobile } = useBreakpoints();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  // Authentication and user context
  const { isAuthenticated } = useAuth();

  // Sidebar state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  /**
   * Handles sidebar toggle with accessibility considerations
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);

    // Announce state change to screen readers
    const announcement = !isSidebarOpen ? 'Navigation menu opened' : 'Navigation menu closed';
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = 'sr-only';
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  }, [isSidebarOpen]);

  /**
   * Handle responsive layout adjustments
   */
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSidebarOpen && isMobile) {
        handleSidebarToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, isMobile, handleSidebarToggle]);

  // Calculate content margin based on sidebar state and screen size
  const contentMargin = isLargeScreen ? '280px' : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default
      }}
    >
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{
          position: 'absolute',
          padding: theme.spacing(2),
          backgroundColor: theme.palette.background.paper,
          zIndex: theme.zIndex.modal + 1
        }}
      >
        Skip to main content
      </a>

      {/* Navigation sidebar with role-based access */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarToggle}
        isPermanent={isLargeScreen}
      />

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginLeft: isLargeScreen && isSidebarOpen ? contentMargin : 0,
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
          })
        }}
      >
        {/* Top navigation bar */}
        <Topbar
          isMobile={isMobile}
          onMenuClick={handleSidebarToggle}
          enableNotifications={isAuthenticated}
        />

        {/* Main content container */}
        <Container
          id="main-content"
          role={role}
          aria-label={ariaLabel}
          className={className}
          maxWidth={false}
          sx={{
            mt: { xs: 8, sm: 9 },
            mb: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 2, sm: 3 },
            position: 'relative'
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default MainLayout;