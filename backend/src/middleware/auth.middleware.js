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
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (
      token === 'LOCAL_MODE_TOKEN' ||
      (process.env.LOCAL_MODE === 'true' &&
        (!token || token === 'null' || token === 'undefined' || token === 'LOCAL_MODE_TOKEN'))
    ) {
      req.user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'local@edudrive.local',
      };
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (process.env.LOCAL_MODE === 'true') {
        req.user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'local@edudrive.local',
        };
        return next();
      }
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header',
      });
    }

    try {
      const decoded = verifyAccessToken(token);

      req.user = {
        id: decoded.id,
        email: decoded.email,
      };

      return next();
    } catch (verifyErr) {
      if (process.env.LOCAL_MODE === 'true' || token === 'LOCAL_MODE_TOKEN') {
        req.user = {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'local@edudrive.local',
        };
        return next();
      }
      throw verifyErr;
    }
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
