// =============================================================================
// EduDrive — JWT Utility
// =============================================================================
// Handles generation and verification of JSON Web Tokens.
// Uses two token types:
//   - Access Token (short-lived, 15min) — sent in Authorization header
//   - Refresh Token (long-lived, 7 days) — stored in httpOnly cookie
// =============================================================================

import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Generate an access token for a user.
 * @param {object} payload - Must contain { id, email }
 * @returns {string} Signed JWT access token
 */
export function generateAccessToken(payload) {
  return jwt.sign({ id: payload.id, email: payload.email }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY,
  });
}

/**
 * Generate a refresh token for a user.
 * @param {object} payload - Must contain { id }
 * @returns {string} Signed JWT refresh token
 */
export function generateRefreshToken(payload) {
  return jwt.sign({ id: payload.id }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });
}

/**
 * Verify and decode an access token.
 * @param {string} token - The JWT to verify
 * @returns {object} Decoded payload { id, email, iat, exp }
 * @throws {JsonWebTokenError} If token is invalid or expired
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify and decode a refresh token.
 * @param {string} token - The refresh JWT to verify
 * @returns {object} Decoded payload { id, iat, exp }
 * @throws {JsonWebTokenError} If token is invalid or expired
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}
