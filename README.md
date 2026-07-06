# 🎓 EduDrive

> Open source cloud storage platform for students — built for collaborative studying.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-v0.1_alpha-orange.svg)

## ✨ Features

- **📁 File & Folder Management** — Upload PDFs, images, documents. Organize with nested folders.
- **🔗 QuickLink** — Save Google Drive, Dropbox, and YouTube links as clickable nodes in your drive (no more creating text files for links!).
- **👥 Selective Sharing** — Share folders with specific users by email. Choose viewer or editor access.
- **🌐 Public/Private Toggle** — Make any folder or file public for all, or keep it private.
- **🔒 JWT Authentication** — Secure login with access + refresh tokens.
- **🧩 Plugin-Ready Architecture** — Clean, modular code designed for student developers to extend.

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express (REST API) |
| Database | PostgreSQL + Drizzle ORM |
| Storage | S3-compatible (MinIO / Cloudflare R2 / Backblaze B2) |
| Auth | JWT (access + refresh tokens) |

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/) & Docker Compose (for PostgreSQL + MinIO)

### 1. Clone & Setup

```bash
git clone https://github.com/your-username/edudrive.git
cd edudrive

# Copy environment variables
cp .env.example backend/.env
```

### 2. Start Database & Storage

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5432` (auto-creates tables from `database/schema.sql`)
- **MinIO** on port `9000` (S3 API) and `9001` (Web Console)

### 3. Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## 📁 Project Structure

```
edudrive/
├── frontend/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Login, Register, Dashboard
│   │   ├── context/       # React Context (Auth)
│   │   └── services/      # API client (Axios)
│   └── ...
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── controllers/   # Business logic
│   │   ├── routes/        # HTTP endpoint mapping
│   │   ├── middleware/     # Auth, error handling
│   │   ├── models/        # Drizzle ORM schema
│   │   ├── services/      # S3 storage service
│   │   └── utils/         # JWT, validation (Zod)
│   └── ...
├── database/          # SQL schema
│   └── schema.sql
└── docker-compose.yml # Dev infrastructure
```

## 🔗 QuickLink — How It Works

Instead of creating a text file to save a Google Drive link, EduDrive lets you save external URLs as first-class nodes:

1. Click **"Add QuickLink"** in the dashboard
2. Enter a title and URL (e.g. `https://drive.google.com/file/d/...`)
3. The link is saved in the database as a node with `type: 'link'`
4. It appears in your file tree with a 🔗 icon
5. Clicking it opens the URL in a new browser tab

## 🧩 Plugin Development

EduDrive is designed to be extended by student developers. Here's how to add a plugin:

### Backend Plugin

1. Create `backend/src/routes/your-plugin.routes.js`
2. Create `backend/src/controllers/your-plugin.controller.js`
3. Mount in `backend/src/app.js`:
   ```js
   import pluginRoutes from './routes/your-plugin.routes.js';
   app.use('/api/your-plugin', pluginRoutes);
   ```

### Ideas for Plugins

- 📇 **Flashcard System** — Create flashcards from uploaded notes
- 💬 **Group Chat** — Real-time chat for study groups
- 🤖 **AI Summarizer** — Auto-summarize uploaded PDFs
- 📊 **Study Analytics** — Track study time and file access patterns

## 📄 License

MIT — Free for students, by students.
