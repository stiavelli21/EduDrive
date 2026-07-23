# EduDrive

**Il cloud storage open source fatto dagli studenti, per gli studenti.**
Condividi appunti, organizza documenti e salva risorse esterne in un unico spazio di studio collaborativo.

![Anteprima Interfaccia EduDrive](docs/images/dashboard.png)

---

## Funzionalità Principali

- **Design Pulito**: Un'interfaccia moderna e senza distrazioni per concentrarsi sullo studio.
- **Doppia Modalità (Cloud o Locale)**: Accedi online con il tuo account Google, oppure usa la modalità offline per salvare i file direttamente sul tuo dispositivo senza bisogno di internet.
- **Spostamento File Semplice**: Un clic per spostare un file dal cloud al tuo computer e viceversa.
- **QuickLink**: Salva link esterni (Google Drive, YouTube, ecc.) come se fossero normali file nella tua cartella.
- **Convertitore Markdown**: Trasforma in automatico documenti Word e file di testo in formato Markdown. Puoi anche fare il contrario quando scarichi un file.
- **Condivisione**: Scegli con chi condividere le tue cartelle e assegna permessi di sola lettura o modifica.

---

## Come Avviare l'Applicazione

Hai diverse opzioni per utilizzare EduDrive sul tuo computer. Assicurati di aver installato **Node.js** e **Docker Desktop**.

### 1. Avvio Rapido Offline
Il modo più veloce per usare EduDrive senza internet e senza account:
- Fai doppio clic su `avvia.bat` nella cartella principale. Questo script farà partire tutto automaticamente.

### 2. Creare l'App Desktop (Connessa al Cloud)
Se hai già configurato un server online e vuoi solo creare l'eseguibile per il tuo PC:
1. Copia `frontend/.env.example` in `frontend/.env` e inserisci l'URL del tuo server.
2. Esegui `build.bat` su Windows (o `npm run build:desktop`).
3. Troverai il file `.exe` pronto all'uso in `frontend/src-tauri/target/release/`.

### 3. Avviare tutto in locale (Per sviluppatori)
Se vuoi eseguire sia il server che l'interfaccia sul tuo computer:
1. Esegui `npm install`.
2. Crea il file `backend/.env` partendo da `backend/.env.example`.
3. Avvia i servizi con `npm run start:desktop` (per l'app desktop) o `npm run dev` (per l'interfaccia nel browser).

---

## Come usare i QuickLink
1. Clicca su "Aggiungi QuickLink" nella schermata principale.
2. Inserisci un nome e l'indirizzo web.
3. Il link apparirà come un normale file: basterà cliccarlo per aprire la risorsa!

---

## Per gli Sviluppatori

EduDrive è progettato per essere esteso facilmente. Le tecnologie principali includono **React** (interfaccia), **Tauri** (app desktop), **Node.js** (backend) e **PostgreSQL** (database).

- **Plugin**: Puoi aggiungere nuove funzioni in pochi passaggi creando nuove rotte nel backend. Leggi [IDEE.md](./docs/IDEE.md) per spunti interessanti.
- **Architettura**: Consulta [ARCHITECTURE.md](./docs/ARCHITECTURE.md) per capire come comunicano le varie parti dell'app.
- **Linee Guida**: Segui le regole scritte in [.agents/AGENTS.md](./.agents/AGENTS.md) (ricorda il divieto assoluto di usare emoji nel codice e nella documentazione).

---

**Licenza**: MIT License. Progetto open source libero, creato da studenti per gli studenti.
