import { useTheme, useMediaQuery, Theme, Breakpoint } from '@mui/material';
import { defaultThemeConfig } from '../../config/theme.config';

/**
 * Interface defining comprehensive breakpoint utilities
 * @interface BreakpointUtils
 */
export interface BreakpointUtils {
  // Breakpoint flags
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;

  // Utility functions
  up: (breakpoint: Breakpoint) => boolean;
  down: (breakpoint: Breakpoint) => boolean;
  between: (start: Breakpoint, end: Breakpoint) => boolean;
  only: (breakpoint: Breakpoint) => boolean;
  width: () => Breakpoint;
  isScreenSize: (size: Breakpoint) => boolean;
  getCurrentBreakpoint: () => Breakpoint;
  isWithinRange: (min: Breakpoint, max: Breakpoint) => boolean;
}

/**
 * Custom hook providing responsive breakpoint utilities with optimized performance
 * @returns {BreakpointUtils} Object containing breakpoint flags and utility functions
 */
const useBreakpoints = (): BreakpointUtils => {
  const theme = useTheme<Theme>();

  if (!theme) {
    throw new Error('useBreakpoints must be used within a ThemeProvider');
  }

  // Memoized media query matchers
  const isMobileQuery = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletQuery = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktopQuery = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLargeDesktopQuery = useMediaQuery(theme.breakpoints.up('lg'));

  // Current breakpoint flags
  const isMobile = isMobileQuery;
  const isTablet = isTabletQuery;
  const isDesktop = isDesktopQuery;
  const isLargeDesktop = isLargeDesktopQuery;

  /**
   * Checks if current width is greater than specified breakpoint
   * @param {Breakpoint} breakpoint - Material UI breakpoint key
   * @returns {boolean} True if width is greater than breakpoint
   */
  const up = (breakpoint: Breakpoint): boolean => {
    return useMediaQuery(theme.breakpoints.up(breakpoint));
  };

  /**
   * Checks if current width is less than specified breakpoint
   * @param {Breakpoint} breakpoint - Material UI breakpoint key
   * @returns {boolean} True if width is less than breakpoint
   */
  const down = (breakpoint: Breakpoint): boolean => {
    return useMediaQuery(theme.breakpoints.down(breakpoint));
  };

  /**
   * Checks if current width is between specified breakpoints
   * @param {Breakpoint} start - Starting breakpoint
   * @param {Breakpoint} end - Ending breakpoint
   * @returns {boolean} True if width is between breakpoints
   */
  const between = (start: Breakpoint, end: Breakpoint): boolean => {
    return useMediaQuery(theme.breakpoints.between(start, end));
  };

  /**
   * Checks if current width matches specified breakpoint exactly
   * @param {Breakpoint} breakpoint - Material UI breakpoint key
   * @returns {boolean} True if width matches breakpoint
   */
  const only = (breakpoint: Breakpoint): boolean => {
    return useMediaQuery(theme.breakpoints.only(breakpoint));
  };

  /**
   * Gets current breakpoint value
   * @returns {Breakpoint} Current breakpoint key
   */
  const width = (): Breakpoint => {
    const breakpoints: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    return breakpoints.reduce((acc: Breakpoint, breakpoint: Breakpoint) => {
      return only(breakpoint) ? breakpoint : acc;
    }, 'xs');
  };

  /**
   * Checks if current screen size matches specified breakpoint
   * @param {Breakpoint} size - Material UI breakpoint key
   * @returns {boolean} True if screen size matches breakpoint
   */
  const isScreenSize = (size: Breakpoint): boolean => {
    const breakpointValues = defaultThemeConfig.breakpoints?.values;
    if (!breakpointValues) return false;

    const currentWidth = window.innerWidth;
    const targetWidth = breakpointValues[size];

    return currentWidth >= targetWidth;
  };

  /**
   * Gets current breakpoint based on screen width
   * @returns {Breakpoint} Current breakpoint key
   */
  const getCurrentBreakpoint = (): Breakpoint => {
    if (isLargeDesktop) return 'lg';
    if (isDesktop) return 'md';
    if (isTablet) return 'sm';
    return 'xs';
  };

  /**
   * Checks if current width is within specified range
   * @param {Breakpoint} min - Minimum breakpoint
   * @param {Breakpoint} max - Maximum breakpoint
   * @returns {boolean} True if width is within range
   */
  const isWithinRange = (min: Breakpoint, max: Breakpoint): boolean => {
    return between(min, max);
  };

  return {
    // Breakpoint flags
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,

    // Utility functions
    up,
    down,
    between,
    only,
    width,
    isScreenSize,
    getCurrentBreakpoint,
    isWithinRange,
  };
};

export default useBreakpoints;