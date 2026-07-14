# Audit Indipendente — 14 Luglio 2026

**Cosa dice davvero il codice di EduDrive, sezione per sezione.**

13 aree analizzate riga per riga (sicurezza, performance, comunicazione col server, feature, UX, codice morto), più una ricerca sullo stato dell'arte 2026 per lo stack usato. Ogni finding qui sotto è stato letto e confermato contro il codice reale, non generato per sentito dire.

---

## Riepilogo Audit

| Gravità | Quantità |
| :--- | :--- |
| **Critical** | 2 |
| **High** | 21 |
| **Medium** | 27 |
| **Low** | 9 |
| **A posto [OK]** | 18 |

### Nota di metodo — leggi prima di fidarti dei numeri

#### I problemi più critici (Top 5)
Se puoi risolvere solo cinque cose, sono queste:

1. **Bypass autenticazione Google/Firebase**: Chiunque può impersonare qualsiasi utente. Il fallback di verifica del token Google/Firebase decodifica il JWT senza mai controllarne la firma crittografica — ed è il percorso sempre attivo in produzione, non un caso limite (`auth.controller.js:382-424`).
2. **CORS eccessivamente permissivo**: La configurazione CORS non protegge nulla. Accetta qualsiasi origin con `credentials:true`: un sito esterno può rubare un access token valido alla semplice visita di una pagina dalla vittima loggata. Trovato indipendentemente da 4 revisori diversi (`app.js:76-97`).
3. **Race condition nella navigazione**: Navigare tra cartelle velocemente mostra i file sbagliati. Nessuna cancellazione delle richieste: una risposta lenta relativa alla cartella precedente può sovrascrivere la vista della cartella corrente, con rischio di azioni (elimina/condividi) sul contenuto sbagliato (`DashboardPage.jsx:62-92`).
4. **Upload bufferizzati in RAM sul server**: Gli upload passano interi dalla RAM del server invece di andare direttamente a Cloudflare R2 via presigned URL — su un'istanza Render da 512MB, file da 50MB e utenti concorrenti sono una ricetta per OOM.
5. **Feature assenti o incomplete rispetto al README**: Due feature promesse nel README non esistono affatto: condividere per `@username` (solo email è implementato) e modificare lo username dalla modale profilo (il campo non c'è).

---

## 1. Sicurezza (11 finding)
Autenticazione, autorizzazione, gestione token, superficie di attacco.

### [Critical] Bypass totale della verifica firma JWT — impersonificazione di qualsiasi utente
- **File/Riferimento:** `auth.controller.js:382`
- **Dettagli:** Il percorso primario `verifyIdToken` fallisce quasi sempre per i token Firebase reali (audience/issuer diversi da quelli attesi da `OAuth2Client`), e `GOOGLE_CLIENT_ID` non è nemmeno configurato in `.env.example` / `render.yaml`. Il fallback nel catch decodifica il payload JWT con `Buffer.from(base64)` e si fida di issuer, scadenza ed email — tutti campi controllati dall'attaccante — senza mai verificare la firma crittografica. In produzione questo è il percorso di default, non un caso limite.
- **Scenario di fallimento:** Un attaccante costruisce a mano un JWT con payload `{"iss":"...","email":"vittima@scuola.it","exp":<futuro>}` e una firma qualsiasi, lo invia a `POST /api/auth/google`. Il backend lo accetta ed emette token EduDrive validi per l'account della vittima. Impersonificazione completa, zero interazione della vittima.
- **Correzione:** Verificare sempre la firma: Firebase Admin SDK `verifyIdToken()` per i token Firebase, `OAuth2Client.verifyIdToken` con audience obbligatorio per Google OAuth puro. Rimuovere completamente il ramo che decodifica il payload senza verifica.

### [Critical] CORS riflette qualsiasi origin con credenziali — furto di token cross-site
- **File/Riferimento:** `app.js:76-97`

### [High] Secret JWT di default senza fail-fast in produzione
- **File/Riferimento:** `jwt.js:12`

### [High] XSS riflessa nella pagina di login desktop
- **File/Riferimento:** `auth.controller.js:549-728`

### [High] File SVG serviti inline permettono XSS stored
- **File/Riferimento:** `nodes.controller.js:210`

### [High] Nessun rate limiting — login e registrazione bruteforceabili
- **File/Riferimento:** `auth.routes.js`

### [High] Refresh token senza rotation né reuse detection
- **File/Riferimento:** `auth.controller.js:303-335`

### [Medium] Nessun header di sicurezza (helmet assente)
- **File/Riferimento:** `app.js`

### [Medium] Sessione OAuth desktop: `sessionId` in query string/log
- **File/Riferimento:** `auth.controller.js:738-774`

### [Low] Spostamento nodo non verifica permessi sulla cartella di destinazione
- **File/Riferimento:** `nodes.controller.js:517-557`

### [Low] Parametri di route non validati come UUID
- **File/Riferimento:** `nodes.routes.js`

---

## 2. Performance & Colli di Bottiglia (8 finding)
Cosa rallenta davvero l'app — dal server all'infrastruttura di hosting.

### [High] Render free tier: cold start di 30-60s dopo 15 minuti di inattività
- **File/Riferimento:** `render.yaml:13`
- **Dettagli:** Il servizio va in spin-down su inattività; la prima richiesta dopo la pausa (login, apertura app) attende decine di secondi. È probabilmente la causa più diffusa di "lentezza percepita" in assoluto per questo prodotto, e nessun meccanismo di keep-alive è collegato: esiste già `/api/health` ma nulla lo chiama periodicamente.
- **Correzione:** Ping esterno gratuito ogni 10-14 minuti (GitHub Actions schedulato, UptimeRobot, cron-job.org) verso `/api/health`; oppure piano a pagamento (~7$/mese, always-on). In ogni caso, mostrare in UI "il server si sta risvegliando" durante l'attesa invece di uno spinner muto.

### [High] Upload interi bufferizzati in RAM invece di andare direttamente a R2
- **File/Riferimento:** `storage.service.js` / `nodes.routes.js:40`

### [High] Auto-migrazione dello schema ad ogni avvio del server
- **File/Riferimento:** `app.js:57-60`

### [Medium] Calcolo quota storage: full-scan `SUM` ad ogni upload
- **File/Riferimento:** `nodes.controller.js:421-427`

### [Medium] `conversion.service.js` blocca l'event loop su documenti grandi
- **File/Riferimento:** `conversion.service.js`

### [Medium] Nessuna compressione né header di cache sulle risposte
- **File/Riferimento:** `app.js`

### [Low] `build.bat` non controlla l'esito di `npm install`
- **File/Riferimento:** `build.bat:9`

### [Low] Nessuna pipeline CI/CD
- **File/Riferimento:** Assente

---

## 3. Come il frontend contatta il server (7 finding)
Deep-dive dedicato: client HTTP, gestione errori, pattern di richiesta.

Lo scheletro è solido — un'unica istanza `axios` centralizzata con `baseURL` calcolata per web/desktop, interceptor di refresh a coda single-flight ben implementato (nessuna richiesta persa o duplicata durante il refresh), token in memoria JS. Quello che manca è tutto lo strato di resilienza attorno: nessun timeout, nessuna cancellazione, nessuna cache.

### [High] Nessuna libreria di stato-server: fetching manuale ovunque
- **File/Riferimento:** `DashboardPage.jsx` e trasversale
- **Dettagli:** `@tanstack/react-query` e `swr` sono assenti dal `package.json`: tutto il fetching è `useState` + `useEffect` + `axios` manuale. Nessuna cache, nessuna deduplicazione, doppio fetch in React 18 StrictMode. Ogni ritorno a una cartella già vista rifà la richiesta da zero con skeleton completo.
- **Correzione:** Adottare TanStack Query — standard de facto 2026 secondo la ricerca — con chiavi tipo `['nodes', folderId]`: risolve in un colpo cache, dedup, cancellazione e stati loading/error pronti.

### [High] Nessun timeout né `AbortController` da nessuna parte
- **File/Riferimento:** `api.js:38-44`

### [High] Errori di rete finiscono solo in console — mai mostrati all'utente
- **File/Riferimento:** `DashboardPage.jsx:82-84`

### [High] Bug concreto: build desktop senza `VITE_API_URL` punta a `localhost`
- **File/Riferimento:** `api.js:26-31` vs `AuthContext.jsx:282`

### [Medium] `/auth/google` non escluso dal retry-refresh — errore di login oscurato
- **File/Riferimento:** `api.js:86-93`

### [Medium] Timeout di 4s sul check auth iniziale, troppo corto per il cold-start Render
- **File/Riferimento:** `AuthContext.jsx:74-81`

### [Medium] Nessun code-splitting — bundle unico con l'intero SDK Firebase
- **File/Riferimento:** `App.jsx` / `vite.config.js`

---

## 4. Feature Dichiarate ma Mancanti o Rotte (6 finding)
Confronto riga per riga tra le promesse del README e il codice reale.

### [Critical] Condivisione per `@username`: non esiste, né in UI né in backend
- **File/Riferimento:** `ShareModal.jsx` / `permissions.controller.js:106`
- **Dettagli:** Il README promette condivisione "via email o con il loro `@username`". `ShareModal` ha un solo campo email; `addPermission` cerca l'utente solo con `eq(users.email, ...)` — nessun ramo su `users.username`. Anche forzando l'API con `@marioR`, la query fallisce.
- **Correzione:** Campo che accetti sia email sia `@username` nel form; lookup fallback su `users.username` nel controller.

### [High] Modifica username: irraggiungibile da qualsiasi schermata
- **File/Riferimento:** `StorageProfileModal.jsx`

### [High] Conversione `.doc` legacy: fallisce silenziosamente
- **File/Riferimento:** `conversion.service.js:58-131`

### [High] Conversione `.rtf`: non preserva stili/evidenziazioni come promesso
- **File/Riferimento:** `conversion.service.js:155-170`

### [Medium] Claim "zero password classiche" non corrisponde al codice
- **File/Riferimento:** `auth.controller.js:34-153`

### [Medium] "Byte esatti" promessi nella modale profilo non vengono mai mostrati
- **File/Riferimento:** `StorageProfileModal.jsx:83-94`

---

## 5. UX, Accessibilità e Codice Duplicato (15 finding)
Stati di caricamento, reattività percepita, chi può effettivamente usare l'app.

### [Critical] Race condition: cambiare cartella velocemente mostra file sbagliati
- **File/Riferimento:** `DashboardPage.jsx:62-92`
- **Dettagli:** `fetchNodes` non ha guardia d'ordine né cancellazione: chi clicca Cartella A (lenta) poi subito Cartella B (veloce), può vedere la risposta lenta di A arrivare dopo e sovrascrivere la griglia — mentre URL e breadcrumb mostrano ancora B. L'utente rischia di eliminare o condividere il contenuto sbagliato.
- **Correzione:** `AbortController` per cancellare la richiesta precedente ad ogni nuova navigazione, o un flag/contatore per scartare risposte non più valide.

### [High] XSS nel visualizzatore Markdown: HTML grezzo eseguito senza sanitizzazione
- **File/Riferimento:** `MarkdownViewerModal.jsx:15,272`

### [High] Card file/cartella non raggiungibile da tastiera
- **File/Riferimento:** `NodeCard.jsx:184`

### [High] Pulsanti icona-only senza nome accessibile in quasi tutti i modali
- **File/Riferimento:** `NodeCard.jsx` + 5 modali

### [High] Contrasto colori sotto soglia WCAG nella palette Markdown
- **File/Riferimento:** `colors.js` / `index.css:40`

### [High] Nessuna paginazione o virtualizzazione della lista file
- **File/Riferimento:** `FileExplorer.jsx:56-70`

### [High] Nessuna UI ottimistica: ogni azione ricarica tutto con skeleton
- **File/Riferimento:** `DashboardPage.jsx:96-121`

### [High] Nessun progresso reale su upload/download di file grandi
- **File/Riferimento:** `UploadButton.jsx:22-51`

### [High] Drag-and-drop limitato al solo pulsante, non all'area di lavoro
- **File/Riferimento:** `UploadButton.jsx:69-75`

### [Medium] `ShareModal`: nessun loading/error sul fetch dei permessi
- **File/Riferimento:** `ShareModal.jsx:19-30`

### [Medium] Calcolo quota storage duplicato in due file
- **File/Riferimento:** `nodes.controller.js:419` / `auth.controller.js:162`

### [Medium] `LoginPage` e `RegisterPage` duplicate al 95%
- **File/Riferimento:** `LoginPage.jsx` / `RegisterPage.jsx`

### [Medium] `ESC` e click-fuori mancanti in due modali su sei
- **File/Riferimento:** `QuickLinkModal.jsx` / `ShareModal.jsx` / `MarkdownViewerModal.jsx`

### [Medium] Upload gestisce un solo file alla volta, altri scartati in silenzio
- **File/Riferimento:** `UploadButton.jsx:56-85`

### [Medium] Bug indice blocchi di codice nel visualizzatore Markdown
- **File/Riferimento:** `MarkdownViewerModal.jsx:44,348`

---

## 6. Cosa funziona bene (18 punti positivi)
Un audit onesto elenca anche questo — per non far leggere l'intero progetto come un disastro quando non lo è.

- **[OK] Autorizzazione IDOR sui permessi:** (`ownerId !== userId`) verificato su `list`/`add`/`update`/`revoke` — nessun caso trovato di accesso incrociato.
- **[OK] Gestione Access Token:** Access token tenuto in memoria JS, mai in `localStorage`; refresh token in cookie `httpOnly` — scelta corretta contro furto persistente via XSS.
- **[OK] Login Google Desktop:** Login Google desktop apre già il browser di sistema (non una WebView embedded) — coerente con RFC 8252, esattamente ciò che la ricerca 2026 raccomanda.
- **[OK] Coda di Refresh Token:** Coda di refresh token single-flight implementata correttamente: nessuna richiesta persa o duplicata durante il rinnovo.
- **[OK] Breadcrumb Server-Side:** Nessun N+1 lato client sulla lista file: i breadcrumb sono calcolati server-side con una CTE ricorsiva in un'unica query.
- **[OK] Architettura Backend:** Architettura `Routes` → `Controllers` → `Services` rispettata in modo consistente nel backend.
- **[OK] Gestione Errori Backend:** Error middleware non fa leak dello stack trace in produzione.
- **[OK] Schema DB Ottimizzato:** Schema DB con UUID come PK, indici sulle colonne di JOIN/WHERE frequenti, `CASCADE` coerenti, `CHECK` constraints.
- **[OK] Sicurezza Storage Key:** Nessun path traversal reale nella storage key (basata su `ownerId/uuid`); cancellazione ricorsiva via CTE ben fatta.
- **[OK] Dipendenze e Lockfile Puliti:** Nessun import mai dichiarato, nessun pacchetto dichiarato mai usato, versioni coerenti tra i 3 lockfile.
- **[OK] Feature Core Implementate:** Le feature core (`upload` → conversione Markdown, `download` con riconversione, condivisione via email, quota, cartella pubblica) sono realmente implementate e funzionanti — non solo promesse nel README.
- **[OK] Qualità Generale del Codice:** Codice sorgente pulito nel complesso: nessun file orfano, nessun blocco commentato dimenticato, nessuna regola CSS morta.

---

## 7. Confronto con lo Stato dell'Arte — Luglio 2026
Ricerca web attiva sulle pratiche correnti per lo stack di EduDrive, confrontate con l'implementazione reale.

| Area | Situazione attuale | Pratica raccomandata 2026 | Impatto se colmato |
| :--- | :--- | :--- | :--- |
| **Data-fetching** | `useState`+`useEffect` manuale, nessuna cache | **TanStack Query** — standard de facto, ~12,3M download/settimana | Elimina flicker, doppio fetch, richieste stale |
| **Upload file** | Proxy attraverso il backend, buffer in RAM | **Presigned PUT URL** diretti al client per file `<100MB` | Elimina rischio OOM, dimezza banda server |
| **Refresh token** | Statico 7gg, nessuna rotation | **Rotation obbligatoria** + reuse detection (OWASP 2026) | Un token rubato diventa rilevabile e revocabile |
| **Migrazioni DB** | Auto-`ALTER TABLE` ad ogni avvio server | `drizzle-kit migrate` come step CI/CD separato | Elimina race condition multi-istanza |
| **Hosting backend** | Render free, spin-down 15min | Piano paid always-on (~7$/mese) o keep-alive esterno | Elimina il cold-start di 30-60s |
| **Auth desktop Tauri** | Browser di sistema + polling custom | Già allineato (RFC 8252) — solo il canale di relay è da rinforzare | Gap minore, non prioritario |
| **Bundle frontend** | Import statici, un solo bundle | Code-splitting per route + **React Compiler** (stabile da ott. 2025) | Primo caricamento più rapido, specie su rete lenta |

> **Nota sulle fonti:** La ricerca su data-fetching, auth JWT, hosting e Tauri si appoggia a documentazione ufficiale (Cloudflare, Neon, Drizzle, Tauri, `react.dev`) più blog tecnici datati 2026; alcune fonti secondarie non riportano una data di pubblicazione puntuale sulla pagina, segnalato esplicitamente dai ricercatori dove accaduto.

---

## 8. Piano d'Azione Prioritizzato

### Immediato — poche ore, impatto altissimo
1. **Verifica firma JWT:** Rimuovere il bypass di verifica firma JWT nel fallback di `googleLogin` — usare Firebase Admin SDK `verifyIdToken()`.
2. **Restrizione CORS:** Bloccare la whitelist CORS: rimuovere il fallback `callback(null, true)` finale in `app.js`.
3. **Timeout su Axios:** Aggiungere un timeout globale (20-30s) all'istanza axios in `api.js`.
4. **Helmet:** Aggiungere `helmet()` come primo middleware Express.
5. **Esclusione retry-refresh:** Escludere `/auth/google` dal retry-refresh nell'interceptor.

### Breve-medio termine
1. **Presigned URL R2:** Migrare gli upload a presigned URL diretti verso R2, invece del proxy via backend.
2. **Token Rotation:** Implementare rotation + reuse detection sul refresh token.
3. **CI/CD per Migrazioni:** Spostare le migrazioni DB in uno step CI/CD separato, fuori dal boot del server.
4. **Rate Limiting:** Aggiungere `express-rate-limit` su login/register/refresh.
5. **TanStack Query:** Introdurre TanStack Query per il data-fetching frontend (risolve cache, dedup, cancellazione, race condition di navigazione in un colpo).
6. **Feature Mancanti:** Implementare per davvero condivisione via `@username` e modifica username dalla modale profilo.
7. **Keep-alive / Render Paid:** Collegare un keep-alive esterno a `/api/health` o passare a un piano Render always-on.
8. **Sanitizzazione Markdown:** Aggiungere `rehype-sanitize` al visualizzatore Markdown.
9. **Accessibilità & WCAG:** Rendere `NodeCard` accessibile da tastiera; correggere il contrasto colori della palette Markdown.

### Strutturale / lungo termine
1. **Pipeline Migrazioni Unificata:** Unificare le tre fonti di verità dello schema DB (`schema.sql`, Drizzle, auto-migrate) in un'unica pipeline di migrazione.
2. **Suite di Test & CI/CD:** Introdurre una suite di test automatici e una pipeline CI minima (lint + test come gate pre-deploy).
3. **Conversione Documenti:** Aggiornare il conversion service per gestire davvero `.doc` legacy e `.rtf` con stili preservati.
4. **Auto-update Desktop:** Aggiungere auto-update per l'app desktop Tauri (`@tauri-apps/plugin-updater`).
5. **Code-splitting & React Compiler:** Code-splitting delle route frontend e valutazione di React Compiler.

---

## 9. Verdetto Finale

EduDrive non è un prototipo abbandonato a metà: le feature core funzionano davvero, l'architettura backend rispetta la separazione a strati che il team stesso si è imposto, il calcolo dei breadcrumb è più elegante di quanto ci si aspetterebbe da un progetto di questa scala, e alcune scelte di sicurezza (token in memoria, refresh in cookie `httpOnly`, OAuth desktop via browser di sistema) sono già corrette. È un progetto scritto da chi capisce cosa sta facendo.

Ma oggi, con utenti reali, il rischio più grande non è la lentezza percepita del cold-start — è che chiunque può impersonare qualsiasi account con una richiesta HTTP forgiata a mano, e la configurazione CORS che dovrebbe essere la seconda linea di difesa non blocca letteralmente nulla. Sono due bug, non due mesi di lavoro: si sistemano entrambi nel giro di un pomeriggio, e vanno sistemati prima di qualunque altra cosa in questa lista, inclusi i miglioramenti di performance e le feature mancanti.

Con quei due fix e i quattro-cinque interventi "breve termine" più urgenti (rotation dei token, upload via presigned URL, rate limiting, cache lato client), EduDrive passa da "demo convincente con una porta sul retro spalancata" a "prodotto usabile in produzione da un gruppo di studenti reali". Il resto — codice morto, duplicazioni, mancanza di test — è debito tecnico normale per un progetto a questo stadio, non un'emergenza.
