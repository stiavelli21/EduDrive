# Idee e Plugin per EduDrive

> **Vuoi contribuire a EduDrive?** Scegli un'idea da questa lista (o proponi la tua) e crea il tuo primo plugin didattico per arricchire la piattaforma!

---

## 1. Studio e Didattica (AI & Gamification)

### Sistema di Flashcard Interattive
- **Obiettivo**: Generare mazzi di flashcard a partire dai documenti salvati nel drive.
- **Funzionalità chiave**: Supporto alla ripetizione spaziata (stile Anki), autovalutazione rapida e condivisione dei mazzi tra compagni di corso.
- **Come iniziare**: Crea un modello Drizzle per i mazzi e le carte, e un endpoint REST per generare o salvare le flashcard da file TXT/PDF.

### Sintetizzatore AI & Riassunti
- **Obiettivo**: Generazione automatica di riassunti, mappe concettuali e quiz di autovalutazione dai documenti caricati.
- **Funzionalità chiave**: Estrazione concetti chiave dai PDF e generazione automatica di domande di ripasso prima di un esame.
- **Come iniziare**: Collega API LLM esterne (o modelli locali via Ollama) al backend quando viene caricato un nuovo file.

### Valutazione e Recensione Appunti
- **Obiettivo**: Valutare la qualità dei materiali condivisi all'interno dei gruppi di studio.
- **Funzionalità chiave**: Sistema di voto da 1 a 5 stelle, commenti per segnalare parti mancanti o utili, e ordinamento dei file per voto della community.
- **Come iniziare**: Aggiungi una tabella `reviews` collegata ai `nodes` nel database PostgreSQL.

---

## 2. Collaborazione in Tempo Reale

### Chat di Gruppo per Cartella
- **Obiettivo**: Discutere in tempo reale direttamente all'interno delle cartelle di studio condivise.
- **Funzionalità chiave**: Stanze di discussione dedicate per ogni cartella, notifiche istantanee e invio rapido di link diretti ai file archiviati.
- **Come iniziare**: Integra WebSocket o Socket.io in `backend/src/server.js` con stanze basate sul `folderId`.

### Dashboard e Statistiche di Studio
- **Obiettivo**: Monitorare il tempo dedicato allo studio sui file di un determinato corso o progetto.
- **Funzionalità chiave**: Timer Pomodoro integrato, statistiche settimanali di lettura documenti e tracciamento dei progressi per esame.
- **Come iniziare**: Salva sessioni di tempo associate ai nodi e visualizzale con grafici nel frontend.

---

## Come Proporre e Sviluppare una Nuova Idea

1. **Scegli o Proponi**: Aggiungi una nuova idea a questo file o scegline una esistente.
2. **Crea il Backend**: Segui le istruzioni nel [README.md](./README.md#%EF%B8%8F-sviluppa-il-tuo-primo-plugin) per creare rotta e controller nel backend.
3. **Collega il Frontend**: Aggiungi il nuovo componente o pulsante nella UI di React per rendere la tua idea realtà!
