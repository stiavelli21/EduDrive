# Architecture

Purpose: let an AI agent understand the codebase fast, without exploring
file by file.

## Stack
- Language/framework: React 18 + Vite (Frontend), Tauri v2 (Desktop), Node.js + Express (Backend)
- Database / external services: PostgreSQL via Drizzle ORM, Cloudflare R2 / S3, Local Filesystem
- Package manager / build tool: npm, Vite, Tauri CLI

## Folder structure
project/
  frontend/       # React + Vite frontend and Tauri desktop app (src-tauri)
  backend/        # Node.js + Express backend, Drizzle ORM, routes/controllers/services
  scripts/        # Helper scripts (open-app.js)
  .ai/            # this folder

## Key modules
- `backend/src/server.js` — responsibility: Express entry point, DB pool initialization. Dependencies: express, pg, drizzle-orm.
- `frontend/src/services/api.js` — responsibility: Centralized HTTP client for backend requests. Dependencies: axios.
- `backend/src/services/storage.service.js` — responsibility: Hybrid I/O for local disk and S3/R2 storage.
- `frontend/src/context/AuthContext.jsx` — responsibility: Global user state, Google Auth, Local Mode handling.

## Data flow
Frontend (React/Tauri) calls REST APIs via `api.js`. The Express Backend validates auth via middleware (JWT or Local Token), delegates to controllers for business logic, and interacts with PostgreSQL (Drizzle) and storage (S3/Local FS) via services.

## Conventions
- Naming: PascalCase for React components (`NodeCard.jsx`), dot notation for backend files (`*.routes.js`, `*.controller.js`).
- Errors: Explicit error handling, returned as JSON from backend, caught and displayed by frontend.
- Tests: `backend/src/utils/test-db.js` for DB connectivity testing.

## Known constraints / decisions
- Zero Emoji Policy across codebase.
- Offline/Local Mode: Maps to a hardcoded UUID `0000...0001` using `LOCAL_MODE=true` and bypasses JWT login screens for standalone desktop app access.
- Dual Storage: The system dynamically handles both Cloud (R2/S3) and Local storage for nodes.
