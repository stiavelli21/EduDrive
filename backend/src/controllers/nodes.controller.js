// =============================================================================
// EduDrive — Nodes Controller
// =============================================================================
// Handles CRUD operations for all node types: files, folders, and QuickLinks.
//
// Key concepts:
//   - All storable items are "nodes" in a unified table
//   - QuickLinks are nodes with type='link' and a URL field
//   - Access control checks ownership, public visibility, and permissions
//   - Permissions are inherited from parent folders (recursive check)
//
// Endpoints:
//   GET    /api/nodes           → List root nodes (or shared-with-me)
//   GET    /api/nodes/:id       → Get single node details
//   GET    /api/nodes/:id/children → List children of a folder
//   POST   /api/nodes/folder    → Create a new folder
//   POST   /api/nodes/upload    → Upload a file
//   POST   /api/nodes/quicklink → Create a QuickLink (⭐ innovative feature)
//   PUT    /api/nodes/:id       → Rename or move a node
//   DELETE /api/nodes/:id       → Delete a node (cascades to children)
// =============================================================================

import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../app.js';
import { nodes, permissions } from '../models/schema.js';
import { uploadFile, getDownloadUrl, getFileStream, deleteFile } from '../services/storage.service.js';

// =============================================================================
// HELPER: Check if a user has access to a node
// =============================================================================

/**
 * Check if a user can access a node using a single recursive CTE query.
 * Walks up the folder tree in one DB round-trip instead of N recursive calls.
 *
 * Access is granted if:
 *   1. The user is the owner of any node in the ancestor chain
 *   2. Any ancestor node is public (for viewer access)
 *   3. The user has a direct or inherited permission on any ancestor
 *
 * @param {string} nodeId - The node to check
 * @param {string} userId - The user requesting access
 * @param {string} [requiredLevel] - 'viewer' or 'editor' (default: 'viewer')
 * @returns {Promise<{allowed: boolean, level: string|null}>}
 */
async function checkAccess(nodeId, userId, requiredLevel = 'viewer') {
  // Single CTE query: walk up the ancestor chain, join permissions once
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, owner_id, parent_id, is_public, 0 AS depth
      FROM nodes WHERE id = ${nodeId}
      UNION ALL
      SELECT n.id, n.owner_id, n.parent_id, n.is_public, a.depth + 1
      FROM nodes n
      INNER JOIN ancestors a ON n.id = a.parent_id
    )
    SELECT
      a.id,
      a.owner_id,
      a.is_public,
      a.depth,
      p.level AS perm_level
    FROM ancestors a
    LEFT JOIN permissions p ON p.node_id = a.id AND p.user_id = ${userId}
    ORDER BY a.depth ASC
  `);

  if (!result.rows || result.rows.length === 0) {
    return { allowed: false, level: null };
  }

  // Walk through the ancestor chain (from target node upward)
  for (const row of result.rows) {
    // 1. Owner always has full access
    if (row.owner_id === userId) {
      return { allowed: true, level: 'owner' };
    }

    // 2. Public nodes are accessible to everyone (as viewer)
    if (row.is_public && requiredLevel === 'viewer') {
      return { allowed: true, level: 'viewer' };
    }

    // 3. Check permission on this ancestor
    if (row.perm_level) {
      const allowed =
        requiredLevel === 'viewer' || row.perm_level === 'editor';
      return { allowed, level: row.perm_level };
    }
  }

  // No access found in entire ancestor chain
  return { allowed: false, level: null };
}

// =============================================================================
// CONTROLLERS
// =============================================================================

/**
 * GET /api/nodes
 * List root-level nodes for the authenticated user.
 * Query params:
 *   - shared=true → list nodes shared with the user by others
 */
export async function listRootNodes(req, res, next) {
  try {
    const userId = req.user.id;
    const showShared = req.query.shared === 'true';

    if (showShared) {
      // Nodes shared with this user (via permissions table)
      const sharedPerms = await db
        .select({
          node: nodes,
          level: permissions.level,
        })
        .from(permissions)
        .innerJoin(nodes, eq(permissions.nodeId, nodes.id))
        .where(eq(permissions.userId, userId));

      return res.json({
        nodes: sharedPerms.map((p) => ({ ...p.node, permissionLevel: p.level })),
      });
    }

    // User's own root-level nodes (no parent)
    const rootNodes = await db
      .select()
      .from(nodes)
      .where(and(eq(nodes.ownerId, userId), isNull(nodes.parentId)))
      .orderBy(nodes.type, nodes.name);

    res.json({ nodes: rootNodes });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nodes/:id
 * Get a single node's details (with access check).
 * For files, includes a pre-signed download URL.
 */
export async function getNode(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, id))
      .limit(1);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Check access
    const access = await checkAccess(id, userId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For files, generate a download URL
    let downloadUrl = null;
    if (node.type === 'file' && node.storageKey) {
      downloadUrl = await getDownloadUrl(node.storageKey);
    }

    res.json({
      node: { ...node, downloadUrl },
      accessLevel: access.level,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nodes/:id/content
 * Stream / get raw file content for a node (with access check).
 */
export async function getNodeContent(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const [node] = await db.select().from(nodes).where(eq(nodes.id, id));
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Check access
    const access = await checkAccess(id, userId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (node.type !== 'file' || !node.storageKey) {
      return res.status(400).json({ error: 'Node is not a file' });
    }

    const stream = await getFileStream(node.storageKey);

    // Set Content-Type: prefer markdown-specific header for .md files,
    // otherwise fall back to the stored MIME type
    const isMarkdown = node.mimeType === 'text/markdown'
      || node.name?.toLowerCase().endsWith('.md');

    if (isMarkdown) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    } else if (node.mimeType) {
      res.setHeader('Content-Type', node.mimeType);
    }

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nodes/:id/children
 * List children of a folder (with access check).
 */
export async function listChildren(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify the parent exists and is a folder
    const [parent] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, id))
      .limit(1);

    if (!parent) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (parent.type !== 'folder') {
      return res.status(400).json({ error: 'Node is not a folder' });
    }

    // Check access to the folder
    const access = await checkAccess(id, userId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // List children sorted by type (folders first) then name
    const children = await db
      .select()
      .from(nodes)
      .where(eq(nodes.parentId, id))
      .orderBy(nodes.type, nodes.name);

    // Build breadcrumb path in a single CTE query (eliminates N+1 API calls
    // from the frontend)
    const breadcrumbResult = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, parent_id, 0 AS depth
        FROM nodes WHERE id = ${id}
        UNION ALL
        SELECT n.id, n.name, n.parent_id, a.depth + 1
        FROM nodes n
        INNER JOIN ancestors a ON n.id = a.parent_id
      )
      SELECT id, name FROM ancestors ORDER BY depth DESC
    `);

    const breadcrumbs = (breadcrumbResult.rows || []).map((row) => ({
      id: row.id,
      name: row.name,
    }));

    res.json({ nodes: children, parent, breadcrumbs });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/nodes/folder
 * Create a new folder.
 *
 * Body: { name, parentId? }
 */
export async function createFolder(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, parentId } = req.body;

    // If creating inside another folder, verify ownership or editor access
    if (parentId) {
      const access = await checkAccess(parentId, userId, 'editor');
      if (!access.allowed) {
        return res.status(403).json({ error: 'Cannot create folder here' });
      }
    }

    const [folder] = await db
      .insert(nodes)
      .values({
        ownerId: userId,
        parentId: parentId || null,
        name,
        type: 'folder',
      })
      .returning();

    res.status(201).json({ node: folder });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/nodes/upload
 * Upload a file. Expects multipart/form-data with a 'file' field.
 * Optional: parentId in the form body.
 */
export async function uploadFileHandler(req, res, next) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { originalname, mimetype, buffer } = req.file;
    const parentId = req.body.parentId || null;

    // If uploading into a folder, check editor access
    if (parentId) {
      const access = await checkAccess(parentId, userId, 'editor');
      if (!access.allowed) {
        return res.status(403).json({ error: 'Cannot upload here' });
      }
    }

    // Upload to S3-compatible storage
    const { storageKey, size } = await uploadFile(
      buffer,
      originalname,
      mimetype,
      userId
    );

    // Create node record in database
    const [fileNode] = await db
      .insert(nodes)
      .values({
        ownerId: userId,
        parentId,
        name: originalname,
        type: 'file',
        mimeType: mimetype,
        sizeBytes: size,
        storageKey,
      })
      .returning();

    res.status(201).json({ node: fileNode });
  } catch (error) {
    next(error);
  }
}

/**
 * ⭐ POST /api/nodes/quicklink
 * Create a QuickLink — saves an external URL (e.g. Google Drive) as a node.
 *
 * This is the INNOVATIVE FEATURE of EduDrive:
 * Instead of creating a text file with a link inside, students can save
 * external links (Google Drive, Dropbox, YouTube, etc.) directly in their
 * file tree. The link appears as a clickable node with a link icon.
 *
 * Body: { name: "Appunti Fisica", url: "https://drive.google.com/...", parentId? }
 *
 * Database: Creates a node with type='link' and the URL in the `url` column.
 * Frontend: Renders with a 🔗 icon. On click, opens the URL in a new tab.
 */
export async function createQuickLink(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, url, parentId } = req.body;

    // If creating inside a folder, check editor access
    if (parentId) {
      const access = await checkAccess(parentId, userId, 'editor');
      if (!access.allowed) {
        return res.status(403).json({ error: 'Cannot create link here' });
      }
    }

    // Create the QuickLink node
    // The key difference from a file: type='link' and url is set
    // No storage_key needed since nothing is stored in S3
    const [linkNode] = await db
      .insert(nodes)
      .values({
        ownerId: userId,
        parentId: parentId || null,
        name,
        type: 'link',
        url, // The external URL (e.g. Google Drive link)
      })
      .returning();

    res.status(201).json({ node: linkNode });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/nodes/:id
 * Update a node (rename or move to another folder).
 *
 * Body: { name?, parentId? }
 */
export async function updateNode(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, parentId, description, color } = req.body;

    // Check editor access (owner or editor permission)
    const access = await checkAccess(id, userId, 'editor');
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update object with only provided fields
    // (name is already validated and trimmed by Zod schema)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (parentId !== undefined) {
      // Prevent circular moves: verify the target parent is not the node
      // itself or one of its descendants
      if (parentId === id) {
        return res.status(400).json({ error: 'Cannot move a node inside itself' });
      }
      if (parentId !== null) {
        const circularCheck = await db.execute(sql`
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id FROM nodes WHERE id = ${parentId}
            UNION ALL
            SELECT n.id, n.parent_id
            FROM nodes n
            INNER JOIN ancestors a ON n.id = a.parent_id
          )
          SELECT 1 FROM ancestors WHERE id = ${id} LIMIT 1
        `);
        if (circularCheck.rows && circularCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Cannot move a node inside one of its own descendants' });
        }
      }
      updateData.parentId = parentId;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(nodes)
      .set(updateData)
      .where(eq(nodes.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/nodes/:id
 * Delete a node. If it's a folder, all children are cascade-deleted.
 * If it's a file, the S3 object is also deleted.
 */
export async function deleteNode(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Only owner can delete (not editors)
    const [node] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, id))
      .limit(1);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (node.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can delete nodes' });
    }

    // If it's a file, delete from S3
    if (node.type === 'file' && node.storageKey) {
      await deleteFile(node.storageKey);
    }

    // If it's a folder, we need to recursively delete S3 files
    if (node.type === 'folder') {
      await deleteChildrenFiles(id);
    }

    // Delete from database (CASCADE will handle children and permissions)
    await db.delete(nodes).where(eq(nodes.id, id));

    res.json({ message: 'Node deleted successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper: Find all file storage keys in a folder tree using a recursive CTE,
 * then delete them in parallel. Uses Promise.allSettled so that a single S3
 * failure does not leave remaining files orphaned.
 */
async function deleteChildrenFiles(folderId) {
  // Single query to collect all file storage keys in the subtree
  const result = await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id, type, storage_key FROM nodes WHERE parent_id = ${folderId}
      UNION ALL
      SELECT n.id, n.type, n.storage_key
      FROM nodes n
      INNER JOIN subtree s ON n.parent_id = s.id
    )
    SELECT storage_key FROM subtree
    WHERE type = 'file' AND storage_key IS NOT NULL
  `);

  const keys = (result.rows || []).map((r) => r.storage_key).filter(Boolean);
  if (keys.length === 0) return;

  const results = await Promise.allSettled(
    keys.map((key) => deleteFile(key))
  );

  // Log any partial failures so orphaned files can be cleaned up later
  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('⚠️ Failed to delete S3 object:', r.reason?.message || r.reason);
    }
  }
}
