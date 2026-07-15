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
| **Autenticazione & Google Auth (Esclusivo / Locale)** | `routes/auth.routes.js` (`POST /google`, `POST /local-login`, `PUT /profile`, `/google/desktop`)<br>`controllers/auth.controller.js` (`googleLogin`, `localLogin` per accesso offline, `updateProfile`)<br>`utils/jwt.js`<br>`middleware/auth.middleware.js` (`LOCAL_MODE_TOKEN`) | `services/firebase.js`<br>`context/AuthContext.jsx` (`loginWithGoogle`, `loginAsLocal`, check `isLocalModeActive`)<br>`pages/LoginPage.jsx` (Opzione Google e Locale Offline) |
| **CRUD File, Upload & Download (Cloud / Locale)** | `routes/nodes.routes.js` (`/local-download`, `/:id/storage-location`)<br>`controllers/nodes.controller.js` (`localDownloadHandler`, `moveStorageLocation`) | `components/FileExplorer.jsx`<br>`components/NodeCard.jsx` (Badge e spostamento 1-clic Locale/Server)<br>`components/UploadButton.jsx` |
| **Gestione Quota e Profilo Utente (Nome visualizzato)** | `routes/auth.routes.js` (`/storage-usage`, `/profile`)<br>`controllers/auth.controller.js` | `components/StorageProfileModal.jsx` (Modifica nome visualizzato) |
| **Conversione Markdown (.md/docx/txt)** | `services/conversion.service.js`<br>*(mammoth + turndown / docx)* | `components/MarkdownViewerModal.jsx`<br>`components/DownloadFormatModal.jsx` |
| **Storage S3 / Cloudflare R2 / Disco Locale** | `services/storage.service.js` (Supporto ibrido S3 `s3Client` e filesystem locale `node:fs` in `local_storage/`) | `services/api.js`<br>`pages/DashboardPage.jsx` (`handleMoveStorage`) |
| **Condivisione File & Permessi** | `routes/permissions.routes.js`<br>`controllers/permissions.controller.js` | `components/ShareModal.jsx` |
| **Ridenominazione, Colori & Descrizioni** | `controllers/nodes.controller.js` | `components/RenameModal.jsx`<br>`components/NodeCard.jsx` (Colori e icone Markdown)<br>`components/MarkdownViewerModal.jsx`<br>`utils/colors.js` (`MARKDOWN_COLORS`) |
| **Design System & Stili UI** | N/A | `index.css` (Design tokens `--color-*`)<br>`components/QuickLinkModal.jsx` |
| **Database & Schema ORM** | `models/schema.js` (`schema.sql`, colonna `username` e `storage_location` per archiviazione locale o cloud)<br>`utils/test-db.js` | N/A |
| **Configurazione Cloud / Env / Deploy / Avvio Locale** | `render.yaml`<br>`backend/.env`<br>`avvia.bat` (Avvio Docker e app standalone senza login) | `frontend/.env.example` (`VITE_API_URL`)<br>`scripts/open-app.js` (flag `--local`)<br>`build.bat` |

## 3. Struttura Dettagliata dei File Principali

### Root & Orchestrazione (`/`)
- `package.json`: Script e concurrency (`start:desktop`, `start:local`, `build:desktop`, `dev`, `db:push`).
- `avvia.bat`: Script di avvio per il dispositivo locale (controlla/avvia Docker Desktop, imposta `LOCAL_MODE=true` e lancia l'app standalone direttamente sui file locali offline senza schermata di login).
- `scripts/open-app.js`: Apre l'interfaccia in modalità applicazione standalone Chromium/WebKit con supporto al flag `--local`.
- `render.yaml`: Blueprint IaC per il deploy su Render.com.
- `docker-compose.yml`: Servizi locali containerizzati (PostgreSQL, MinIO).
- `.agents/AGENTS.md`: Regole AI (Zero Emoji Policy, stile MVC, design tokens, versioning git automatico).

### Backend (`/backend/src/`)
- `server.js` & `app.js`: Inizializzazione Express, CORS, middleware globali e pool PostgreSQL (SSL per Neon.tech e auto-migrazione colonne `storage_quota_bytes`, `username`, `storage_location` e utente dispositivo locale `00000000-0000-0000-0000-000000000001`).
- `routes/`: (`auth.routes.js`, `nodes.routes.js`, `permissions.routes.js`) Endpoint HTTP e middleware di rotte (es. `POST /api/auth/local-login`, `PUT /api/nodes/:id/storage-location`).
- `controllers/`: (`auth.controller.js`, `nodes.controller.js`, `permissions.controller.js`) Gestione richieste/risposte JSON, calcolo consumo memoria, accesso Google o locale offline (`localLogin`), spostamento file cloud/locale (`moveStorageLocation`), e controllo permessi `checkAccess` ottimizzato senza query CTE ricorsive per l'utente locale (`00000000-0000-0000-0000-000000000001`). `localDownloadHandler` e `getNodeContent` integrano la normalizzazione multi-formato delle chiavi e la protezione da errori di stream in lettura dal disco locale.
- `services/`:
  - `storage.service.js`: Astrazione I/O ibrida su disco locale (`node:fs`) o Cloudflare R2 / S3 con ricerca multi-path dinamica (`local_storage/`, `backend/local_storage/`), ricerca ricorsiva per nome file (`findLocalFile` e `searchFileRecursively`) e normalizzazione automatica dei separatori di percorso Windows e Linux (`getNormalizedKeys`) per prevenire errori di lettura su file locali preesistenti o offline all'avvio.
  - `conversion.service.js`: Conversione in input (`.docx/.doc/.txt/.rtf/.html` -> `.md`) e in output (`.md` -> `.docx/.txt`).
- `models/schema.js`: Definizione tabelle (`users` con colonna `username` univoca, `nodes` con `storageLocation`, `permissions`) via Drizzle ORM.
- `middleware/auth.middleware.js`: Verifica e decodifica token JWT o bypass token locale (`LOCAL_MODE_TOKEN`).

### Frontend (`/frontend/src/` & `/frontend/src-tauri/`)
- `services/api.js`: Client HTTP centralizzato verso il backend.
- `services/firebase.js`: Google Auth (`signInWithPopup` e fallback nativo `signInWithRedirect` per Tauri).
- `context/AuthContext.jsx`: Stato utente globale (`user`, `token`, `loginWithGoogle`, `loginAsLocal`, check avvio automatico con `isLocalModeActive`).
- `components/`: Componenti modulari (`ShareModal`, `RenameModal`, `DownloadFormatModal`, `MarkdownViewerModal` con fetch autenticata resiliente e tentativi multipli su chiavi normalizzate via ID, `local-download` o URL diretta per file locali preesistenti e offline, `StorageProfileModal`, `NodeCard` con indicatori e spostamento rapido tra storage locale e server).
- `pages/DashboardPage.jsx`: Navigazione nel filesystem e gestione cartelle ottimizzata (disaccoppiamento tra ricaricamento nodi `fetchNodes` e ricaricamento profilo utente `refreshProfile`).
- `index.css`: Variabili di tema (`--color-brand-*`, `--color-surface-*`, `--color-text-*`).
- `src-tauri/tauri.conf.json`: Configurazione app nativa Windows (`EduDrive.exe` / installer NSIS).

## 4. Regola di Manutenzione Architetturale
- Ad ogni modifica strutturale (nuovi file, endpoint o servizi), **aggiorna tempestivamente questo file (`ARCHITECTURE.md`)** prima di chiudere il turno per mantenere la codebase sincronizzata.
