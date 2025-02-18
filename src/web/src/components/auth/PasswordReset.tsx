import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { TextField, Button, Typography, Box, Alert } from '@mui/material';
import { PasswordReset as PasswordResetType } from '../../types/auth.types';
import { AuthService } from '../../services/auth.service';
import LoadingSpinner from '../common/LoadingSpinner';

// Password validation requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  patterns: {
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    special: /[!@#$%^&*(),.?":{}|<>]/
  }
};

interface PasswordResetFormData {
  newPassword: string;
  confirmPassword: string;
}

interface ValidationError {
  code: string;
  message: string;
}

const PasswordReset: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ValidationError | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError: setFormError
  } = useForm<PasswordResetFormData>();

  // Validate token on component mount
  useEffect(() => {
    const validateResetToken = async () => {
      if (!token) {
        setError({ code: 'INVALID_TOKEN', message: 'Invalid password reset token' });
        return;
      }

      try {
        setLoading(true);
        const authService = new AuthService();
        const isValid = await authService.validateToken(token as unknown as ResetToken);
        setTokenValid(isValid);
        if (!isValid) {
          setError({ code: 'EXPIRED_TOKEN', message: 'Password reset token has expired' });
        }
      } catch (err) {
        setError({ code: 'TOKEN_ERROR', message: 'Error validating reset token' });
      } finally {
        setLoading(false);
      }
    };

    validateResetToken();
  }, [token]);

  // Password validation function
  const validatePassword = (password: string): boolean => {
    if (password.length < PASSWORD_REQUIREMENTS.minLength) return false;
    return Object.values(PASSWORD_REQUIREMENTS.patterns).every(pattern => 
      pattern.test(password)
    );
  };

  // Form submission handler
  const onSubmit = async (data: PasswordResetFormData) => {
    try {
      setLoading(true);
      setError(null);

      if (!validatePassword(data.newPassword)) {
        setFormError('newPassword', {
          type: 'validation',
          message: 'Password does not meet security requirements'
        });
        return;
      }

      if (data.newPassword !== data.confirmPassword) {
        setFormError('confirmPassword', {
          type: 'validation',
          message: 'Passwords do not match'
        });
        return;
      }

      const resetData: PasswordResetType = {
        token: token as unknown as ResetToken,
        newPassword: data.newPassword as unknown as Password,
        confirmPassword: data.confirmPassword as unknown as Password
      };

      const authService = new AuthService();
      await authService.completePasswordReset(resetData);

      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { state: { passwordReset: true } });
      }, 3000);

    } catch (err) {
      setError({
        code: 'RESET_ERROR',
        message: 'Failed to reset password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size={40} color="primary.main" />;
  }

  return (
    <Box
      component="main"
      sx={{
        maxWidth: 'sm',
        mx: 'auto',
        p: 3,
        mt: 8
      }}
    >
      <Typography
        component="h1"
        variant="h4"
        align="center"
        gutterBottom
        sx={{ mb: 4 }}
      >
        Reset Password
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          role="alert"
        >
          {error.message}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          role="alert"
        >
          Password successfully reset. Redirecting to login...
        </Alert>
      )}

      {tokenValid && !success && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            {...register('newPassword', {
              required: 'New password is required',
              validate: validatePassword
            })}
            type="password"
            label="New Password"
            fullWidth
            margin="normal"
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message || `
              Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long and contain:
              uppercase, lowercase, number, and special character
            `}
            inputProps={{
              'aria-label': 'New password',
              'aria-describedby': 'password-requirements'
            }}
          />

          <TextField
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: value => value === watch('newPassword') || 'Passwords do not match'
            })}
            type="password"
            label="Confirm Password"
            fullWidth
            margin="normal"
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            inputProps={{
              'aria-label': 'Confirm password'
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3 }}
            disabled={loading}
          >
            Reset Password
          </Button>
        </form>
      )}
    </Box>
  );
};

export default PasswordReset;