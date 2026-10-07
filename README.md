# EduDrive

EduDrive e un'applicazione desktop per la gestione dei file e l'organizzazione dello studio universitario. Funziona completamente in locale e offline, combinando le funzionalita di un archivio file intuitivo (in stile Google Drive) con strumenti dedicati al percorso accademico degli studenti.

---

## Panoramica e Funzionalita

### 1. Gestione di File e Cartelle
- **Organizzazione ad albero**: creazione di cartelle a qualsiasi livello di profondita con navigazione rapida tramite percorsi breadcrumb.
- **Spostamento elementi**: spostamento rapido di file e cartelle tramite modale ad albero gerarchico ("Sposta in...") con rilevamento automatico e prevenzione dei cicli ricorsivi infiniti, oltre al supporto per il trascinamento Drag & Drop interno tra cartelle.
- **Filtri rapidi e ordinamento avanzato**: barra di filtraggio per tipologia (Tutti, Documenti, Note, Link, Immagini) e ordinamento multi-campo (per Nome, Data di modifica, Dimensione e Tipo di file) con direzione ascendente o discendente.
- **Importazione ed esportazione**: caricamento di file singoli o multipli tramite la finestra di dialogo di sistema o tramite trascinamento esterno dal computer (Drag & Drop), con esportazione immediata di copie su disco.
- **Modalita di visualizzazione**: possibilita di scegliere tra vista a griglia (con icone grandi) e vista a elenco dettagliato.
- **Ricerca in tempo reale**: individuazione istantanea di file e cartelle digitando il nome nella barra di ricerca globale.
- **Cestino e recupero**: eliminazione sicura nel cestino con possibilita di ripristino o di eliminazione definitiva.

### 2. Studio, Documenti, Immagini e Codice
- **Streaming HTTP locale ad alte prestazioni**: erogazione diretta dei file fisici tramite handler HTTP di Wails (`/storage/<uuid>.<ext>`) con supporto completo alle intestazioni HTTP Range (riproduzione e seek immediato di audio e video, azzeramento dell'overhead di memoria Base64/Blob).
- **Visualizzatore immagini integrato (Lightbox)**: visualizzazione in-app per immagini (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`) con zoom a rotellina, trascinamento (pan), rotazione a 90 gradi, modalita a schermo intero e navigazione a galleria tra le immagini della cartella.
- **Visualizzatore ed editor di codice e testo**: visualizzazione e modifica in-app di file di codice e testo piano (`.txt`, `.json`, `.csv`, `.log`, `.py`, `.sql`, `.java`, `.c`, `.cpp`, `.html`, `.css`, `.js`, `.ts`, ecc.) con numerazione delle righe, colorazione sintattica PrismJS, ricerca interna (`Ctrl+F`), scorciatoia di salvataggio rapido (`Ctrl+S`) e persistenza immediata su disco e database.
- **Creazione ed editor Note Markdown**: creazione rapida di note ("Crea nota"), visualizzatore ed editor Markdown con colorazione sintattica nei blocchi di codice, indice dinamico laterale dei titoli (Table of Contents / TOC) con scorrimento fluido, ricerca e sostituzione testuale (`Ctrl+F`), rendering di formule scientifiche LaTeX/KaTeX, statistiche di lettura e stampa/esportazione diretta in PDF impaginato.
- **Lettore documenti integrato**: apertura e lettura in-app di documenti PDF e file Microsoft Word (.docx) con funzioni di zoom, rotazione, visualizzazione a schermo intero e stampa.
- **Conversione automatica in Markdown**: trasformazione diretta di PDF, DOCX, DOC e file di testo in documenti Markdown formattati.
- **Segnalibri Web**: salvataggio di link a siti internet e risorse online all'interno delle cartelle.

### 3. Strumenti per la Carriera Universitaria
- **Libretto Esami e Media Ponderata**: registrazione degli esami superati (materia, voto, eventuale lode e CFU) con calcolo automatico e immediato della media ponderata.
- **Stima del Voto di Laurea**: calcolo automatico del voto base di partenza per la laurea su base 110.
- **Monitoraggio CFU**: barra di avanzamento rispetto all'obiettivo di crediti formativi (Triennale 180 CFU, Magistrale 120 CFU, Ciclo Unico 300/360 CFU).
- **Simulatore di Voti ("What-If")**: strumento dinamico per simulare l'impatto di un voto futuro sulla media e sulla base di laurea prima di sostenere l'esame.
- **Scadenziario Esami**: promemoria delle prossime date d'esame nella barra laterale con indicatore visivo di urgenza a colori (verde per date lontane, giallo per scadenze intermedie, rosso per scadenze imminenti entro 10 giorni).

### 4. Assistente IA per gli Appunti (Google Gemini)
- **Spiegazione contestuale su selezione**: selezione di porzioni di testo all'interno di documenti Markdown, Word (.docx) o PDF con visualizzazione immediata di un menu contestuale rapido (Spiega, Semplifica, Esempio pratico, Chiedi).
- **Analisi visiva e appunti manoscritti**: supporto a immagini e foto di appunti scritti a mano con strumento di ritaglio ad area rettangolare per isolare formule, dimostrazioni o schemi e sottoporli all'IA.
- **Pannello di studio laterale in streaming**: barra laterale dedicata alla discussione del documento con generazione progressiva delle risposte (Server-Sent Events) e rendering completo delle formule matematiche via KaTeX.
- **Schematizzazione automatica**: pulsanti ad azione rapida per estrarre la scaletta dell'appunto, generare sintesi dei concetti cardine o produrre domande di autovalutazione per l'esame.
- **Riservatezza e persistenza locale**: la chiave API di Google Gemini viene salvata in forma sicura nel database SQLite locale e non viene mai condivisa. L'assistente e disattivato per impostazione predefinita finche l'utente non inserisce una chiave valida.

### 5. Studio Podcast (Stile NotebookLM)
- **Generazione dialoghi tra conduttori**: creazione automatica di conversazioni didattiche e vivaci tra due host virtuali (Marco ed Elena) a partire da uno o piu documenti presenti in EduDrive.
- **Domande di focus personalizzate**: spazio dedicato dove l'utente puo inserire dubbi specifici, chiarimenti o argomenti d'esame da includere e approfondire nel podcast.
- **Sintesi vocale neurale realistica (Edge-TTS)**: generazione audio Pure-Go tramite protocollo WebSocket con voci neurali italiane di alta qualita (Diego ed Elsa).
- **Player interattivo e trascrizione sincronizzata**: riproduzione audio con controllo della velocita, salti temporali, indicatore visivo dell'oratore attivo e avanzamento sincronizzato delle battute (stile karaoke).
- **Esportazione file**: esportazione su disco della traccia audio (.mp3) e del copione integrale (.md) con timestamp delle battute.

### 6. Studio Dispense (Sintetizzatore Multi-Documento e Slide)
- **Elaborazione Multi-Fonte**: selezione aggregata di dispense, slide (PDF), documenti Word, immagini o file di testo convertiti ed elaborati contemporaneamente dall'IA.
- **Quattro Modalita Didattiche**:
  - *Dispensa Ragionata Discorsiva*: unifica le slide telegrafiche ed elenchi puntati isolati in un discorso accademico fluido, continuo e rigoroso, spiegando il filo conduttore logico.
  - *Semplificazione Didattica (Metodo Feynman)*: scompone concetti ostici in passaggi graduali con analogie del mondo reale e chiarimento del gergo tecnico.
  - *Approfondimento Tecnico & Esempi*: colma i salti logici tipici delle slide, esplicitando dimostrazioni matematiche complete in formato KaTeX ed esempi pratici o frammenti di codice.
  - *Schemi & Preparazione Esame*: mappa concettuale dei punti cardine, lista di domande d'esame frequenti con risposte modello perfette e analisi dei trabocchetti piu comuni.
- **Editor e Lettore Integrato**: visualizzazione formattata con formule matematiche KaTeX ed editor Markdown per apportare modifiche o note personali.
- **Persistenza e Integrazione con il Drive**: salvataggio automatico o su richiesta del file .md all'interno dell'archivio EduDrive ed esportazione su file system locale.

---

## Dettagli Tecnici e Architettura

### Stack Tecnologico
- **Desktop Shell**: Wails v2 (Go backend + WebView2 su Windows)
- **Backend**: Go (Golang 1.25+)
- **Database**: SQLite Pure-Go (`modernc.org/sqlite` - Zero CGO/GCC)
- **Motore IA**: Client REST Pure-Go per Google Gemini (`EduDrive/ai`) con streaming SSE e supporto multimodale (testo, PDF e immagini inline)
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v3, PDF.js (`pdfjs-dist`)
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
├── app_ai.go               # Metodi IPC dell'assistente IA, gestione streaming ed eventi
├── app_podcast.go          # Metodi IPC dello Studio Podcast (sceneggiatura, sintesi, export)
├── app_handout.go          # Metodi IPC dello Studio Dispense (sintetizzatore multi-slide, prompt didattici, export)
├── ai/                     # Client REST Pure-Go per Google Gemini API (SSE streaming, modelli)
├── tts/                    # Client Pure-Go Edge-TTS (sintesi vocale neurale Diego ed Elsa)
├── main.go                 # Inizializzazione finestra desktop e lifecycle Wails
├── models/                 # Strutture dati Go (Item, Breadcrumb, ExamDate, PassedExam, AI, Podcast, Handout)
├── db/                     # Layer SQLite (schema, migrazioni, query CRUD)
├── storage/                # Gestione fisica file su disco (UUID, rilevamento MIME, I/O)
├── converter/              # Motore di conversione documenti a Markdown (DOCX, PDF, testo)
├── frontend/               # Interfaccia utente React + TypeScript
│   ├── src/
│   │   ├── App.tsx         # Stato globale, navigazione e coordinamento modali
│   │   ├── components/     # Viste e componenti UI (Header, Sidebar, GridView, CareerView, AI, Podcast, Handout)
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
