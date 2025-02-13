import { Theme, ThemeOptions, createTheme } from '@mui/material';

// Global constants
const SPACING_UNIT = 8;
const TRANSITION_DURATION = 200;

/**
 * @interface ThemeConfig
 * @description Comprehensive theme configuration interface with strict typing
 */
export interface ThemeConfig extends Theme {
  palette: Theme['palette'] & {
    primary: {
      hover: string;
      active: string;
    };
    secondary: {
      hover: string;
      active: string;
    };
  };
}

/**
 * @constant defaultThemeConfig
 * @description Default theme configuration implementing WCAG 2.1 AA compliant design system
 */
export const defaultThemeConfig: ThemeOptions = {
  palette: {
    primary: {
      main: '#0066CC',
      light: '#3399FF',
      dark: '#004C99',
      contrastText: '#FFFFFF',
      hover: '#0052A3',
      active: '#003D7A',
    },
    secondary: {
      main: '#666666',
      light: '#999999',
      dark: '#333333',
      contrastText: '#FFFFFF',
      hover: '#737373',
      active: '#595959',
    },
    error: {
      main: '#DC3545',
      light: '#FF4D4D',
      dark: '#CC0000',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#FFC107',
      light: '#FFD700',
      dark: '#CC9900',
      contrastText: '#000000',
    },
    success: {
      main: '#28A745',
      light: '#33CC33',
      dark: '#006600',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#17A2B8',
      light: '#4DC4D6',
      dark: '#117A8B',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
      elevated: '#FFFFFF',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
      disabled: '#999999',
    },
    divider: 'rgba(0, 0, 0, 0.12)',
  },
  typography: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
    fontSize: 16,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontSize: 'clamp(2rem, 5vw, 2.5rem)',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: 'clamp(1.75rem, 4vw, 2rem)',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '0em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      letterSpacing: '0.01071em',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.66,
      letterSpacing: '0.03333em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.75,
      letterSpacing: '0.02857em',
      textTransform: 'none',
    },
  },
  breakpoints: {
    values: {
      xs: 320,
      sm: 768,
      md: 1024,
      lg: 1440,
      xl: 1920,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          padding: '8px 16px',
          transition: `all ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: `box-shadow ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: `${SPACING_UNIT * 2}px`,
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#F5F5F5',
        },
      },
    },
  },
  spacing: SPACING_UNIT,
  shape: {
    borderRadius: 4,
  },
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    },
  },
};

// Create and export the theme with proper typing
export const theme = createTheme(defaultThemeConfig) as ThemeConfig;