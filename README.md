# EduDrive

Repository GitHub: [https://github.com/stiavelli21/EduDrive.git](https://github.com/stiavelli21/EduDrive.git)

EduDrive e un'applicazione desktop locale per la gestione dei file, progettata come clone di Google Drive. Permette di organizzare, archiviare, visualizzare e cercare file e cartelle in locale e offline, con archiviazione fisica su disco e database SQLite.

---

## Stack Tecnologico

- **Desktop Framework**: Wails v2 (backend Go nativo + frontend WebView2 su Windows)
- **Backend**: Go (Golang 1.25+)
- **Database**: SQLite Pure-Go (`modernc.org/sqlite`) - Nessuna dipendenza CGO o GCC
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS v3
- **Icone**: Lucide React
- **Storage Locale**: File system gestito in `%APPDATA%/EduDrive` con identificatori UUID univoci

---

## Funzionalita Principali

1. **Gestione Cartelle e Alberature**:
   - Creazione di cartelle virtuali a profondita illimitata.
   - Navigazione rapida tramite percorsi breadcrumb cliccabili.
   - Rinomina ed eliminazione con gestione automatica della gerarchia.

2. **Importazione e Archiviazione File**:
   - Caricamento multiplo tramite file dialog nativo di Windows.
   - Supporto Drag and Drop per trascinare file da Esplora Risorse nell'applicazione.
   - Salvataggio fisico dei file con UUID univoci nella cartella `storage_data/`.

3. **Apertura ed Esportazione**:
   - Apertura con doppio clic tramite l'applicazione predefinita del sistema operativo.
   - Esportazione e salvataggio di copie dei file in percorsi personalizzati.

4. **Cestino e Ripristino**:
   - Soft-delete degli elementi con vista dedicata Cestino.
   - Funzioni di ripristino o eliminazione definitiva.
   - Svuotamento completo del cestino con cancellazione fisica dei file da disco.

5. **Ricerca Globale**:
   - Ricerca istantanea in tempo reale per nome file o cartella.

6. **Interfaccia e Layout**:
   - Viste commutabili: Griglia ed Elenco tabellare.
   - Icone e badge dedicati in base al tipo MIME ed estensione.
   - Menu contestuale col tasto destro per tutte le operazioni rapide.
   - Widget e modale con statistiche di memoria occupata.

---

## Struttura del Progetto

```
EduDrive/
├── app.go                  # Controller backend ed export metodi Wails
├── main.go                 # Entrypoint Go, configurazione finestra e Wails
├── wails.json              # Configurazione del progetto Wails
├── go.mod / go.sum         # Dipendenze Go
│
├── db/                     # Layer SQLite Pure-Go
│   ├── db.go               # Schema, query CRUD, ricerca, transazioni
│   └── db_test.go          # Test unitari database
│
├── models/                 # Strutture dati condivise (Item, Breadcrumb, StorageStats)
│   └── item.go
│
├── storage/                # Gestione fisica dei file su disco
│   ├── storage.go          # Salvataggio con UUID, detection MIME, export, rimozione
│   └── storage_test.go     # Test unitari storage manager
│
├── frontend/               # Applicazione React + TypeScript + Vite + TailwindCSS
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx        # Entrypoint React
│   │   ├── App.tsx         # Coordinatore principale di stato e UI
│   │   ├── style.css       # Stili e direttive Tailwind
│   │   ├── types/          # Tipi e interfacce TypeScript
│   │   ├── utils/          # Formattatori byte, date e resolver icone
│   │   ├── components/     # Componenti UI (Header, Sidebar, GridView, ListView, Modals, ecc.)
│   │   └── wailsjs/        # Bindings TypeScript autogenerati da Wails
│   └── dist/               # Build frontend di produzione
│
└── build/
    └── bin/
        └── EduDrive.exe    # Eseguibile desktop compilato per Windows
```

---

## Guida all'Avvio e allo Sviluppo

### Prerequisiti
- Go 1.25 o superiore
- Node.js 20+ e npm
- Wails v2 CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Modalita Sviluppo (Hot Reload)
```bash
wails dev
```

### Compilazione Produzione
```bash
wails build
```

### Esecuzione Test Unitari
```bash
go test -v ./...
```

---

## Posizione dei Dati

- **Directory Base**: `%APPDATA%\EduDrive`
- **Database**: `%APPDATA%\EduDrive\edudrive.db`
- **Archivio File**: `%APPDATA%\EduDrive\storage_data\`
