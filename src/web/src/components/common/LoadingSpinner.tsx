import { CircularProgress, Box } from '@mui/material'; // @mui/material@5.14.x
import { useTheme } from '@mui/material/styles';

interface LoadingSpinnerProps {
  /**
   * Size of the spinner in pixels
   * @default 40
   */
  size?: number;
  
  /**
   * Color of the spinner from theme palette
   * @default 'primary.main'
   */
  color?: string;
  
  /**
   * Whether to center in viewport
   * @default false
   */
  fullScreen?: boolean;
}

/**
 * A reusable loading spinner component that provides visual feedback during
 * asynchronous operations. Implements Material Design guidelines and maintains
 * accessibility standards.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = 'primary.main',
  fullScreen = false,
}) => {
  const theme = useTheme();

  // Container styles for positioning
  const containerStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...(fullScreen && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: theme.zIndex.modal,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
    }),
  };

  // Handle reduced motion preference
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animationDuration = reducedMotion ? '2s' : '1.4s';

  return (
    <Box
      sx={containerStyles}
      role="progressbar"
      aria-busy="true"
      aria-live="polite"
    >
      <CircularProgress
        size={size}
        sx={{
          color,
          animationDuration,
          // Optimize animation performance
          willChange: 'transform',
          '@media (prefers-reduced-motion: reduce)': {
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
          },
        }}
      />
    </Box>
  );
};

export default LoadingSpinner;