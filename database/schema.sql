-- =============================================================================
-- EduDrive — PostgreSQL Database Schema
-- =============================================================================
-- This file contains the complete DDL for the EduDrive database.
-- It is auto-executed by Docker Compose on first run.
--
-- Tables:
--   1. users        — Student accounts
--   2. nodes        — Unified table for files, folders, and QuickLinks
--   3. permissions  — Granular sharing permissions
--
-- Design Decisions:
--   - UUIDs as primary keys for security and distributed compatibility
--   - "nodes" is a unified table: the `type` column differentiates
--     files, folders, and QuickLinks. This simplifies queries and makes
--     the system extensible for future node types (flashcards, notes, etc.)
--   - Permissions use a simple (node_id, user_id) UNIQUE constraint
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. USERS — Student accounts
-- =============================================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast login lookups
CREATE INDEX idx_users_email ON users (email);

-- =============================================================================
-- 2. NODES — Unified table for files, folders, and QuickLinks
-- =============================================================================
-- Type enum: 'file' | 'folder' | 'link'
-- Each type uses a different subset of columns:
--   file   → mime_type, size_bytes, storage_key
--   folder → (no extra columns needed)
--   link   → url (the external URL, e.g. Google Drive link)
-- =============================================================================
CREATE TYPE node_type AS ENUM ('file', 'folder', 'link');

CREATE TABLE nodes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id   UUID         REFERENCES nodes(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    type        node_type    NOT NULL,

    -- File-specific fields
    mime_type   VARCHAR(100),
    size_bytes  BIGINT,
    storage_key TEXT,

    -- QuickLink-specific field
    url         TEXT,

    -- Customization & Metadata
    description TEXT,
    color       VARCHAR(50),

    -- Visibility
    is_public   BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Constraints
    -- A QuickLink MUST have a URL
    CONSTRAINT chk_link_has_url CHECK (
        type != 'link' OR url IS NOT NULL
    ),
    -- A file MUST have a storage_key
    CONSTRAINT chk_file_has_key CHECK (
        type != 'file' OR storage_key IS NOT NULL
    )
);

-- Index for listing children of a folder
CREATE INDEX idx_nodes_parent ON nodes (parent_id);
-- Index for listing all nodes owned by a user
CREATE INDEX idx_nodes_owner ON nodes (owner_id);
-- Index for finding root-level nodes (parent_id IS NULL)
CREATE INDEX idx_nodes_root ON nodes (owner_id) WHERE parent_id IS NULL;

-- =============================================================================
-- 3. PERMISSIONS — Granular sharing (selective folder/file access)
-- =============================================================================
CREATE TYPE permission_level AS ENUM ('viewer', 'editor');

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id     UUID             NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    user_id     UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level       permission_level NOT NULL DEFAULT 'viewer',
    granted_by  UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    -- Each user can only have ONE permission entry per node
    CONSTRAINT uq_permission_node_user UNIQUE (node_id, user_id)
);

-- Index for checking permissions on a specific node
CREATE INDEX idx_permissions_node ON permissions (node_id);
-- Index for finding all nodes shared with a specific user
CREATE INDEX idx_permissions_user ON permissions (user_id);

-- =============================================================================
-- TRIGGER: Auto-update `updated_at` on row changes
-- =============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_nodes_updated
    BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
