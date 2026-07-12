# EduDrive

> **Il cloud storage open source fatto dagli studenti, per gli studenti.**
> Condividi appunti, organizza documenti e salva risorse esterne in un unico spazio di studio collaborativo.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Active-success.svg)
![Theme](https://img.shields.io/badge/UI-Light_%26_Blue-2563eb.svg)

---

## Perché EduDrive? (Punti di Forza)

- **Interfaccia Light & Blue**: Design moderno, luminoso e pulito per un'esperienza di studio senza distrazioni.
- **QuickLink Integrati**: Salva link esterni (Google Drive, YouTube, Dropbox) direttamente come cartelle o file cliccabili nel tuo cloud. Mai più file `.txt` con link incollati!
- **Condivisione Granulare**: Condividi cartelle con compagni specifici via email scegliendo i permessi (*Lettore* o *Editore*), oppure rendile pubbliche con un clic.
- **Sicurezza e Performance**: Autenticazione moderna con JWT (Access & Refresh Token) e archiviazione veloce compatibile con S3.
- **100% Modulare per Studenti Sviluppatori**: Struttura pensata per creare e integrare nuovi plugin didattici in pochi minuti.

---

## Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS v4 (Tema Light & Blue) |
| **Desktop App** | Tauri v2 (Rust + WebView2) |
| **Backend** | Node.js + Express (REST API modulari) |
| **Database** | PostgreSQL locale (Docker) o Cloud Serverless (**Neon.tech**) + Drizzle ORM |
| **Storage** | Object Storage S3 compatibile (**Cloudflare R2** / MinIO locale / Storj.io) |

---

## Guida all'Avvio (In 60 secondi)

### Prerequisiti
- **Node.js** (v18+)
- **Docker & Docker Compose** (per database e storage in locale)
- *(Opzionale per App Nativa)* **Rust & C++ Build Tools** (se installati, `avvia.bat` apre la vera app nativa Tauri v2, altrimenti fa il fallback automatico al browser in modalità standalone).

### 1. Configurazione
Clona il progetto e configura le variabili d'ambiente:
```bash
git clone https://github.com/stiavelli21/EduDrive.git
cd EduDrive
cp .env.example backend/.env
```

### 2. Avvio Rapido (Consigliato per Windows)
Fai doppio clic su `avvia.bat` oppure esegui nel terminale:
```cmd
avvia.bat
```
 **Cosa fa in automatico?**
1. Avvia Docker (PostgreSQL + MinIO).
2. Lancia Backend (porta 3001) e Frontend (porta 5173).
3. Apre EduDrive come **applicazione desktop nativa (Tauri v2)** (o in modalità standalone se Rust non è presente).

*(Per terminare, premi `CTRL+C` nel terminale).*

---

### 3. Avvio Manuale / Sviluppo
Se preferisci gestire i processi separatamente:
1. **Infrastruttura**: `docker compose up -d`
2. **Backend + App Desktop Nativa**: `npm run start:desktop`
3. **Solo Web / Dev Server**: `npm run dev`

---

### 4. Creare l'Installer Desktop (`.exe` / `.msi`)
Per generare il file di installazione autonomo e leggerissimo (~15 MB) da distribuire agli studenti:
```bash
npm run build:desktop
```
Il pacchetto di installazione verrà generato nella cartella `frontend/src-tauri/target/release/bundle/`.

---

### 5. Configurazione Cloud & Database (Gratis & Scalabile)
EduDrive è predisposto per far girare l'intero stack online su servizi cloud ad alte prestazioni:
- **Backend Node.js**: [Render.com](https://render.com) (Deploy automatico e immediato tramite il blueprint `render.yaml` incluso nella root del progetto)
- **Database PostgreSQL**: [Neon.tech](https://neon.tech) (Serverless PostgreSQL gratuito)
- **Storage File S3**: **Cloudflare R2** (10 GB gratis al mese e banda download **illimitata** €0/GB), [Supabase Storage](https://supabase.com) (1 GB gratis per sempre senza carta) o [Backblaze B2](https://www.backblaze.com).

#### A. Setup del Database Cloud (Neon.tech):
1. Copia la stringa di connessione di Neon.tech in `backend/.env` (es. `DATABASE_URL=postgres://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`).
2. Verifica la connessione e il supporto SSL con il comando di diagnostica:
   ```bash
   npm run db:test
   ```
3. Genera e sincronizza automaticamente tutte le tabelle (`users`, `nodes`, `permissions`) su Neon tramite Drizzle ORM:
   ```bash
   npm run db:push
   ```

#### B. Setup dello Storage Cloud (Cloudflare R2):
1. Crea un bucket su **Cloudflare R2** chiamato `edudrive-files`.
2. Genera un Token API R2 (*Oggetto in lettura e scrittura*) per ottenere **Endpoint S3**, **Access Key ID** e **Secret Access Key**.
3. Configurali nel `backend/.env` (oppure direttamente su Render.com in produzione).

#### C. Deploy Istantaneo del Backend su Render.com:
1. Carica il progetto su una tua repository GitHub.
2. Vai su **Render.com** $\rightarrow$ **New** $\rightarrow$ **Blueprint** e seleziona il tuo repository.
3. Render leggerà automaticamente il file `render.yaml` creando all'istante il servizio backend e chiedendoti solo di incollare l'URL del database Neon e le chiavi di Cloudflare R2!

---

## Come funzionano i QuickLink?

1. Clicca su **"Aggiungi QuickLink"** nella dashboard.
2. Inserisci un titolo e l'URL esterno (es. una dispensa su Google Drive).
3. Il link appare nell'albero dei file come un vero e proprio documento con icona 🔗.
4. Con un clic si apre direttamente nella risorsa esterna!

---

## Sviluppa il tuo Primo Plugin!

EduDrive è progettato per essere espanso facilmente dagli studenti. Per aggiungere una nuova funzionalità al backend bastano 3 passi:

1. Crea la rotta: `backend/src/routes/tuo-plugin.routes.js`
2. Crea il controller: `backend/src/controllers/tuo-plugin.controller.js`
3. Registra la rotta in `backend/src/app.js`:
   ```javascript
   import pluginRoutes from './routes/tuo-plugin.routes.js';
   app.use('/api/tuo-plugin', pluginRoutes);
   ```

 💡 **Cerchi ispirazione per un plugin?** Leggi [IDEE.md](./IDEE.md) per scoprire proposte pronte per essere sviluppate!

---

## Documentazione & Linee Guida AI

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Mappa strutturale e flusso dei dati dell'applicazione.
- **[.agents/AGENTS.md](./.agents/AGENTS.md)**: Regole per assistenti AI, convenzioni sullo stile del codice e filosofia UI (Design system `index.css` ed estetica intuitiva essenziale).

---

## Licenza

**MIT License** — Progetto open source libero, creato da studenti per gli studenti.
