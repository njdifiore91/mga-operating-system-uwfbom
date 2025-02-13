/**
 * @fileoverview Font configuration for MGA OS platform implementing Material Design 3.0 standards
 * @version 1.0.0
 * 
 * Provides a comprehensive typography system that ensures:
 * - Accessibility (WCAG 2.1 Level AA compliance)
 * - Cross-platform consistency
 * - Clear visual hierarchy
 * - Optimal performance
 */

/**
 * Primary font family stack optimized for system fonts first,
 * falling back to web-safe alternatives
 */
export const fontFamily = `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif`;

/**
 * Font weights following Material Design guidelines
 * Used to establish visual hierarchy and emphasis in typography
 */
export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Font size scale implementing a clear typographic hierarchy
 * All sizes use relative units (rem) for accessibility and responsive design
 * Scale follows Material Design type scale with custom adjustments for MGA OS
 */
export const fontSizes = {
  // Heading styles
  h1: '2.5rem',    // 40px at base 16px
  h2: '2rem',      // 32px at base 16px
  h3: '1.75rem',   // 28px at base 16px
  h4: '1.5rem',    // 24px at base 16px
  h5: '1.25rem',   // 20px at base 16px
  h6: '1.125rem',  // 18px at base 16px

  // Body text styles
  body1: '1rem',     // 16px at base 16px - Primary body text
  body2: '0.875rem', // 14px at base 16px - Secondary body text
  caption: '0.75rem' // 12px at base 16px - Caption text
} as const;

/**
 * Type definitions for font configuration objects
 * Ensures type safety when using font configurations throughout the application
 */
export type FontWeight = keyof typeof fontWeights;
export type FontSize = keyof typeof fontSizes;

/**
 * Default export combining all typography configurations
 * Provides a single import point for all typography-related constants
 */
export default {
  fontFamily,
  fontWeights,
  fontSizes
} as const;