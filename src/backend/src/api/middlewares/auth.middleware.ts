/**
 * @fileoverview Authentication middleware for the MGA OS API with comprehensive security features
 * Implements OAuth 2.0, JWT validation, MFA enforcement, and detailed audit logging
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import jwt from 'jsonwebtoken'; // v9.0.1
import passport from 'passport'; // v0.6.0
import { Strategy as OAuth2Strategy } from 'passport-oauth2'; // v1.7.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { ERROR_CODES } from '../../constants/errorCodes';
import { logger } from '../../utils/logger';

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per minute
  blockDuration: 300 // Block for 5 minutes if exceeded
});

// JWT configuration
const JWT_CONFIG = {
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
  algorithms: ['RS256'],
  maxAge: '1h'
};

// OAuth 2.0 configuration
passport.use(new OAuth2Strategy({
  authorizationURL: process.env.OAUTH_AUTH_URL!,
  tokenURL: process.env.OAUTH_TOKEN_URL!,
  clientID: process.env.OAUTH_CLIENT_ID!,
  clientSecret: process.env.OAUTH_CLIENT_SECRET!,
  callbackURL: process.env.OAUTH_CALLBACK_URL!,
  state: true
}, verifyOAuthCredentials));

/**
 * Middleware to authenticate and validate JWT tokens with enhanced security checks
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Rate limiting check
    await rateLimiter.consume(req.ip);

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header format');
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token with comprehensive checks
    const decodedToken = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
      ...JWT_CONFIG,
      complete: true
    });

    // Validate token claims
    validateTokenClaims(decodedToken);

    // Check token against revocation list
    await checkTokenRevocation(token);

    // Verify token fingerprint
    verifyTokenFingerprint(req, decodedToken);

    // Attach user context to request
    req.user = decodedToken.payload;

    // Audit log successful authentication
    logger.info('Authentication successful', {
      userId: decodedToken.payload.sub,
      tokenId: decodedToken.payload.jti,
      clientIp: req.ip,
      userAgent: req.headers['user-agent']
    });

    next();
  } catch (error) {
    handleAuthError(error, req, res);
  }
};

/**
 * Middleware to validate MFA completion status
 */
export const validateMFA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;

    if (!user?.mfa?.completed) {
      logger.warn('MFA required but not completed', {
        userId: user?.sub,
        clientIp: req.ip
      });

      res.status(StatusCodes.UNAUTHORIZED).json({
        code: ERROR_CODES.MFA_REQUIRED,
        message: 'Multi-factor authentication required'
      });
      return;
    }

    // Validate MFA timestamp is within allowed window
    const mfaTimestamp = new Date(user.mfa.completedAt).getTime();
    const mfaMaxAge = 12 * 60 * 60 * 1000; // 12 hours

    if (Date.now() - mfaTimestamp > mfaMaxAge) {
      throw new Error('MFA session expired');
    }

    next();
  } catch (error) {
    handleAuthError(error, req, res);
  }
};

/**
 * Handler for OAuth 2.0 callback with enhanced security validation
 */
export const handleOAuthCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate state parameter to prevent CSRF
    if (!req.query.state || req.query.state !== req.session?.oauthState) {
      throw new Error('Invalid OAuth state');
    }

    // Exchange authorization code for tokens
    const { accessToken, idToken } = await exchangeAuthorizationCode(
      req.query.code as string
    );

    // Validate ID token claims
    const validatedClaims = await validateIdToken(idToken);

    // Generate session JWT
    const sessionToken = await generateSessionToken(validatedClaims);

    // Set secure cookie with token
    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    // Audit log successful OAuth completion
    logger.info('OAuth authentication completed', {
      userId: validatedClaims.sub,
      provider: validatedClaims.iss,
      clientIp: req.ip
    });

    res.redirect(process.env.APP_URL!);
  } catch (error) {
    handleAuthError(error, req, res);
  }
};

/**
 * Validates required token claims and security requirements
 */
function validateTokenClaims(decodedToken: jwt.Jwt): void {
  const { payload } = decodedToken;

  if (!payload.iss || payload.iss !== JWT_CONFIG.issuer) {
    throw new Error('Invalid token issuer');
  }

  if (!payload.aud || payload.aud !== JWT_CONFIG.audience) {
    throw new Error('Invalid token audience');
  }

  if (!payload.sub) {
    throw new Error('Missing subject claim');
  }

  if (!payload.scope) {
    throw new Error('Missing scope claim');
  }
}

/**
 * Verifies token against revocation list
 */
async function checkTokenRevocation(token: string): Promise<void> {
  // Implementation would check against Redis/database revocation list
  // Placeholder for demonstration
  return Promise.resolve();
}

/**
 * Verifies token fingerprint against client signature
 */
function verifyTokenFingerprint(req: Request, decodedToken: jwt.Jwt): void {
  const clientFingerprint = req.headers['x-token-fingerprint'];
  if (!clientFingerprint || clientFingerprint !== decodedToken.payload.fgp) {
    throw new Error('Invalid token fingerprint');
  }
}

/**
 * Handles authentication errors with detailed logging
 */
function handleAuthError(error: any, req: Request, res: Response): void {
  logger.error('Authentication error', {
    error: error.message,
    stack: error.stack,
    clientIp: req.ip,
    path: req.path
  });

  res.status(StatusCodes.UNAUTHORIZED).json({
    code: ERROR_CODES.AUTHENTICATION_ERROR,
    message: 'Authentication failed',
    details: error.message
  });
}

/**
 * Verifies OAuth credentials and user information
 */
async function verifyOAuthCredentials(
  accessToken: string,
  refreshToken: string,
  profile: any,
  done: Function
): Promise<void> {
  try {
    // Validate user profile and permissions
    // Implementation would verify user exists and has required access
    done(null, profile);
  } catch (error) {
    done(error);
  }
}

/**
 * Exchanges authorization code for OAuth tokens
 */
async function exchangeAuthorizationCode(code: string): Promise<any> {
  // Implementation would exchange code for tokens with OAuth provider
  // Placeholder for demonstration
  return Promise.resolve({
    accessToken: 'access_token',
    idToken: 'id_token'
  });
}

/**
 * Validates OAuth ID token claims
 */
async function validateIdToken(idToken: string): Promise<any> {
  // Implementation would validate ID token signature and claims
  // Placeholder for demonstration
  return Promise.resolve({
    sub: 'user_id',
    iss: 'oauth_provider'
  });
}

/**
 * Generates secure session JWT with validated claims
 */
async function generateSessionToken(claims: any): Promise<string> {
  // Implementation would generate new session JWT
  // Placeholder for demonstration
  return Promise.resolve('session_token');
}