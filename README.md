# EduDrive

> Piattaforma di archiviazione cloud open source per studenti, progettata per lo studio collaborativo.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-v0.1_alpha-orange.svg)

## Funzionalità Principali

- **Gestione File e Cartelle**: Carica PDF, immagini e documenti. Organizza i tuoi materiali con cartelle annidate.
- **QuickLink**: Salva link di Google Drive, Dropbox e YouTube come nodi cliccabili all'interno del tuo drive (senza dover più creare file di testo per salvare i link).
- **Condivisione Selettiva**: Condividi cartelle con utenti specifici tramite email. Scegli se concedere permessi di sola lettura o di modifica.
- **Visibilità Pubblica o Privata**: Rendi qualsiasi cartella o file accessibile pubblicamente a tutti, oppure mantienilo privato.
- **Autenticazione Sicura con JWT**: Accesso protetto tramite token di accesso e di ricarica (refresh token).
- **Architettura Modulare per Plugin**: Codice pulito e modulare, pensato per permettere agli studenti sviluppatori di estendere facilmente le funzionalità.

## Stack Tecnologico

| Livello | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express (API REST) |
| Database | PostgreSQL + Drizzle ORM |
| Storage | Compatibile con S3 (MinIO / Cloudflare R2 / Backblaze B2) |
| Autenticazione | JWT (access token + refresh token) |

## Guida Rapida all'Avvio

### Prerequisiti

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/) e Docker Compose (per PostgreSQL e MinIO)

### 1. Configurazione Iniziale

Clona il repository e copia il file delle variabili d'ambiente:

```bash
git clone https://github.com/your-username/edudrive.git
cd edudrive

# Copia le variabili d'ambiente per il backend
cp .env.example backend/.env
```

### 2. Avvio Rapido (Consigliato per Windows)

Per avviare l'intero ecosistema con un solo comando e aprire l'interfaccia come programma autonomo (senza schede o barre di navigazione del browser), fai doppio clic sul file `avvia.bat` oppure esegui da terminale:

```cmd
avvia.bat
```

Questo script eseguirà automaticamente:
1. L'avvio dei container Docker (PostgreSQL su porta 5432 e MinIO su porte 9000/9001).
2. L'avvio simultaneo del Backend (porta 3001) e del Frontend (porta 5173).
3. L'apertura automatica di EduDrive in modalità applicazione desktop standalone.

Per terminare tutti i server, premi `CTRL+C` nel terminale in cui è in esecuzione lo script.

### 3. Avvio Manuale (Alternativo)

Se preferisci avviare i singoli servizi manualmente da terminali separati:

#### Avvio Database e Storage (Docker)
```bash
docker compose up -d
```

#### Avvio Backend
```bash
cd backend
npm install
npm run dev
```
Il server backend sarà attivo su `http://localhost:3001`

#### Avvio Frontend
```bash
cd frontend
npm install
npm run dev
```
Il client frontend sarà attivo su `http://localhost:5173`

## Struttura del Progetto

```
edudrive/
├── frontend/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/    # Componenti UI riutilizzabili
│   │   ├── pages/         # Login, Registrazione, Dashboard
│   │   ├── context/       # React Context (Autenticazione)
│   │   └── services/      # Client API (Axios)
│   └── ...
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── controllers/   # Logica di business
│   │   ├── routes/        # Definizione degli endpoint HTTP
│   │   ├── middleware/    # Autenticazione e gestione errori
│   │   ├── models/        # Schema Drizzle ORM
│   │   ├── services/      # Servizio di archiviazione S3
│   │   └── utils/         # JWT, validazione dati (Zod)
│   └── ...
├── database/          # Schema SQL
│   └── schema.sql
├── scripts/           # Script di utilità e avvio applicazione
│   └── open-app.js
├── avvia.bat          # Script di avvio rapido all-in-one per Windows
└── docker-compose.yml # Infrastruttura di sviluppo Docker
```

## QuickLink: Come Funziona

Invece di creare un file di testo per salvare un link di Google Drive o una risorsa esterna, EduDrive ti permette di salvare qualsiasi URL come un vero e proprio nodo nel tuo drive:

1. Clicca su **"Aggiungi QuickLink"** nella dashboard principale.
2. Inserisci un titolo descrittivo e l'URL (es. `https://drive.google.com/file/d/...`).
3. Il collegamento viene salvato nel database come nodo con la proprietà `type: 'link'`.
4. Apparirà nell'albero dei tuoi file identificato appositamente come collegamento esterno.
5. Cliccando sul nodo, l'URL si aprirà direttamente in una nuova finestra o scheda.

## Sviluppo di Plugin

EduDrive è progettato per essere facilmente esteso dagli studenti sviluppatori. Ecco come aggiungere un nuovo plugin al backend:

### Creazione di un Plugin per il Backend

1. Crea il file per le rotte: `backend/src/routes/your-plugin.routes.js`
2. Crea il controller con la logica: `backend/src/controllers/your-plugin.controller.js`
3. Registra il plugin nel file principale `backend/src/app.js`:
   ```js
   import pluginRoutes from './routes/your-plugin.routes.js';
   app.use('/api/your-plugin', pluginRoutes);
   ```

### Idee per Nuovi Plugin

Consulta il file dedicato [IDEE.md](./IDEE.md) per scoprire tutte le idee di implementazione proposte e per contribuire con nuove funzionalità!

## Licenza

MIT — Gratuito per gli studenti, creato dagli studenti.
