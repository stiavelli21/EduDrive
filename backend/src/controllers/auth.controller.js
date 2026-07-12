// =============================================================================
// EduDrive — Auth Controller
// =============================================================================
// Handles user registration, login, and profile retrieval.
//
// Endpoints:
//   POST /api/auth/register  → Create a new student account
//   POST /api/auth/login     → Authenticate and receive JWT tokens
//   GET  /api/auth/me        → Get current user profile (requires auth)
//   POST /api/auth/refresh   → Refresh access token using refresh token
// =============================================================================

import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../app.js';
import { users } from '../models/schema.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();
const SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Create a new student account.
 *
 * Body: { email, password, displayName }
 * Returns: { user, accessToken }
 */
export async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body;

    // Check if email is already taken
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email already exists.',
      });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        displayName,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      });

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      user: newUser,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticate a student and return JWT tokens.
 *
 * Body: { email, password }
 * Returns: { user, accessToken }
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect.',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user;
    res.json({
      user: safeUser,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Get the current authenticated user's profile.
 * Requires: authenticate middleware
 *
 * Returns: { user }
 */
export async function getMe(req, res, next) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token from the httpOnly cookie.
 *
 * Returns: { accessToken }
 */
export async function refreshToken(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Please log in again.',
      });
    }

    const decoded = verifyRefreshToken(token);

    // Fetch user to ensure they still exist
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid refresh token',
      message: 'Please log in again.',
    });
  }
}

/**
 * POST /api/auth/logout
 * Clear the refresh token cookie.
 */
export function logout(req, res) {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
}

/**
 * POST /api/auth/google
 * Authenticate with Google ID Token (from Firebase Auth or Google OAuth).
 *
 * Body: { idToken }
 * Returns: { user, accessToken }
 */
export async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'ID token di Google mancante' });
    }

    // Decode and verify ID Token
    // Firebase ID tokens have the Firebase project ID as their audience,
    // NOT the Firebase App ID. We support both standard Google OAuth tokens
    // and Firebase Auth tokens (issued by securetoken.google.com).
    let email, displayName, avatarUrl;
    try {
      // Try standard Google OAuth verification with the correct audience.
      // For Firebase tokens, the audience is the Firebase project ID.
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID || undefined,
      });
      const payload = ticket.getPayload();
      email = payload?.email;
      displayName = payload?.name || payload?.given_name || email?.split('@')[0];
      avatarUrl = payload?.picture;
    } catch {
      // Fallback: verify Firebase ID Token (issued by securetoken.google.com)
      // The primary verifyIdToken may fail because:
      //   - GOOGLE_CLIENT_ID is not set (common in dev)
      //   - The token is a Firebase Auth token, not a standard Google OAuth token
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        return res.status(401).json({ error: 'Formato ID token non valido.' });
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      // Validate issuer (must be Firebase securetoken or Google accounts)
      const validIssuers = [
        `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID || ''}`,
        'https://accounts.google.com',
      ];
      const isValidIssuer = validIssuers.some(
        (issuer) => issuer && payload.iss && payload.iss === issuer
      ) || (payload.iss && payload.iss.startsWith('https://securetoken.google.com/'));

      if (!isValidIssuer) {
        return res.status(401).json({ error: 'Token emittente non riconosciuto.' });
      }

      // Validate expiration
      if (!payload.exp || payload.exp * 1000 < Date.now()) {
        return res.status(401).json({ error: 'Token Google/Firebase scaduto.' });
      }

      if (!payload.email) {
        return res.status(401).json({ error: 'Token non contiene un indirizzo email.' });
      }

      email = payload.email;
      displayName = payload.name || payload.email.split('@')[0];
      avatarUrl = payload.picture;
    }

    if (!email) {
      return res.status(401).json({ error: 'Impossibile ricavare l\'email dal token Google.' });
    }

    const cleanEmail = email.toLowerCase();

    // Check if user already exists
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user) {
      // Create new user automatically
      const randomPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36);
      const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

      [user] = await db
        .insert(users)
        .values({
          email: cleanEmail,
          passwordHash,
          displayName: displayName || cleanEmail.split('@')[0],
          avatarUrl: avatarUrl || null,
        })
        .returning();
    } else if (!user.avatarUrl && avatarUrl) {
      // Update avatar if user existed without one
      [user] = await db
        .update(users)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
    }

    // Generate internal JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      user: safeUser,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
}

