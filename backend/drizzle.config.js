// =============================================================================
// Drizzle Kit Configuration
// =============================================================================
// Used by `drizzle-kit` CLI for schema generation and migrations.
// Docs: https://orm.drizzle.team/kit-docs/overview
// =============================================================================

import 'dotenv/config';

/** @type {import('drizzle-kit').Config} */
export default {
  schema: './src/models/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
