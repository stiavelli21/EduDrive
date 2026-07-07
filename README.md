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
| **Backend** | Node.js + Express (REST API modulari) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Storage** | Object Storage S3 compatibile (MinIO / Cloudflare R2 / Backblaze) |

---

## Guida all'Avvio (In 60 secondi)

### Prerequisiti
- **Node.js** (v18+)
- **Docker & Docker Compose** (per database e storage)

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
3. Apre EduDrive come **applicazione desktop autonoma** (senza barre del browser).

*(Per terminare, premi `CTRL+C` nel terminale).*

---

### 3. Avvio Manuale (Per Linux / macOS / Dev)
Se preferisci gestire i processi separatamente:
1. **Infrastruttura**: `docker compose up -d`
2. **Backend**: `cd backend && npm install && npm run dev` *(sulla porta 3001)*
3. **Frontend**: `cd frontend && npm install && npm run dev` *(sulla porta 5173)*

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

 **Cerchi ispirazione per un plugin?** Leggi [IDEE.md](./IDEE.md) per scoprire proposte pronte per essere sviluppate!

---

## Licenza

**MIT License** — Progetto open source libero, creato da studenti per gli studenti.
