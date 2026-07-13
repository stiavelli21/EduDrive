# ARCHITECTURE.md - Mappa Architetturale e Riferimento Rapido (EduDrive)

## 1. Stack Tecnologico e Flusso Dati
- **Frontend**: React 18 + Vite (`frontend/src/`), stili in `index.css`, chiamate HTTP centralizzate in `services/api.js`.
- **Desktop App**: Tauri v2 (`frontend/src-tauri/`) con Rust + WebView2.
- **Backend**: Node.js + Express (`backend/src/`), architettura RESTful a 3 strati (Routes -> Controllers -> Services).
- **Database & Storage Cloud**: PostgreSQL su **Neon.tech** (Drizzle ORM), Object Storage su **Cloudflare R2** (`storage.service.js`).
- **Deploy**: Backend su **Render.com** (via `render.yaml`), avvio multiprocesso con `concurrently` (`package.json`).

```
[Frontend React / Tauri] 
   └─► `services/api.js` (REST API JSON) 
          └─► [Express Backend] (`app.js` / `server.js`)
                 ├─► `routes/*.routes.js` (Auth JWT / Validazione)
                 ├─► `controllers/*.controller.js` (Logica HTTP / Business)
                 ├─► `services/*.service.js` (I/O Storage R2 / Conversione .md)
                 └─► `models/schema.js` (Drizzle ORM -> DB PostgreSQL)
```

## 2. Mappa Rapida Operativa (Dove modifico X?)

| Funzionalità / Dominio | Moduli Backend Competenti | Moduli Frontend Competenti |
| :--- | :--- | :--- |
| **Autenticazione & Google Auth (Esclusivo)** | `routes/auth.routes.js` (`POST /google`, `PUT /profile`, `/google/desktop`)<br>`controllers/auth.controller.js` (`googleLogin`, `updateProfile`, `desktopGooglePage` con cfg codificato e redirect)<br>`utils/jwt.js` | `services/firebase.js`<br>`context/AuthContext.jsx` (`loginWithGoogle` con popup interno e fallback `cfg` base64)<br>`pages/LoginPage.jsx` / `RegisterPage.jsx` (layout Google Auth) |
| **CRUD File, Upload & Download** | `routes/nodes.routes.js`<br>`controllers/nodes.controller.js` | `components/FileExplorer.jsx`<br>`components/NodeCard.jsx`<br>`components/UploadButton.jsx` |
| **Gestione Quota e Profilo Utente (@username)** | `routes/auth.routes.js` (`/storage-usage`, `/profile`)<br>`controllers/auth.controller.js` | `components/StorageProfileModal.jsx` (Modifica username e nome) |
| **Conversione Markdown (.md/docx/txt)** | `services/conversion.service.js`<br>*(mammoth + turndown / docx)* | `components/MarkdownViewerModal.jsx`<br>`components/DownloadFormatModal.jsx` |
| **Storage S3 / Cloudflare R2** | `services/storage.service.js`<br>*(SDK `@aws-sdk/client-s3`)* | `services/api.js` |
| **Condivisione File & Permessi** | `routes/permissions.routes.js`<br>`controllers/permissions.controller.js` | `components/ShareModal.jsx` |
| **Ridenominazione, Colori & Descrizioni** | `controllers/nodes.controller.js` | `components/RenameModal.jsx`<br>`utils/colors.js` (`MARKDOWN_COLORS`) |
| **Design System & Stili UI** | N/A | `index.css` (Design tokens `--color-*`)<br>`components/QuickLinkModal.jsx` |
| **Database & Schema ORM** | `models/schema.js` (`schema.sql`, colonna `username`)<br>`utils/test-db.js` | N/A |
| **Configurazione Cloud / Env / Deploy** | `render.yaml`<br>`backend/.env` | `frontend/.env.example` (`VITE_API_URL`)<br>`build.bat` |

## 3. Struttura Dettagliata dei File Principali

### Root & Orchestrazione (`/`)
- `package.json`: Script e concurrency (`start:desktop`, `build:desktop`, `dev`, `db:push`).
- `render.yaml`: Blueprint IaC per il deploy su Render.com.
- `docker-compose.yml`: Servizi locali containerizzati (PostgreSQL, MinIO).
- `.agents/AGENTS.md`: Regole AI (Zero Emoji Policy, stile MVC, design tokens, versioning git automatico).

### Backend (`/backend/src/`)
- `server.js` & `app.js`: Inizializzazione Express, CORS, middleware globali e pool PostgreSQL (SSL per Neon.tech e auto-migrazione colonne come `storage_quota_bytes` e `username`).
- `routes/`: (`auth.routes.js`, `nodes.routes.js`, `permissions.routes.js`) Endpoint HTTP e middleware di rotte (`PUT /api/auth/profile` per modifica username).
- `controllers/`: (`auth.controller.js`, `nodes.controller.js`, `permissions.controller.js`) Gestione richieste/risposte JSON, calcolo consumo memoria, accesso Google e business logic.
- `services/`:
  - `storage.service.js`: Astrazione I/O su disco locale o Cloudflare R2 / S3.
  - `conversion.service.js`: Conversione in input (`.docx/.doc/.txt/.rtf/.html` -> `.md`) e in output (`.md` -> `.docx/.txt`).
- `models/schema.js`: Definizione tabelle (`users` con colonna `username` univoca, `nodes`, `permissions`) via Drizzle ORM.
- `middleware/auth.middleware.js`: Verifica e decodifica token JWT.

### Frontend (`/frontend/src/` & `/frontend/src-tauri/`)
- `services/api.js`: Client HTTP centralizzato verso il backend (di default punta a `http://localhost:3001/api` sia in web che su Tauri nativo, salvo override con `VITE_API_URL` in `frontend/.env`).
- `services/firebase.js`: Google Auth (`signInWithPopup` e fallback nativo `signInWithRedirect` per Tauri).
- `context/AuthContext.jsx`: Stato utente globale (`user`, `token`, `loginWithGoogle`, `refreshProfile`, `updateProfile`).
- `components/`: Componenti modulari (`ShareModal`, `RenameModal`, `DownloadFormatModal`, `MarkdownViewerModal`, `StorageProfileModal` per modifica nome e username, `NodeCard`).
- `index.css`: Variabili di tema (`--color-brand-*`, `--color-surface-*`, `--color-text-*`).
- `src-tauri/tauri.conf.json`: Configurazione app nativa Windows (`app.exe` / installer NSIS).

## 4. Regola di Manutenzione Architetturale
- Ad ogni modifica strutturale (nuovi file, endpoint o servizi), **aggiorna tempestivamente questo file (`ARCHITECTURE.md`)** prima di chiudere il turno per mantenere la codebase sincronizzata.
