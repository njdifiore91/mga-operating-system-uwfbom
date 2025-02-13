import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TextField, Button, Box, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { MFAVerification as MFAVerificationType } from '../../types/auth.types';
import LoadingSpinner from '../common/LoadingSpinner';

// Constants for MFA verification
const MFA_CODE_LENGTH = 6;
const MAX_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 300;

interface MFAVerificationProps {
  sessionToken: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * MFA Verification component implementing secure code verification with
 * rate limiting, accessibility features, and comprehensive validation
 */
const MFAVerification: React.FC<MFAVerificationProps> = ({
  sessionToken,
  onSuccess,
  onError
}) => {
  // State management
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Hooks
  const { verifyMFA, isLoading } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle rate limiting countdown
  useEffect(() => {
    if (isBlocked && remainingTime > 0) {
      const timer = setInterval(() => {
        setRemainingTime(prev => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }

    if (remainingTime === 0 && isBlocked) {
      setIsBlocked(false);
      setAttempts(0);
    }
  }, [isBlocked, remainingTime]);

  /**
   * Validates MFA code format and constraints
   */
  const validateCode = useCallback((value: string): boolean => {
    return (
      value.length === MFA_CODE_LENGTH &&
      /^\d+$/.test(value) &&
      !isBlocked
    );
  }, [isBlocked]);

  /**
   * Handles code input with debounced validation
   */
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, MFA_CODE_LENGTH);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setCode(value);
    setError(null);

    debounceTimer.current = setTimeout(() => {
      if (value.length > 0 && value.length < MFA_CODE_LENGTH) {
        setError(`Code must be ${MFA_CODE_LENGTH} digits`);
      }
    }, DEBOUNCE_DELAY);
  }, []);

  /**
   * Handles form submission with rate limiting and security checks
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCode(code)) {
      return;
    }

    try {
      const verificationData: MFAVerificationType = {
        code,
        sessionToken,
        method: 'totp'
      };

      await verifyMFA(verificationData);
      onSuccess?.();
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      onError?.(err as Error);

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        setIsBlocked(true);
        setRemainingTime(300); // 5 minutes cooldown
      }

      setCode('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        maxWidth: 400,
        mx: 'auto',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Typography
        variant="h2"
        component="h1"
        align="center"
        gutterBottom
      >
        Two-Factor Authentication
      </Typography>

      <Typography variant="body1" align="center" gutterBottom>
        Enter the verification code from your authenticator app
      </Typography>

      {error && (
        <Alert 
          severity="error"
          sx={{ mb: 2 }}
          role="alert"
        >
          {error}
        </Alert>
      )}

      {isBlocked && (
        <Alert 
          severity="warning"
          sx={{ mb: 2 }}
          role="alert"
        >
          Too many attempts. Please try again in {remainingTime} seconds.
        </Alert>
      )}

      <TextField
        inputRef={inputRef}
        fullWidth
        label="Verification Code"
        value={code}
        onChange={handleCodeChange}
        disabled={isBlocked || isLoading}
        inputProps={{
          inputMode: 'numeric',
          pattern: '[0-9]*',
          maxLength: MFA_CODE_LENGTH,
          'aria-label': 'Enter verification code',
          'aria-invalid': !!error,
          'aria-describedby': error ? 'mfa-error' : undefined
        }}
        sx={{ mb: 2 }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={!validateCode(code) || isLoading || isBlocked}
        sx={{ mt: 2 }}
      >
        Verify
      </Button>

      <Typography 
        variant="body2" 
        color="text.secondary"
        align="center"
        sx={{ mt: 2 }}
      >
        Remaining attempts: {MAX_ATTEMPTS - attempts}
      </Typography>
    </Box>
  );
};

export default MFAVerification;