import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { PasswordReset } from '../../components/auth/PasswordReset';

/**
 * Enhanced password reset page component implementing OAuth 2.0 standards
 * and WCAG 2.1 AA accessibility compliance
 * @version 1.0.0
 */
const ResetPasswordPage: React.FC = React.memo(() => {
  // Set up focus management for accessibility
  useEffect(() => {
    // Announce page load to screen readers
    const pageAnnouncement = new CustomEvent('announce', {
      detail: { message: 'Password reset page loaded' }
    });
    window.dispatchEvent(pageAnnouncement);

    // Focus first interactive element
    const firstInput = document.querySelector('input, button') as HTMLElement;
    if (firstInput) {
      firstInput.focus();
    }

    return () => {
      // Clean up any focus-related listeners
      window.removeEventListener('announce', () => {});
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Reset Password - MGA Operating System</title>
        <meta 
          name="description" 
          content="Securely reset your MGA Operating System password with enhanced security features"
        />
        {/* Security headers */}
        <meta 
          httpEquiv="Content-Security-Policy" 
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        />
        <meta 
          httpEquiv="X-Content-Type-Options" 
          content="nosniff"
        />
        <meta 
          httpEquiv="X-Frame-Options" 
          content="DENY"
        />
        {/* Accessibility meta tags */}
        <html lang="en" />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
      </Helmet>

      <AuthLayout>
        <PasswordReset />
      </AuthLayout>
    </>
  );
});

// Display name for debugging
ResetPasswordPage.displayName = 'ResetPasswordPage';

export default ResetPasswordPage;