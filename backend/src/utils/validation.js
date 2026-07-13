// =============================================================================
// EduDrive — Validation Schemas (Zod)
// =============================================================================
// Centralized input validation using Zod.
// Each schema validates the request body for a specific endpoint.
//
// PLUGIN DEVELOPERS: Add your validation schemas here and import them
// in your controllers. Zod provides runtime type-checking and clear
// error messages for API consumers.
// =============================================================================

import { z } from 'zod';

// --- Auth Schemas ------------------------------------------------------------

/** Validate registration request body */
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name too long'),
});

/** Validate login request body */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/** Validate profile update request body */
export const updateProfileSchema = z.object({
  username: z.union([
    z.string().trim().min(3, 'Lo username deve avere almeno 3 caratteri').max(50, 'Lo username è troppo lungo').regex(/^[a-zA-Z0-9._-]+$/, 'Lo username può contenere solo lettere, numeri, punti, trattini e underscore'),
    z.literal(''),
    z.null()
  ]).optional(),
  displayName: z.string().trim().min(2, 'Il nome deve avere almeno 2 caratteri').max(100, 'Il nome è troppo lungo').optional(),
});

// --- Node Schemas ------------------------------------------------------------

/** Validate folder creation */
export const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name too long'),
  parentId: z.string().uuid('Invalid parent ID').nullable().optional(),
});

/**
 * Validate QuickLink creation.
 * The URL must be a valid URL (http or https).
 */
export const createQuickLinkSchema = z.object({
  name: z
    .string()
    .min(1, 'Link title is required')
    .max(255, 'Link title too long'),
  url: z.string().url('Invalid URL format'),
  parentId: z.string().uuid('Invalid parent ID').nullable().optional(),
});

/** Validate node rename / move */
export const updateNodeSchema = z.object({
  name: z.string().trim().min(1, 'Il nome non può essere vuoto').max(255, 'Il nome è troppo lungo').optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000, 'Descrizione troppo lunga').nullable().optional(),
  color: z.string().max(50, 'Colore non valido').nullable().optional(),
});

// --- Permission Schemas ------------------------------------------------------

/** Validate adding a permission (share with user) */
export const addPermissionSchema = z.object({
  email: z.string().email('Invalid email format'),
  level: z.enum(['viewer', 'editor']).default('viewer'),
});

/** Validate updating a permission level */
export const updatePermissionSchema = z.object({
  level: z.enum(['viewer', 'editor']),
});

/** Validate visibility toggle */
export const updateVisibilitySchema = z.object({
  isPublic: z.boolean(),
});

// --- Validation Helper -------------------------------------------------------

/**
 * Express middleware factory for Zod validation.
 * Validates `req.body` against the given schema.
 *
 * Usage: router.post('/endpoint', validate(mySchema), controller)
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }
    // Replace body with parsed (and type-coerced) data
    req.body = result.data;
    next();
  };
}
