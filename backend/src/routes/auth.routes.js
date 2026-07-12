// =============================================================================
// EduDrive — Auth Routes
// =============================================================================
// Maps HTTP endpoints to auth controller functions.
//
// Public routes (no auth required):
//   POST /api/auth/register
//   POST /api/auth/login
//   POST /api/auth/refresh
//   POST /api/auth/logout
//
// Protected routes (auth required):
//   GET  /api/auth/me
// =============================================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate, registerSchema, loginSchema } from '../utils/validation.js';
import {
  register,
  login,
  googleLogin,
  getMe,
  refreshToken,
  logout,
} from '../controllers/auth.controller.js';

const router = Router();

// Public endpoints
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', googleLogin);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Protected endpoints
router.get('/me', authenticate, getMe);

export default router;
