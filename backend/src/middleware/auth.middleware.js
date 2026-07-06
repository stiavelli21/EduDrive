// =============================================================================
// EduDrive — Authentication Middleware
// =============================================================================
// Extracts and verifies the JWT access token from the Authorization header.
// Attaches the decoded user info to `req.user` for downstream handlers.
//
// Usage: router.get('/protected', authenticate, handler)
// =============================================================================

import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Express middleware that requires a valid JWT access token.
 *
 * Expected header: Authorization: Bearer <token>
 *
 * On success: sets req.user = { id, email } and calls next()
 * On failure: returns 401 Unauthorized
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Attach user info to request for downstream use
    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();
  } catch (error) {
    // Differentiate between expired and invalid tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please refresh your token.',
      });
    }

    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid.',
    });
  }
}
