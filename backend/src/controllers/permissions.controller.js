// =============================================================================
// EduDrive — Permissions Controller
// =============================================================================
// Handles granular sharing of nodes with other users.
//
// Key features:
//   - Share a folder/file with specific users by email
//   - Set permission level: 'viewer' (read) or 'editor' (read + write)
//   - Toggle public/private visibility
//   - Permissions on a folder cascade to all children (checked at access time)
//
// Endpoints:
//   GET    /api/permissions/node/:nodeId        → List permissions on a node
//   POST   /api/permissions/node/:nodeId        → Share with a user (by email)
//   PUT    /api/permissions/:id                  → Update permission level
//   DELETE /api/permissions/:id                  → Revoke a permission
//   PUT    /api/permissions/node/:nodeId/visibility → Toggle public/private
// =============================================================================

import { eq, and } from 'drizzle-orm';
import { db } from '../app.js';
import { nodes, permissions, users } from '../models/schema.js';

/**
 * GET /api/permissions/node/:nodeId
 * List all permissions on a specific node.
 * Only the node owner can view permissions.
 */
export async function listPermissions(req, res, next) {
  try {
    const { nodeId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (node.ownerId !== userId) {
      return res
        .status(403)
        .json({ error: 'Only the owner can manage permissions' });
    }

    // Fetch permissions with user details
    const perms = await db
      .select({
        id: permissions.id,
        level: permissions.level,
        createdAt: permissions.createdAt,
        userId: users.id,
        userEmail: users.email,
        userDisplayName: users.displayName,
      })
      .from(permissions)
      .innerJoin(users, eq(permissions.userId, users.id))
      .where(eq(permissions.nodeId, nodeId));

    res.json({
      node: { id: node.id, name: node.name, isPublic: node.isPublic },
      permissions: perms,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/permissions/node/:nodeId
 * Share a node with another user by their email address.
 *
 * Body: { email: "student@example.com", level: "viewer" | "editor" }
 *
 * This is the core of SELECTIVE SHARING:
 * The owner decides exactly who can access their folder/file.
 */
export async function addPermission(req, res, next) {
  try {
    const { nodeId } = req.params;
    const userId = req.user.id;
    const { email, level } = req.body;

    // Verify the node exists and the requester is the owner
    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (node.ownerId !== userId) {
      return res
        .status(403)
        .json({ error: 'Only the owner can share this node' });
    }

    // Find the target user by email
    const [targetUser] = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user with email "${email}" exists on EduDrive.`,
      });
    }

    // Can't share with yourself
    if (targetUser.id === userId) {
      return res
        .status(400)
        .json({ error: 'You cannot share a node with yourself' });
    }

    // Check if permission already exists (upsert)
    const [existing] = await db
      .select()
      .from(permissions)
      .where(
        and(
          eq(permissions.nodeId, nodeId),
          eq(permissions.userId, targetUser.id)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing permission level
      const [updated] = await db
        .update(permissions)
        .set({ level })
        .where(eq(permissions.id, existing.id))
        .returning();

      return res.json({
        permission: updated,
        user: targetUser,
        message: `Permission updated to "${level}" for ${targetUser.displayName}`,
      });
    }

    // Create new permission
    const [newPerm] = await db
      .insert(permissions)
      .values({
        nodeId,
        userId: targetUser.id,
        level,
        grantedBy: userId,
      })
      .returning();

    res.status(201).json({
      permission: newPerm,
      user: targetUser,
      message: `Shared with ${targetUser.displayName} as ${level}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/permissions/:id
 * Update the permission level (viewer → editor or vice versa).
 *
 * Body: { level: "viewer" | "editor" }
 */
export async function updatePermission(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { level } = req.body;

    // Fetch the permission and verify the requester owns the node
    const [perm] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);

    if (!perm) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    // Verify the requester is the node owner
    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, perm.nodeId))
      .limit(1);

    if (!node || node.ownerId !== userId) {
      return res
        .status(403)
        .json({ error: 'Only the owner can modify permissions' });
    }

    const [updated] = await db
      .update(permissions)
      .set({ level })
      .where(eq(permissions.id, id))
      .returning();

    res.json({ permission: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/permissions/:id
 * Revoke a permission (remove a user's access to a node).
 */
export async function revokePermission(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch the permission
    const [perm] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);

    if (!perm) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    // Verify the requester is the node owner
    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, perm.nodeId))
      .limit(1);

    if (!node || node.ownerId !== userId) {
      return res
        .status(403)
        .json({ error: 'Only the owner can revoke permissions' });
    }

    await db.delete(permissions).where(eq(permissions.id, id));

    res.json({ message: 'Permission revoked successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/permissions/node/:nodeId/visibility
 * Toggle a node's visibility between public and private.
 *
 * Body: { isPublic: true | false }
 *
 * When a node is PUBLIC:
 *   - Any authenticated user can view it (read-only)
 *   - The owner still controls editing permissions separately
 *
 * When a node is PRIVATE:
 *   - Only the owner and users with explicit permissions can access it
 */
export async function updateVisibility(req, res, next) {
  try {
    const { nodeId } = req.params;
    const userId = req.user.id;
    const { isPublic } = req.body;

    // Verify ownership
    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (node.ownerId !== userId) {
      return res
        .status(403)
        .json({ error: 'Only the owner can change visibility' });
    }

    const [updated] = await db
      .update(nodes)
      .set({ isPublic })
      .where(eq(nodes.id, nodeId))
      .returning();

    res.json({
      node: updated,
      message: `Node is now ${isPublic ? 'public' : 'private'}`,
    });
  } catch (error) {
    next(error);
  }
}
