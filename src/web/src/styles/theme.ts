import { createTheme, Theme, ThemeOptions, responsiveFontSizes } from '@mui/material'; // @mui/material@5.14.x

// Base spacing unit for consistent spacing across the application
const SPACING_UNIT = 8;

// System font stack for optimal performance and consistency
const FONT_FAMILY = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

// Theme configuration options implementing Material Design 3.0 principles
const themeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: '#0066CC',
      light: '#3399FF',
      dark: '#004C99',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#666666',
      light: '#999999',
      dark: '#333333',
      contrastText: '#FFFFFF',
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
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
      disabled: '#999999',
    },
  },
  typography: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    // Fluid typography using clamp for responsive scaling
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
  },
  // Responsive breakpoints aligned with design specifications
  breakpoints: {
    values: {
      xs: 320,
      sm: 768,
      md: 1024,
      lg: 1440,
      xl: 1920,
    },
  },
  // Component style customizations for consistent look and feel
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          '&:focus-visible': {
            outline: '2px solid #0066CC',
            outlineOffset: '2px',
          },
        },
      },
      variants: [
        {
          props: { variant: 'contained' },
          style: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'box-shadow 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
            '&:focus-within': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#0066CC',
                borderWidth: '2px',
              },
            },
          },
        },
      },
    },
  },
  spacing: SPACING_UNIT,
};

// Create the theme with responsive typography
const createAppTheme = (): Theme => {
  const theme = createTheme(themeOptions);
  return responsiveFontSizes(theme);
};

// Export the configured theme
const theme = createAppTheme();
export default theme;