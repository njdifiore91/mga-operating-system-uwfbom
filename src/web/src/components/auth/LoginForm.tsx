import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  TextField,
  Button,
  Alert,
  Box,
  Paper,
  Typography,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import { LoginCredentials, MFAVerification, AuthError } from '../../types/auth.types';

// Form validation schema
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(12, 'Password must be at least 12 characters')
    .required('Password is required'),
  mfaCode: yup
    .string()
    .matches(/^\d{6}$/, 'MFA code must be 6 digits')
    .when('$requiresMFA', {
      is: true,
      then: yup.string().required('MFA code is required'),
    }),
});

interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: AuthError) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  // State management
  const [showPassword, setShowPassword] = useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Auth hook
  const { login, verifyMFA, isLoading, error } = useAuth();

  // Form handling
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm({
    resolver: yupResolver(loginSchema),
    mode: 'onBlur',
    context: { requiresMFA }
  });

  // Handle form submission
  const onSubmit = useCallback(async (data: any) => {
    try {
      clearErrors();

      if (requiresCaptcha && !captchaToken) {
        setError('root', {
          type: 'manual',
          message: 'Please complete the CAPTCHA verification',
        });
        return;
      }

      if (requiresMFA) {
        if (!sessionToken) {
          setError('root', {
            type: 'manual',
            message: 'Invalid session state',
          });
          return;
        }

        const mfaResult = await verifyMFA({
          code: data.mfaCode,
          sessionToken,
          method: 'totp',
        } as MFAVerification);

        if (mfaResult) {
          onSuccess?.();
        }
      } else {
        const loginResult = await login({
          email: data.email as string,
          password: data.password as string,
        } as LoginCredentials);

        if (loginResult.requiresMFA) {
          setRequiresMFA(true);
          setSessionToken(loginResult.sessionToken);
        } else {
          onSuccess?.();
        }
      }
    } catch (err) {
      const authError = err as AuthError;
      setError('root', {
        type: 'manual',
        message: authError.message,
      });
      onError?.(authError);

      if (authError.code === 'SUSPICIOUS_ACTIVITY') {
        setRequiresCaptcha(true);
      }
    }
  }, [login, verifyMFA, requiresMFA, sessionToken, captchaToken, requiresCaptcha, clearErrors, setError, onSuccess, onError]);

  // Handle CAPTCHA verification
  const handleCaptchaVerify = useCallback((token: string | null) => {
    setCaptchaToken(token);
    if (token) {
      clearErrors('root');
    }
  }, [clearErrors]);

  // Toggle password visibility
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  // Accessibility keyboard handler
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit(onSubmit)();
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 4,
        width: '100%',
        maxWidth: 400,
        mx: 'auto',
        mt: 4,
      }}
    >
      <Typography
        variant="h1"
        component="h1"
        sx={{
          fontSize: '1.5rem',
          fontWeight: 600,
          mb: 3,
          textAlign: 'center',
        }}
      >
        {requiresMFA ? 'Enter MFA Code' : 'Sign In'}
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {!requiresMFA && (
          <>
            <TextField
              {...register('email')}
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              error={!!errors.email}
              helperText={errors.email?.message}
              autoComplete="email"
              autoFocus
              InputProps={{
                'aria-label': 'Email',
              }}
            />

            <TextField
              {...register('password')}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              margin="normal"
              error={!!errors.password}
              helperText={errors.password?.message}
              autoComplete="current-password"
              InputProps={{
                'aria-label': 'Password',
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={togglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        )}

        {requiresMFA && (
          <TextField
            {...register('mfaCode')}
            label="MFA Code"
            type="text"
            fullWidth
            margin="normal"
            error={!!errors.mfaCode}
            helperText={errors.mfaCode?.message}
            autoComplete="one-time-code"
            inputProps={{
              maxLength: 6,
              pattern: '[0-9]*',
              inputMode: 'numeric',
              'aria-label': 'MFA Code',
            }}
          />
        )}

        {requiresCaptcha && (
          <Box sx={{ my: 2, display: 'flex', justifyContent: 'center' }}>
            <ReCAPTCHA
              sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY || ''}
              onChange={handleCaptchaVerify}
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={isLoading}
          sx={{ mt: 3, mb: 2 }}
          onKeyDown={handleKeyDown}
        >
          {isLoading ? (
            <LoadingSpinner size={24} color="inherit" />
          ) : requiresMFA ? (
            'Verify'
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="text"
          size="small"
          sx={{ mt: 1 }}
          onClick={() => {/* Implement password reset navigation */}}
        >
          Forgot Password?
        </Button>
      </Box>
    </Paper>
  );
};

export default LoginForm;