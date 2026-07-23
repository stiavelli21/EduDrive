# Regole di Progetto per gli Assistenti AI (EduDrive)

## 0. Divieto Assoluto di Emoji (Zero Emoji Policy per Codice e File .MD)

1. **Divieto Totale su Codice, Documentazione (.md) e Git**:
   - È **rigorosamente vietato** inserire emoji o simboli grafici speciali all'interno di:
     - **Codice sorgente**: file `.js`, `.jsx`, `.rs`, `.sql`, `.json`, ecc. (inclusi commenti, stringhe, costanti e log `console.log`).
     - **File di documentazione Markdown**: `README.md`, `docs/ARCHITECTURE.md`, `docs/IDEE.md`, `.agents/AGENTS.md` e qualsiasi altro file `.md`.
     - **Messaggi di commit Git** e risposte testuali o artefatti di documentazione.
   - **Unica Eccezione**: Solo ed esclusivamente qualora l'utente lo richieda *esplicitamente* nel prompt per una specifica necessità funzionale dell'interfaccia utente.

## 1. Principio Supremo di Deroga e Consultazione Proattiva (Override Esplicito)

1. **Priorità Assoluta delle Richieste Esplicite dell'Utente**:
   - Qualsiasi regola in questo file `AGENTS.md` **può e deve essere bypassata qualora l'utente esprima un'istruzione ESPLICITA in senso contrario**. La volontà dell'utente ha priorità massima.
2. **Espressione del Dubbio e Offerta di Alternative**:
   - Se una richiesta esplicita compromette coerenza estetica (palette fuori standard), leggibilità o best practice, **soddisfa la richiesta ma esprimi chiaramente il tuo dubbio tecnico/estetico**, proponendo alternative ottimizzate e lasciando all'utente la decisione finale.

## 2. Aggiornamento Documentazione (`docs/ARCHITECTURE.md` e `README.md`)

1. **Mantenimento Continuo di `docs/ARCHITECTURE.md`**:
   - Ad ogni modifica strutturale (nuovi endpoint, controller, componenti, servizi o cambi al flusso dati), **DEVI verificare e aggiornare `docs/ARCHITECTURE.md`** prima di concludere il turno.
   - **Orientamento Pre-Modifica**: Consulta prima `docs/ARCHITECTURE.md` per individuare i file target prima di lanciare ricerche generiche (`list_dir` / `grep_search`).
2. **Allineamento di `README.md`**:
   - Aggiorna tempestivamente `README.md` se aggiungi nuove funzionalità principali, modifichi lo stack o se le istruzioni di avvio/configurazione cambiano. Rispettando sempre il Divieto di Emoji.

## 3. Stile del Codice e Linee Guida di Sviluppo

1. **Naming e Convenzioni**:
   - Codice in inglese, espressivo e pulito. Usa `camelCase` per funzioni/metodi, `PascalCase` per componenti React (`ShareModal.jsx`), `UPPER_SNAKE_CASE` per costanti e variabili d'ambiente.
2. **Separazione delle Responsabilità (Backend & Frontend)**:
   - **Routes (`*.routes.js`)**: Definiscono solo endpoint HTTP e applicano middleware (es. JWT Auth).
   - **Controllers (`*.controller.js`)**: Validano input HTTP, invocano servizi/modelli e restituiscono risposte JSON standardizzate (`{ success: true/false, message: "..." }`).
   - **Services (`*.service.js`)**: Logica di business complessa e I/O pesante (`storage.service.js`). Non inserire logiche complesse nei controller.
   - **Frontend (`services/api.js`)**: Zero `fetch` dirette con URL hardcoded nei componenti; usa sempre il client centralizzato `api.js`.
3. **Gestione Errori e Pulizia**:
   - **Backend**: Blocchi `try/catch` o middleware globali. Restituisci status HTTP corretti (`400`, `401`, `403`, `404`, `500`).
   - **Frontend**: Gestisci sempre i 3 stati asincroni (`loading`, `success`, `error`) con feedback visivo chiaro e immediato.
   - Rimuovi `console.log` di debug temporanei e codice commentato obsoleto. Preserva i commenti documentativi esistenti.

## 4. Stile della UI e Design System (Filosofia ed Estetica)

1. **Design Tokens (`index.css`)**:
   - Utilizza **esclusivamente** le variabili globali di `frontend/src/index.css`. Non introdurre colori esadecimali arbitrari (`#xyz`) o utility non a palette salvo override utente.
   - **Brand Primary**: `--color-brand-600: #2563eb` / `--color-brand-500: #3b82f6` (bottoni primari `.btn-primary`, focus, link).
   - **Surface & Sfondo**: `--color-surface-0: #f4f7fc` (sfondo app), `--color-surface-50` / `--color-surface-100: #ffffff` (card e modali), `--color-surface-200`..`400` (bordi e divisori).
   - **Testo**: `--color-text-primary: #0f172a` (titoli/testo principale), `--color-text-secondary: #475569`, `--color-text-muted: #94a3b8`. Semantici: `--color-success`, `--color-warning`, `--color-error`.
2. **Mantra di Steve Jobs: Sintesi, Essenzialità e Intuitività**:
   - *"Simplicity is the ultimate sophistication."* Interfaccia immediata, pulita e istantaneamente comprensibile per uno studente.
   - **Zero Rumore Visivo**: Elimina elementi di distrazione o bottoni ridondanti.
   - **Gerarchia e Spaziatura Naturale**: Padding proporzionati (`--radius-md`, `--radius-xl`), font `Inter` e contrasti netti.
   - **Estetica Premium (Glassmorphism & Micro-interazioni)**: Sfrutta `.glass-card` e `.btn-primary` per superfici morbide, ombreggiature sottili e transizioni fluide (`transition-all`).

## 5. Gestione Versioning e Caricamento su GitHub (`git push`)

1. **Flusso Predefinito di Versionamento Automatico**:
   - Repository remoto: `https://github.com/stiavelli21/EduDrive.git`.
   - Su ordini di salvataggio/push generici (*"carica su github"*, *"fai push"* senza specificare versione), l'assistente AI **DEVE**:
     1. Leggere `"version"` da `/package.json` principale nella root.
     2. **Incrementare automaticamente l'ultimo numero** (es. da `0.1.5.5` a `0.1.5.6`; se si raggiungono le due cifre sull'ultimo numero, si azzera e si incrementa il numero precedente, es: `0.1.6.9` diventa `0.1.7.0`).
     3. Aggiornare `"version"` in `/package.json` e `/package-lock.json`.
     4. Eseguire `git add .`.
     5. Creare il commit con il messaggio della versione preceduta da `v` (es. `git commit -m "v0.1.5.6"`).
     6. Eseguire il push sul repository remoto (`git push origin main`).
2. **Gestione Esplicita (Override Utente)**:
   - Se l'utente specifica una versione o messaggio personalizzato (es. *"commit v0.2.0"*), segui esattamente le istruzioni esplicite.
3. **Aggiornamento Proattivo e Automatico (Quando Necessario)**:
   - Quando l'assistente rileva o l'utente indica che c'è bisogno di sincronizzare il sistema per far funzionare i servizi online, l'assistente AI **DEVE** aggiornare in automatico e proattivamente la repository GitHub eseguendo l'intero flusso predefinito di versionamento automatico.

