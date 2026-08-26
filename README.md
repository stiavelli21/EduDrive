# EduDrive

EduDrive e un'applicazione desktop per la gestione dei file e l'organizzazione dello studio universitario. Funziona completamente in locale e offline, combinando le funzionalita di un archivio file intuitivo (in stile Google Drive) con strumenti dedicati al percorso accademico degli studenti.

---

## Panoramica e Funzionalita

### 1. Gestione di File e Cartelle
- **Organizzazione ad albero**: creazione di cartelle a qualsiasi livello di profondita con navigazione rapida tramite percorsi breadcrumb.
- **Importazione semplice**: caricamento di file singoli o multipli tramite la finestra di dialogo di sistema o tramite trascinamento diretto (Drag & Drop).
- **Modalita di visualizzazione**: possibilita di scegliere tra vista a griglia (con icone grandi) e vista a elenco dettagliato.
- **Ricerca in tempo reale**: individuazione istantanea di file e cartelle digitando il nome nella barra di ricerca.
- **Cestino e recupero**: eliminazione sicura nel cestino con possibilita di ripristino o di eliminazione definitiva.

### 2. Studio, Documenti e Note
- **Editor Markdown e formule scientifiche**: creazione e modifica di appunti in formato Markdown con supporto a tabelle, elenchi, codice e formule matematiche LaTeX/KaTeX. Include modalita affiancata (editor e anteprima in tempo reale), salvataggio rapido (`Ctrl+S`) e statistiche di lettura (conteggio parole, caratteri e stima dei minuti).
- **Lettore documenti integrato**: apertura e lettura in-app di documenti PDF e file Microsoft Word (.docx) con funzioni di zoom, rotazione, visualizzazione a schermo intero e stampa.
- **Conversione automatica in Markdown**: trasformazione diretta di PDF, DOCX, DOC e file di testo in documenti Markdown formattati.
- **Segnalibri Web**: salvataggio di link a siti internet e risorse online all'interno delle cartelle.

### 3. Strumenti per la Carriera Universitaria
- **Libretto Esami e Media Ponderata**: registrazione degli esami superati (materia, voto, eventuale lode e CFU) con calcolo automatico e immediato della media ponderata.
- **Stima del Voto di Laurea**: calcolo automatico del voto base di partenza per la laurea su base 110.
- **Monitoraggio CFU**: barra di avanzamento rispetto all'obiettivo di crediti formativi (Triennale 180 CFU, Magistrale 120 CFU, Ciclo Unico 300/360 CFU).
- **Simulatore di Voti ("What-If")**: strumento dinamico per simulare l'impatto di un voto futuro sulla media e sulla base di laurea prima di sostenere l'esame.
- **Scadenziario Esami**: promemoria delle prossime date d'esame nella barra laterale con indicatore visivo di urgenza a colori (verde per date lontane, giallo per scadenze intermedie, rosso per scadenze imminenti entro 10 giorni).

---

## Dettagli Tecnici e Architettura

### Stack Tecnologico
- **Desktop Shell**: Wails v2 (Go backend + WebView2 su Windows)
- **Backend**: Go (Golang 1.25+)
- **Database**: SQLite Pure-Go (`modernc.org/sqlite` - Zero CGO/GCC)
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v3
- **Icone e Formule**: Lucide Icons, KaTeX (`remark-math`, `rehype-katex`)

### Architettura e Persistenza Dati
- **Disaccoppiamento Storage**: i nomi logici e la struttura delle cartelle risiedono nel database SQLite, mentre i file fisici vengono archiviati su disco tramite identificatori univoci UUID (`storage_data/<UUID>.<ext>`).
- **Segnalibri URL**: archiviati come record nel database (`mime_type = 'url'`) a zero byte su disco.
- **Cestino e Soft-Delete**: l'eliminazione sposta l'elemento nel cestino (`is_trash = 1`) preservando i dati fisici. La cancellazione definitiva da disco avviene solo su eliminazione permanente o svuotamento del cestino.

### Percorsi dei Dati a Runtime
- **Directory Dati**: `%APPDATA%\EduDrive\`
- **Database SQLite**: `%APPDATA%\EduDrive\edudrive.db`
- **Archivio File Fisici**: `%APPDATA%\EduDrive\storage_data\`

### Struttura del Progetto

```
EduDrive/
├── app.go                  # Controller backend Wails, export metodi IPC e logica embed
├── main.go                 # Inizializzazione finestra desktop e lifecycle Wails
├── models/                 # Strutture dati Go (Item, Breadcrumb, ExamDate, PassedExam, ecc.)
├── db/                     # Layer SQLite (schema, migrazioni, query CRUD)
├── storage/                # Gestione fisica file su disco (UUID, rilevamento MIME, I/O)
├── converter/              # Motore di conversione documenti a Markdown (DOCX, PDF, testo)
├── frontend/               # Interfaccia utente React + TypeScript
│   ├── src/
│   │   ├── App.tsx         # Stato globale, navigazione e coordinamento modali
│   │   ├── components/     # Viste e componenti UI (Header, Sidebar, GridView, ListView, CareerView)
│   │   └── wailsjs/        # Bindings TypeScript autogenerati da Wails
└── build/bin/              # Eseguibile compilato per Windows (EduDrive.exe)
```

---

## Guida allo Sviluppo e alla Compilazione

### Prerequisiti
- Go 1.25+
- Node.js 20+ e npm
- Wails v2 CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Comandi Principali

```bash
# Avvio in modalita sviluppo con hot-reload
wails dev

# Esecuzione dei test unitari backend
go test -v ./...

# Verifica build frontend
cd frontend && npm run build

# Compilazione eseguibile desktop per Windows
wails build
```
