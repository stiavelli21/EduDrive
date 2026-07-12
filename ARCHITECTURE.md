# ARCHITECTURE.md — Documentazione Architetturale & Mappa del Codice (EduDrive)

Questo documento sintetizza l'architettura tecnica, il flusso dei dati e la struttura dei file del progetto **EduDrive**. È concepito per guidare sviluppatori e assistenti AI nell'orientamento rapido all'interno della codebase senza dover analizzare l'intero progetto riga per riga ad ogni task.

---

## 1. Panoramica del Sistema & Stack Tecnologico

**EduDrive** è una piattaforma di cloud storage orientata agli studenti, strutturata in un'architettura client-server modulare predisposta sia per esecuzione Web che per esecuzione Desktop (tramite Tauri).

- **Frontend**: React + Vite (JS/JSX), stilizzazione tramite CSS Vanilla (`index.css`), integrazione con **Tauri** per build Desktop (`src-tauri`).
- **Backend**: Node.js + Express (`backend/src`), architettura RESTful.
- **Database / Container**: Gestito via Docker (`docker-compose.yml`, cartella `database/`).
- **Integrazione / Avvio Multiprocesso**: Concurrency gestita via root `package.json` / `avvia.bat` (`concurrently` per avviare in parallelo Backend e Frontend/Tauri).

---

## 2. Flusso dei Dati & Pattern Architetturali

```
[Frontend (React / Tauri)]
     │
     ▼ (Chiamate REST API via frontend/src/services/api.js)
[Backend Express (backend/src/server.js -> app.js)]
     │
     ├──► [Middleware] (Autenticazione / Validazione / Gestione Errori)
     ├──► [Routes] (`backend/src/routes/*.routes.js`)
     │        │
     │        ▼
     ├──► [Controllers] (`backend/src/controllers/*.controller.js`)
     │        │
     │        ▼
     ├──► [Services] (`backend/src/services/*.service.js` - es. Storage / FileSystem)
     │        │
     │        ▼
     └──► [Models / Database] (Interazione con DB & Storage Locale)
```

### Principi Chiave:
1. **Separazione delle Responsabilità**:
   - I **Controller** (`*.controller.js`) gestiscono la validazione degli input HTTP, coordinano la logica di business chiamando i servizi/modelli e formattano le risposte HTTP.
   - I **Servizi** (`*.service.js`) incapsulano logiche di sistema pesanti o riutilizzabili (come le operazioni su disco I/O in `storage.service.js`).
   - Le **Rotelle (Routes)** (`*.routes.js`) definiscono esclusivamente gli endpoint REST e applicano i middleware (es. autenticazione via JWT).
2. **Frontend Centralizzato API**:
   - Tutte le comunicazioni verso il backend passano tramite `frontend/src/services/api.js`. I componenti UI non fanno `fetch` dirette ad URL hardcoded, ma sfruttano il client centralizzato.

---

## 3. Mappa Dettagliata delle Cartelle e dei File Principali

### Radice del Progetto (`/`)
- `package.json`: Definizione degli script di orchestrazione (`start`, `start:desktop`, `build:desktop`, `dev`, `db:test`, `db:push`).
- `render.yaml`: Blueprint Infrastructure-as-Code per il deploy e la configurazione automatica su Render.com.
- `docker-compose.yml`: Configurazione dei servizi containerizzati (es. database e MinIO).
- `avvia.bat`: Script di avvio rapido per Windows.
- `IDEE.md`: Documento di raccolta idee, note di progettazione e funzionalità future.
- `.agents/AGENTS.md`: Linee guida e regole per gli assistenti AI, incluse le convenzioni sullo stile del codice, la gerarchia architetturale e la filosofia UI/UX (Design tokens `index.css`).

---

### Backend (`/backend/src/`)
- **`server.js`**: Punto di ingresso principale del server Node.js; avvia l'ascolto HTTP e gestisce il ciclo di vita dell'applicazione.
- **`app.js`**: Configurazione centrale di Express (CORS, body-parser, rotte globali, middleware errori) e del pool del database PostgreSQL con supporto SSL intelligente per connessioni cloud (`Neon.tech`).
- **`routes/`**:
  - `auth.routes.js`: Endpoint per login, registrazione e gestione sessione/token.
  - `nodes.routes.js`: Endpoint CRUD e di navigazione per cartelle e file (i "nodi" del filesystem cloud).
  - `permissions.routes.js`: Endpoint per la gestione di permessi e condivisioni (condivisione nodi tra utenti).
- **`controllers/`**:
  - `auth.controller.js`: Logica di autenticazione (verifica credenziali, emissione token, hashing).
  - `nodes.controller.js`: Logica principale del drive (creazione cartelle, upload/download file, rinomina, spostamento, eliminazione).
  - `permissions.controller.js`: Gestione delle regole di accesso (permessi in lettura/scrittura per utenti terzi, link condivisi).
- **`services/`**:
  - `storage.service.js`: Servizio di astrazione per l'interazione diretta con lo storage fisico e cloud S3 compatibile (`MinIO`, `Storj.io`, `Cloudflare R2`).
- **`models/`**: Modelli dei dati (`schema.js`) e interazione con il livello di persistenza tramite Drizzle ORM.
- **`middleware/`**: Intercettori di richiesta (autenticazione JWT, controllo permessi, validazione).
- **`utils/`**:
  - `test-db.js`: Script di diagnostica per verificare istantaneamente la connessione ed SSL con il database PostgreSQL locale o cloud (`npm run db:test`).

---

### Frontend (`/frontend/src/`)
- **`main.jsx` & `App.jsx`**: Bootstrapping di React, definizione del router/layout di base e provider di stato globale.
- **`index.css`**: Design system globale e stili CSS Vanilla dell'applicazione.
- **`components/`**: Componenti riutilizzabili dell'interfaccia utente:
  - `ShareModal.jsx`: Modale per condividere file/cartelle e gestire permessi.
  - `MarkdownViewerModal.jsx`: Modale per la visualizzazione/anteprima di documenti e file di testo/markdown all'interno del drive, con supporto ai colori personalizzati del tema.
  - `RenameModal.jsx`: Modale di Modifica elementi (`Modifica File/Cartella/QuickLink`), permette ridenominazione con selezione intelligente, aggiunta/modifica di una descrizione opzionale (`description`) e scelta del colore tema per i file Markdown (`color`).
  - `NodeCard.jsx`: Card interattiva per il rendering dei nodi, dotata di pulsante Info (`i`) per la visualizzazione della descrizione via popover e menu contestuale (Modifica, Condividi, Elimina).
  - *(Altri componenti UI modulari)*
- **`pages/`**: Componenti vista/pagina principale (es. Vista Drive principale, pagina di Login, ecc.).
- **`context/`**: React Context provider per la gestione dello stato globale (es. contesto utente/autenticazione, navigazione cartelle correnti).
- **`utils/`**:
  - `colors.js`: Utility e catalogo (`MARKDOWN_COLORS`) per la gestione dei colori personalizzabili dei file Markdown ed elementi UI.
- **`services/`**:
  - `api.js`: Wrapper e client di chiamata HTTP centralizzato verso l'API REST del backend, configurabile dinamicamente per il cloud tramite la variabile d'ambiente `VITE_API_URL`.

---

### Frontend Desktop — Tauri (`/frontend/src-tauri/`)
- `tauri.conf.json`: Configurazione dell'applicazione nativa Desktop (nome, finestre, permessi OS).
- `capabilities/default.json`: Definizione delle permission per le API native di Tauri (accesso file, finestre, ecc.).

---

## 4. Linee Guida per Modiche e Manutenzione (Per Sviluppatori & AI)

1. **Lettura Mirata**:
   - Prima di apportare una modifica, **non è necessario** leggere ogni file del progetto. È sufficiente consultare questo `ARCHITECTURE.md`, individuare il modulo/file competente (es. se si modifica l'upload di un file, controllare `nodes.routes.js`, `nodes.controller.js` e `storage.service.js`) e leggere via tool i file strettamente pertinenti.
2. **Aggiornamento Obbligatorio e Continuo di questo Documento**:
   - **REGOLA CRITICA**: Ad ogni prompt o modifica effettuata nel progetto, l'assistente AI deve **valutare rapidamente se l'intervento ha alterato la struttura o l'architettura** (es. creazione/eliminazione di un nuovo file, aggiunta di una nuova rotta API, introduzione di un nuovo servizio o componente chiave).
   - In caso di modifiche strutturali, l'AI ha l'obbligo di **aggiornare immediatamente questo file (`ARCHITECTURE.md`)** nella stessa sessione di lavoro affinché rimanga costantemente allineato alla realtà del codice.
