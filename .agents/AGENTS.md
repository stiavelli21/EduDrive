# Regole di Progetto per gli Assistenti AI (EduDrive)

## Principio Supremo di Deroga e Consultazione Proattiva (Override Esplicito)

1. **Priorità Assoluta delle Richieste Esplicite dell'Utente**:
   - Qualsiasi regola, vincolo, stile del codice o linea guida di design/UI delineata in questo file `AGENTS.md` **può e deve essere bypassata qualora l'utente esprima un'istruzione ESPLICITA in senso contrario** (ad esempio richiedere un pulsante verde non in palette, un pattern architettonico ad hoc, un'eccezione alla separazione delle responsabilità, ecc.). La volontà esplicita dell'utente ha sempre la priorità massima.

2. **Espressione del Dubbio e Offerta di Alternative**:
   - Se l'assistente AI ritiene che la richiesta esplicita dell'utente possa compromettere la coerenza estetica (es. contrasti di colore errati o fuori palette), la leggibilità del codice, le performance o le best practice di architettura, **l'AI deve soddisfare la richiesta dell'utente ma esprimere chiaramente e con cortesia il proprio dubbio tecnico/estetico**.
   - Contestualmente, l'assistente AI ha il dovere di **proporre possibili soluzioni alternative o ottimizzazioni** (es. una tonalità di verde coerente con il design system, oppure un approccio che preservi l'intento dell'utente mantenendo l'armonia globale dell'app), lasciando all'utente la decisione finale su quale strada intraprendere.

## Aggiornamento dell'Architettura e Struttura (`ARCHITECTURE.md`)

1. **Mantenimento Continuo e Proattivo**:
   - Ad ogni prompt o task in cui vengono apportate modifiche al codice (aggiunta/rimozione/rinomina di file, introduzione di nuovi endpoint in `routes/`, nuovi `controllers/`, nuovi `components/` o `services/`, oppure modifiche significative al flusso dei dati o allo stack), l'agente AI **DEVE verificare** se il file `ARCHITECTURE.md` necessita di un aggiornamento.
   - Se la modifica incide sulla struttura dei file o sulla descrizione architetturale del progetto, **l'agente deve aggiornare tempestivamente `ARCHITECTURE.md` prima di concludere il proprio turno**.

2. **Orientamento Pre-Modifica**:
   - All'avvio di ogni nuovo task, consulta `ARCHITECTURE.md` per individuare esattamente i file responsabili di una specifica funzionalità prima di effettuare chiamate di esplorazione generiche (`list_dir` / `grep_search`), così da garantire interventi precisi, rapidi e coerenti.

## Aggiornamento del Readme (`README.md`)

1. **Allineamento a Seguito di Modifiche**:
   - A seguito di modifiche al progetto, l'agente AI **DEVE verificare** se il file `README.md` necessita di un aggiornamento.
   - Il `README.md` va aggiornato ogni volta che:
     - Una modifica è così rilevante da dover essere aggiunta (es. nuove funzionalità principali, cambiamenti nello stack o nelle modalità d'uso/avvio).
     - Un'informazione scritta sul `README.md` non è più valida a seguito delle modifiche effettuate.
## Stack Cloud Ufficiale e Sincronizzazione (`Neon.tech`, `Cloudflare R2`, `Render.com`)

1. **Stack Tecnologico di Produzione Vincolante**:
   - Lo stack cloud ufficiale in produzione per EduDrive è costituito da:
     - **Database**: [Neon.tech](https://neon.tech) (PostgreSQL Serverless con SSL obbligatorio e schema gestito via Drizzle ORM).
     - **Storage File S3**: **Cloudflare R2** (gestito via `@aws-sdk/client-s3` con chiavi e bucket `edudrive-files`).
     - **Backend API**: [Render.com](https://render.com) (configurato e distribuito tramite il blueprint IaC `render.yaml`).
2. **Obbligo di Riferimento e Sincronizzazione Proattiva**:
   - Qualsiasi modifica futura al codice che incida sullo schema del database (es. modifiche a `schema.js`), sulla gestione dei file/storage (es. `storage.service.js` o upload middleware), sulle variabili d'ambiente (`.env`) o sul deploy del backend (`server.js`, `app.js`, `render.yaml`), **DEVE essere verificata e resa pienamente compatibile con questo stack cloud (Neon, Cloudflare R2 e Render)**.
   - L'assistente AI **ha il dovere di riferire esplicitamente all'utente** se una modifica al codice richiede passaggi aggiuntivi su queste piattaforme cloud (ad esempio: avvisare di eseguire `npm run db:push` per aggiornare le tabelle su Neon, aggiungere una nuova variabile su Render, o aggiornare le policy/CORS su Cloudflare R2).

## Stile del Codice e Linee Guida di Sviluppo

1. **Naming, Chiarezza e Convenzioni**:
   - Scrivi codice espressivo e autodocumentante. Usa `camelCase` per variabili, funzioni e metodi (`getNodeById`, `formatDate`), `PascalCase` per i componenti React (`ShareModal.jsx`, `RenameModal.jsx`) e `UPPER_SNAKE_CASE` per costanti e variabili d'ambiente.
   - Mantieni una nomenclatura coerente e in inglese per il codice sorgente (variabili, funzioni, nomi di file non di documentazione).

2. **Struttura e Modulazione (Separazione delle Responsabilità)**:
   - **Backend (Node/Express)**: Rispettare rigorosamente la separazione architetturale fra strati:
     - **Routes (`routes/*.routes.js`)**: Definiscono solo endpoint HTTP e applicano middleware (es. autenticazione JWT).
     - **Controllers (`controllers/*.controller.js`)**: Ricevono e validano le richieste HTTP, invocano i servizi/modelli e restituiscono risposte standardizzate in formato JSON.
     - **Services (`services/*.service.js`)**: Contengono la logica di business e le operazioni I/O pesanti su disco o database (`storage.service.js`). Non esporre logiche complesse direttamente nei controller.
   - **Frontend (React + Vite)**:
     - Scrivi componenti modulari, riutilizzabili e ben incapsulati in `components/`.
     - Non fare chiamate `fetch` dirette nei componenti con URL hardcoded: passa sempre attraverso il client centralizzato `services/api.js`.

3. **Gestione degli Errori e Resilienza**:
   - **Backend**: Avvolgi ogni operazione asincrona in blocchi `try/catch` o utilizza un middleware di gestione globale degli errori. Restituisci sempre status HTTP appropriati (`400`, `401`, `403`, `404`, `500`) accompagnati da messaggi JSON informativi (`{ success: false, message: "..." }`).
   - **Frontend**: Gestisci costantemente i tre stati operativi delle richieste asincrone (`loading`, `data`/success, `error`). Fornisci sempre un feedback visivo immediato all'utente in caso di errore od operazione completata, evitando crash o schermate bianche.

4. **Integrità della Documentazione e Pulizia**:
   - Preserva tutti i commenti, docstring e sezioni di codice esistenti che non sono direttamente correlati alle modifiche richieste dal task.
   - Rimuovi `console.log` di debug temporanei e codice commentato obsoleto prima di finalizzare una modifica.

5. **Divieto di Emoji nel Codice**:
   - Non inserire mai emoji all'interno del codice sorgente (inclusi commenti, messaggi di log o stringhe), salvo esplicita richiesta dell'utente o necessità funzionale dell'interfaccia utente.

## Stile della UI e Design System (Filosofia ed Estetica)

1. **Colori Principali e Design Tokens (`index.css`)**:
   - L'assistente AI **DEVE utilizzare di base esclusivamente le variabili e i design tokens globali definiti in `frontend/src/index.css`**, salvo esplicita indicazione contraria dell'utente (nel qual caso applicare il *Principio Supremo di Deroga e Consultazione Proattiva* esprimendo eventuali dubbi estetici e proponendo alternative armoniche). Non introdurre arbitrariamente colori esadecimali o utility generiche scollegate dalla palette di EduDrive senza richiesta esplicita.
   - **Brand / Colore Primario (Blu Vibrante)**:
     - `--color-brand-600: #2563eb` e `--color-brand-500: #3b82f6` (sfumature dal 50 al 900). Utilizzati per le azioni principali, bottoni primari (`.btn-primary`), link, indicatori di focus e stati attivi.
   - **Surface & Sfondo (Light Mode Pulita)**:
     - `--color-surface-0: #f4f7fc` per lo sfondo principale dell'app.
     - `--color-surface-50` e `--color-surface-100: #ffffff` per le card, le modali e le superfici di contenuto.
     - `--color-surface-200` fino a `--color-surface-400` per bordi, divisori e scorrimento.
   - **Testo e Leggibilità**:
     - `--color-text-primary: #0f172a` (scuro, ad altissimo contrasto per titoli e testo principale).
     - `--color-text-secondary: #475569` per sottotitoli e descrizioni.
     - `--color-text-muted: #94a3b8` per segnaposto, date e metadati secondari.
   - **Colori Semantici di Feedback**: Successo (`--color-success: #10b981`), Avviso (`--color-warning: #f59e0b`), Errore (`--color-error: #ef4444`).

2. **Mantra di Steve Jobs: Sintesi, Essenzialità e Intuitività**:
   - *"Simplicity is the ultimate sophistication."* Progetta e modifica l'interfaccia utente seguendo il principio della **riduzione all'essenziale**. L'app deve essere immediata, pulita e istantaneamente comprensibile per uno studente, senza bisogno di istruzioni o interfacce sovraccariche.
   - **Zero Rumore Visivo**: Elimina ogni elemento di distrazione, bottone ridondante, decorazione fine a sé stessa o testo eccessivamente prolisso. Ogni elemento grafico, icona o testo a schermo deve rispondere a una chiara necessità funzionale.
   - **Gerarchia e Spaziatura Naturale**: Lascia "respirare" il contenuto attraverso margini e padding generosi ma proporzionati (`--radius-md`, `--radius-xl`), tipografia chiara (`Inter`) e contrasti gerarchici ben definiti. L'occhio dell'utente deve essere guidato naturalmente verso l'azione principale.
   - **Estetica Premium e Tattile (Glassmorphism & Micro-interazioni)**: Sfrutta le classi riutilizzabili del design system (come `.glass-card`, `.btn-primary`) per creare superfici morbide, ombreggiature sottili, gradienti delicati e transizioni fluide. L'interfaccia deve risultare reattiva, solida ed elegante al tatto visivo, trasmettendo una sensazione di cura e qualità di livello superiore.

## Gestione Versioning e Caricamento su GitHub (`git push`)

1. **Repository e Flusso Predefinito**:
   - Il repository remoto di riferimento del progetto è: `https://github.com/stiavelli21/EduDrive.git`.
   - Ogni volta che l'utente richiede di effettuare un salvataggio o caricamento su GitHub (es. con comandi come *"carica su github"*, *"fai un push"*, o simili senza specificare una versione o un messaggio di commit manuale), l'assistente AI **DEVE seguire la procedura di versionamento automatico**:
     1. Leggere il campo `"version"` all'interno del file `package.json` principale nella root del progetto (`/package.json`).
     2. **Incrementare automaticamente l'ultimo numero** del formato di versione (es. se la versione attuale è `0.1.5.5`, incrementarla di uno facendola diventare `0.1.5.6`).
     3. Aggiornare il campo `"version"` nel file `/package.json` con il nuovo valore (es. `"version": "0.1.5.6"`).
     4. Aggiungere tutte le modifiche allo stage (`git add .`).
     5. Creare un commit utilizzando come messaggio/nome esattamente la versione incrementata preceduta dalla lettera `v` (es. `git commit -m "v0.1.5.6"`).
     6. Effettuare il push delle modifiche sul repository remoto (`git push origin main` oppure verso `https://github.com/stiavelli21/EduDrive.git`).

2. **Gestione Esplicita della Versione (Override Utente)**:
   - Se l'utente specifica esplicitamente una versione diversa o un nome di commit personalizzato (es. *"carica su github con commit v0.2.0"* o *"imposta versione 1.0.0 e carica"*):
     - L'assistente AI deve **seguire esattamente le istruzioni esplicite dell'utente**: aggiornare il campo `"version"` del `package.json` al valore richiesto (es. `0.2.0`), creare il commit con il messaggio indicato (es. `v0.2.0`) e procedere al push su GitHub.
