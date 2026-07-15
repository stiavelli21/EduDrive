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

import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { db } from '../app.js';
import { nodes, permissions, users } from '../models/schema.js';
import { uploadFile, getDownloadUrl, getFileStream, deleteFile } from '../services/storage.service.js';
import {
  isTextualCandidateForMarkdown,
  convertFileToMarkdown,
  convertMarkdownToFormat,
} from '../services/conversion.service.js';

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
 *   4. The node is in local storage ('local') or owned by local device
 *
 * @param {string} nodeId - The node to check
 * @param {string} userId - The user requesting access
 * @param {string} [requiredLevel] - 'viewer' or 'editor' (default: 'viewer')
 * @returns {Promise<{allowed: boolean, level: string|null}>}
 */
async function checkAccess(nodeId, userId, requiredLevel = 'viewer') {
  if (
    userId === '00000000-0000-0000-0000-000000000001' ||
    process.env.LOCAL_MODE === 'true'
  ) {
    return { allowed: true, level: 'owner' };
  }

  // Single CTE query: walk up the ancestor chain, join permissions once
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, owner_id, parent_id, is_public, storage_location, 0 AS depth
      FROM nodes WHERE id = ${nodeId}
      UNION ALL
      SELECT n.id, n.owner_id, n.parent_id, n.is_public, n.storage_location, a.depth + 1
      FROM nodes n
      INNER JOIN ancestors a ON n.id = a.parent_id
    )
    SELECT
      a.id,
      a.owner_id,
      a.is_public,
      a.storage_location,
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
    // 0. Local device items or local mode access always give full access
    if (
      userId === '00000000-0000-0000-0000-000000000001' ||
      row.owner_id === '00000000-0000-0000-0000-000000000001' ||
      row.storage_location === 'local'
    ) {
      return { allowed: true, level: 'owner' };
    }

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

    // User's own root-level nodes or local device nodes (no parent)
    const rootNodes = await db
      .select()
      .from(nodes)
      .where(
        and(
          or(
            eq(nodes.ownerId, userId),
            eq(nodes.storageLocation, 'local'),
            eq(nodes.ownerId, '00000000-0000-0000-0000-000000000001')
          ),
          isNull(nodes.parentId)
        )
      )
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
      downloadUrl = await getDownloadUrl(node.storageKey, 3600, node.storageLocation, node.id);
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

    const stream = await getFileStream(node.storageKey, node.storageLocation);

    // Set Content-Type: prefer markdown-specific header for .md files,
    // otherwise fall back to the stored MIME type
    const isMarkdown = node.mimeType === 'text/markdown'
      || node.name?.toLowerCase().endsWith('.md');

    if (isMarkdown) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    } else if (node.mimeType) {
      res.setHeader('Content-Type', node.mimeType);
    }

    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Errore durante la lettura del file dal disco' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nodes/:id/export?format=md|docx|txt
 * Export/download a node in the requested format ("convertitore alla rovescia").
 * For .md files, converts to .docx or .txt before sending.
 */
export async function exportNodeHandler(req, res, next) {
  try {
    const { id } = req.params;
    const format = (req.query.format || 'md').toLowerCase();
    const userId = req.user?.id;

    const [node] = await db.select().from(nodes).where(eq(nodes.id, id));
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const access = await checkAccess(id, userId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (node.type !== 'file' || !node.storageKey) {
      return res.status(400).json({ error: 'Node is not a file' });
    }

    const stream = await getFileStream(node.storageKey, node.storageLocation);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    const isMarkdown = node.mimeType === 'text/markdown' || node.name?.toLowerCase().endsWith('.md');
    if (isMarkdown && ['docx', 'txt', 'md'].includes(format)) {
      const converted = await convertMarkdownToFormat(fileBuffer, format, node.name);
      res.setHeader('Content-Type', converted.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(converted.filename)}"`);
      return res.send(converted.buffer);
    }

    res.setHeader('Content-Type', node.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(node.name)}"`);
    res.send(fileBuffer);
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

    const storageLocation = req.body.storageLocation || (userId === '00000000-0000-0000-0000-000000000001' ? 'local' : 'cloud');

    const [folder] = await db
      .insert(nodes)
      .values({
        ownerId: userId,
        parentId: parentId || null,
        name,
        type: 'folder',
        storageLocation,
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

    let { originalname, mimetype, buffer } = req.file;
    const parentId = req.body.parentId || null;
    const storageLocation = req.body.storageLocation || (userId === '00000000-0000-0000-0000-000000000001' ? 'local' : 'cloud');

    // If uploading into a folder, check editor access
    if (parentId) {
      const access = await checkAccess(parentId, userId, 'editor');
      if (!access.allowed) {
        return res.status(403).json({ error: 'Cannot upload here' });
      }
    }

    // ⭐ Convert textual candidates (.docx, .doc, .txt, .rtf, .html) into Markdown (.md)
    if (isTextualCandidateForMarkdown(originalname, mimetype)) {
      try {
        const converted = await convertFileToMarkdown(buffer, mimetype, originalname);
        if (converted.converted) {
          buffer = converted.buffer;
          originalname = converted.filename;
          mimetype = converted.mimeType;
        }
      } catch (convErr) {
        console.warn('Text to Markdown conversion error:', convErr.message);
      }
    }

    // Check user storage quota (default 500 MB)
    const [userRecord] = await db
      .select({ storageQuotaBytes: users.storageQuotaBytes })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const quotaBytes = Number(userRecord?.storageQuotaBytes || 524288000);

    const usageResult = await db.execute(sql`
      SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes
      FROM nodes
      WHERE owner_id = ${userId} AND type = 'file'
    `);
    const row = Array.isArray(usageResult) ? usageResult[0] : (usageResult?.rows?.[0] || usageResult?.[0]);
    const usedBytes = Number(row?.used_bytes ?? row?.usedBytes ?? 0);

    if (usedBytes + buffer.length > quotaBytes) {
      const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);
      return res.status(413).json({
        error: `Quota di archiviazione superata. Hai raggiunto il limite massimo di ${quotaMB} MB per il tuo account.`
      });
    }

    // Upload to S3-compatible storage or local disk
    const { storageKey, size } = await uploadFile(
      buffer,
      originalname,
      mimetype,
      userId,
      storageLocation
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
        storageLocation,
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
 */
export async function createQuickLink(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, url, parentId } = req.body;
    const storageLocation = req.body.storageLocation || (userId === '00000000-0000-0000-0000-000000000001' ? 'local' : 'cloud');

    // If creating inside a folder, check editor access
    if (parentId) {
      const access = await checkAccess(parentId, userId, 'editor');
      if (!access.allowed) {
        return res.status(403).json({ error: 'Cannot create link here' });
      }
    }

    // Create the QuickLink node
    const [linkNode] = await db
      .insert(nodes)
      .values({
        ownerId: userId,
        parentId: parentId || null,
        name,
        type: 'link',
        url,
        storageLocation,
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

    if (node.ownerId !== userId && userId !== '00000000-0000-0000-0000-000000000001') {
      return res.status(403).json({ error: 'Only the owner can delete nodes' });
    }

    // If it's a file, delete from S3 or local
    if (node.type === 'file' && node.storageKey) {
      await deleteFile(node.storageKey, node.storageLocation);
    }

    // If it's a folder, we need to recursively delete files
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
 * then delete them in parallel.
 */
async function deleteChildrenFiles(folderId) {
  const result = await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id, type, storage_key, storage_location FROM nodes WHERE parent_id = ${folderId}
      UNION ALL
      SELECT n.id, n.type, n.storage_key, n.storage_location
      FROM nodes n
      INNER JOIN subtree s ON n.parent_id = s.id
    )
    SELECT storage_key, storage_location FROM subtree
    WHERE type = 'file' AND storage_key IS NOT NULL
  `);

  const rows = result.rows || [];
  if (rows.length === 0) return;

  const results = await Promise.allSettled(
    rows.map((r) => deleteFile(r.storage_key, r.storage_location))
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('Failed to delete object:', r.reason?.message || r.reason);
    }
  }
}

/**
 * PUT /api/nodes/:id/storage-location
 * Sposta la memorizzazione fisica di un file o cartella tra cloud e locale.
 * Body: { storageLocation: 'local' | 'cloud' }
 */
export async function moveStorageLocation(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { storageLocation: targetLocation } = req.body;

    if (!targetLocation || !['local', 'cloud'].includes(targetLocation)) {
      return res.status(400).json({ error: 'Posizione di memorizzazione non valida (atteso local o cloud)' });
    }

    const access = await checkAccess(id, userId, 'editor');
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [node] = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    if (node.storageLocation === targetLocation) {
      return res.json({ node, message: `L'elemento e' gia' in ${targetLocation}` });
    }

    if (node.type === 'file') {
      if (node.storageKey) {
        const stream = await getFileStream(node.storageKey, node.storageLocation);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const fileBuffer = Buffer.concat(chunks);

        const { storageKey: newKey, size } = await uploadFile(
          fileBuffer,
          node.name,
          node.mimeType || 'application/octet-stream',
          node.ownerId,
          targetLocation
        );

        await deleteFile(node.storageKey, node.storageLocation);

        const [updated] = await db
          .update(nodes)
          .set({
            storageLocation: targetLocation,
            storageKey: newKey,
            sizeBytes: size,
            updatedAt: new Date(),
          })
          .where(eq(nodes.id, id))
          .returning();

        return res.json({ node: updated });
      } else {
        const [updated] = await db
          .update(nodes)
          .set({ storageLocation: targetLocation, updatedAt: new Date() })
          .where(eq(nodes.id, id))
          .returning();
        return res.json({ node: updated });
      }
    }

    // Se e' una cartella o un quicklink
    await db
      .update(nodes)
      .set({ storageLocation: targetLocation, updatedAt: new Date() })
      .where(eq(nodes.id, id));

    if (node.type === 'folder') {
      const subtreeResult = await db.execute(sql`
        WITH RECURSIVE subtree AS (
          SELECT id, type, name, mime_type, owner_id, storage_key, storage_location FROM nodes WHERE parent_id = ${id}
          UNION ALL
          SELECT n.id, n.type, n.name, n.mime_type, n.owner_id, n.storage_key, n.storage_location
          FROM nodes n
          INNER JOIN subtree s ON n.parent_id = s.id
        )
        SELECT * FROM subtree
      `);

      const rows = subtreeResult.rows || [];
      for (const child of rows) {
        if (child.storage_location === targetLocation) continue;

        if (child.type === 'file' && child.storage_key) {
          try {
            const stream = await getFileStream(child.storage_key, child.storage_location);
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            const { storageKey: newKey, size } = await uploadFile(
              fileBuffer,
              child.name,
              child.mime_type || 'application/octet-stream',
              child.owner_id,
              targetLocation
            );

            await deleteFile(child.storage_key, child.storage_location);

            await db
              .update(nodes)
              .set({
                storageLocation: targetLocation,
                storageKey: newKey,
                sizeBytes: size,
                updatedAt: new Date(),
              })
              .where(eq(nodes.id, child.id));
          } catch (childErr) {
            console.warn(`Errore spostamento file ${child.name}:`, childErr.message);
          }
        } else {
          await db
            .update(nodes)
            .set({ storageLocation: targetLocation, updatedAt: new Date() })
            .where(eq(nodes.id, child.id));
        }
      }
    }

    const [finalFolder] = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
    res.json({ node: finalFolder });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nodes/local-download?key=...
 * Serves a file stored on the local disk filesystem.
 */
export async function localDownloadHandler(req, res, next) {
  try {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'Key parametro mancante' });

    const normalizedSlash = key.replace(/\\/g, '/');
    const normalizedBackslash = key.replace(/\//g, '\\');
    const cleanKey = key.replace(/^(\.[/\\])?(backend[/\\])?(local_storage[/\\])?/, '').replace(/^[/\\]+/, '');

    const [node] = await db
      .select()
      .from(nodes)
      .where(
        or(
          eq(nodes.storageKey, key),
          eq(nodes.storageKey, normalizedSlash),
          eq(nodes.storageKey, normalizedBackslash),
          eq(nodes.storageKey, cleanKey)
        )
      )
      .limit(1);

    if (node) {
      const access = await checkAccess(node.id, req.user?.id || '00000000-0000-0000-0000-000000000001');
      if (!access.allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const isMd = node.name?.toLowerCase().endsWith('.md') || node.mimeType === 'text/markdown';
      if (isMd) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      } else if (node.mimeType) {
        res.setHeader('Content-Type', node.mimeType);
      }
      if (req.query.inline !== 'true' && !isMd) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(node.name)}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(node.name)}"`);
      }
    } else if (key.toLowerCase().endsWith('.md')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    }

    const stream = await getFileStream(key, 'local');
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Impossibile leggere il file locale dal disco' });
      }
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
