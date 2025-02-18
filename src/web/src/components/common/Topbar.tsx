import React, { useState, useCallback, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Badge,
  Avatar,
  useTheme,
  useMediaQuery,
  Box,
  Divider
} from '@mui/material';
import {
  Notifications,
  AccountCircle,
  Menu as MenuIcon,
  ExitToApp
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

/**
 * Props interface for Topbar component with responsive and accessibility support
 */
interface TopbarProps {
  isMobile?: boolean;
  onMenuClick?: () => void;
  className?: string;
  enableNotifications?: boolean;
}

/**
 * A reusable top navigation bar component that provides global navigation,
 * search functionality, user profile management, and notification display.
 * Implements Material Design 3.0 with full accessibility support.
 *
 * @component
 * @version 1.0.0
 */
const Topbar: React.FC<TopbarProps> = ({
  isMobile = false,
  onMenuClick,
  className = '',
  enableNotifications = true
}) => {
  // Hooks
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notification, hideNotification } = useNotification();
  
  // Responsive breakpoints
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // State management
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [searchValue, setSearchValue] = useState<string>('');

  /**
   * Handles global search functionality with debouncing
   */
  const handleSearch = useCallback(async (value: string) => {
    setSearchValue(value);
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`);
    }
  }, [navigate]);

  /**
   * Manages user profile menu with accessibility support
   */
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handles notification interactions and updates
   */
  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  /**
   * Manages secure user logout process
   */
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setAnchorEl(null);
  };

  // Close menus
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  // Effect for handling notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        hideNotification();
      }, notification.duration || 6000);

      return () => clearTimeout(timer);
    }
  }, [notification, hideNotification]);

  return (
    <AppBar 
      position="fixed" 
      className={className}
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)'
      }}
    >
      <Toolbar>
        {isMobile && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="open drawer"
            onClick={onMenuClick}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ display: { xs: 'none', sm: 'block' }, mr: 2 }}
        >
          MGA OS
        </Typography>

        {!isSmallScreen && (
          <Box sx={{ flexGrow: 1, maxWidth: '600px', mx: 2 }}>
            <SearchBar
              placeholder="Search policies, claims, or documents..."
              onSearch={handleSearch}
              initialValue={searchValue}
              ariaLabel="Global search"
              debounceMs={300}
            />
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {enableNotifications && (
            <IconButton
              aria-label={`${notification ? '1' : '0'} notifications`}
              color="inherit"
              onClick={handleNotificationClick}
            >
              <Badge badgeContent={notification ? 1 : 0} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          )}

          <IconButton
            edge="end"
            aria-label="account settings"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            {user?.firstName ? (
              <Avatar
                alt={`${user.firstName} ${user.lastName}`}
                src="/path/to/avatar"
                sx={{ width: 32, height: 32 }}
              />
            ) : (
              <AccountCircle />
            )}
          </IconButton>
        </Box>

        {/* Profile Menu */}
        <Menu
          id="profile-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          keepMounted
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={() => navigate('/profile')}>
            <Typography variant="body1">
              {user ? `${user.firstName} ${user.lastName}` : 'Profile'}
            </Typography>
          </MenuItem>
          <MenuItem onClick={() => navigate('/settings')}>Settings</MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ExitToApp sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          id="notifications-menu"
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleNotificationClose}
          keepMounted
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {notification ? (
            <MenuItem onClick={handleNotificationClose}>
              <Typography variant="body2">{notification.message}</Typography>
            </MenuItem>
          ) : (
            <MenuItem disabled>
              <Typography variant="body2">No new notifications</Typography>
            </MenuItem>
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;