// =============================================================================
// EduDrive — Drizzle ORM Schema
// =============================================================================
// This file defines the database schema using Drizzle ORM.
// It mirrors the SQL in database/schema.sql but provides type-safe access
// from JavaScript/TypeScript.
//
// PLUGIN DEVELOPERS: To add a new node type (e.g. flashcard), add it to the
// `nodeTypeEnum` and create appropriate CHECK constraints.
// =============================================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  bigint,
  timestamp,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';

// --- Enums -------------------------------------------------------------------

/** Node type: file, folder, or link (QuickLink) */
export const nodeTypeEnum = pgEnum('node_type', ['file', 'folder', 'link']);

/** Permission level: viewer (read-only) or editor (read + write) */
export const permissionLevelEnum = pgEnum('permission_level', [
  'viewer',
  'editor',
]);

// --- Users Table -------------------------------------------------------------

/**
 * Users table — stores student account information.
 * Each user gets a UUID primary key for security.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique('users_email_key'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Nodes Table -------------------------------------------------------------

/**
 * Nodes table — unified storage for files, folders, and QuickLinks.
 *
 * Design: All storable items are "nodes" differentiated by the `type` column.
 * This makes the system extensible for future types (flashcards, notes, etc.)
 *
 * Column usage by type:
 *   - file:   mime_type, size_bytes, storage_key
 *   - folder: (no extra columns)
 *   - link:   url (the external URL, e.g. Google Drive link)
 */
export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references(() => nodes.id, {
    onDelete: 'cascade',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  type: nodeTypeEnum('type').notNull(),

  // File-specific
  mimeType: varchar('mime_type', { length: 100 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  storageKey: text('storage_key'),

  // QuickLink-specific
  url: text('url'),

  // Visibility
  isPublic: boolean('is_public').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Permissions Table -------------------------------------------------------

/**
 * Permissions table — selective sharing of nodes with other users.
 *
 * Each row grants a specific user access to a specific node at a given level.
 * The (node_id, user_id) combination is unique — one permission per user per node.
 *
 * Permission inheritance: when checking access, the system walks up the
 * folder tree (via parent_id) to find inherited permissions.
 */
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    level: permissionLevelEnum('level').notNull().default('viewer'),
    grantedBy: uuid('granted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Ensure one permission per user per node
    uniqueNodeUser: unique('uq_permission_node_user').on(
      table.nodeId,
      table.userId
    ),
  })
);
