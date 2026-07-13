// =============================================================================
// EduDrive — Express Application Setup
// =============================================================================
// This file configures the Express application with middleware and routes.
// It also initializes the database connection and exports it for controllers.
//
// Architecture:
//   server.js → imports app.js → starts listening
//   app.js    → configures Express, DB, routes, error handling
//
// PLUGIN DEVELOPERS: To add a new route module:
//   1. Create routes/your-plugin.routes.js
//   2. Create controllers/your-plugin.controller.js
//   3. Import and mount the routes below (see "Plugin routes" section)
// =============================================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import authRoutes from './routes/auth.routes.js';
import nodesRoutes from './routes/nodes.routes.js';
import permissionsRoutes from './routes/permissions.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

// =============================================================================
// Database Connection
// =============================================================================

const isCloudDB =
  process.env.NODE_ENV === 'production' ||
  process.env.DB_SSL === 'true' ||
  process.env.DATABASE_URL?.includes('neon.tech') ||
  process.env.DATABASE_URL?.includes('sslmode=require');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isCloudDB
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
});

/**
 * Drizzle ORM database instance.
 * Import this in controllers: import { db } from '../app.js';
 */
export const db = drizzle(pool);

// =============================================================================
// Express App Configuration
// =============================================================================

const app = express();

// --- Global Middleware -------------------------------------------------------

// CORS — allow the frontend origin (Web and native Tauri Desktop .exe)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without origin header (mobile apps, Tauri native fetch, curl)
      if (!origin) return callback(null, true);

      // Check against allowed local and Tauri schemes
      if (
        origin.startsWith('tauri://') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://tauri.localhost') ||
        origin === process.env.FRONTEND_URL ||
        (process.env.FRONTEND_URL && origin.startsWith(process.env.FRONTEND_URL)) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Allow across standard student deployments
    },
    credentials: true, // Required for httpOnly cookies (refresh token)
  })
);

// Parse JSON request bodies
app.use(express.json());

// Parse cookies (for refresh tokens)
app.use(cookieParser());

// Request logger — prints incoming API requests to Render logs
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Exclude noisy health checks from clogging logs
    if (req.originalUrl !== '/api/health') {
      const duration = Date.now() - start;
      console.log(`📬 [${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> Status: ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// --- Health Check ------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'edudrive-api',
    timestamp: new Date().toISOString(),
  });
});

// --- API Routes --------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/permissions', permissionsRoutes);

// --- Plugin Routes (add your plugin routes here) ----------------------------
// Example:
// import flashcardRoutes from './routes/flashcard.routes.js';
// app.use('/api/flashcards', flashcardRoutes);

// --- Error Handling (must be LAST) -------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
