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
