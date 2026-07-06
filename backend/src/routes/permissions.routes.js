// =============================================================================
// EduDrive — Permissions Routes
// =============================================================================
// Maps HTTP endpoints to permissions controller functions.
// All routes require authentication.
// =============================================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  validate,
  addPermissionSchema,
  updatePermissionSchema,
  updateVisibilitySchema,
} from '../utils/validation.js';
import {
  listPermissions,
  addPermission,
  updatePermission,
  revokePermission,
  updateVisibility,
} from '../controllers/permissions.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List permissions on a node (owner only)
router.get('/node/:nodeId', listPermissions);

// Share a node with a user by email
router.post('/node/:nodeId', validate(addPermissionSchema), addPermission);

// Toggle public/private visibility
router.put(
  '/node/:nodeId/visibility',
  validate(updateVisibilitySchema),
  updateVisibility
);

// Update a specific permission's level
router.put('/:id', validate(updatePermissionSchema), updatePermission);

// Revoke a permission
router.delete('/:id', revokePermission);

export default router;
