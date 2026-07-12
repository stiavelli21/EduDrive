// =============================================================================
// Drizzle Kit Configuration
// =============================================================================
// Used by `drizzle-kit` CLI for schema generation and migrations.
// Docs: https://orm.drizzle.team/kit-docs/overview
// =============================================================================

import 'dotenv/config';

const isCloudDB =
  process.env.NODE_ENV === 'production' ||
  process.env.DB_SSL === 'true' ||
  process.env.DATABASE_URL?.includes('neon.tech') ||
  process.env.DATABASE_URL?.includes('sslmode=require');

/** @type {import('drizzle-kit').Config} */
export default {
  schema: './src/models/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ...(isCloudDB ? { ssl: { rejectUnauthorized: false } } : {}),
  },
};
