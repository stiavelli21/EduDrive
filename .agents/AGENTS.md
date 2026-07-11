# Regole di Progetto per gli Assistenti AI (EduDrive)

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
   - In ogni aggiornamento, è fondamentale **mantenere il suo stile sintetico e chiaro**, evitando verbosità ed eccessivi dettagli tecnici.
