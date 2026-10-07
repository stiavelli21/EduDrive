package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"EduDrive/ai"
	"EduDrive/converter"
	"EduDrive/models"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Wails event names for study handout generation and streaming
const (
	eventHandoutProgress = "handout:progress"
	eventHandoutChunk    = "handout:chunk"
)

// emitHandoutProgress dispatches a progress update to the frontend UI
func (a *App) emitHandoutProgress(stage string, percent int, message string, errStr string) {
	if a.ctx == nil {
		return
	}
	evt := models.StudyHandoutProgressEvent{
		Stage:   stage,
		Percent: percent,
		Message: message,
		Error:   errStr,
	}
	wailsRuntime.EventsEmit(a.ctx, eventHandoutProgress, evt)
}

// emitHandoutChunk sends a streaming piece of generated text to the frontend
func (a *App) emitHandoutChunk(reqID string, chunk string) {
	if a.ctx == nil {
		return
	}
	wailsRuntime.EventsEmit(a.ctx, eventHandoutChunk, map[string]string{
		"requestId": reqID,
		"chunk":     chunk,
	})
}

// GenerateStudyHandout orchestrates multi-document reading and comprehensive study guide synthesis via Gemini
func (a *App) GenerateStudyHandout(req models.StudyHandoutGenerateRequest) (*models.StudyHandout, error) {
	if len(req.ItemIDs) == 0 {
		return nil, fmt.Errorf("seleziona almeno un documento o slide per creare la dispensa")
	}

	apiKey, err := a.database.GetSetting(settingAIAPIKey)
	if err != nil || strings.TrimSpace(apiKey) == "" {
		return nil, fmt.Errorf("per generare una dispensa con l'IA devi prima configurare la tua API key di Google Gemini nelle impostazioni IA")
	}

	model, _ := a.database.GetSetting(settingAIModel)
	if strings.TrimSpace(model) == "" {
		model = ai.DefaultModel
	}

	reqID := uuid.New().String()
	a.emitHandoutProgress("sources", 10, "Caricamento ed elaborazione delle slide e dei documenti...", "")

	// 1. Gather all source documents and slides
	var promptParts []ai.Part
	var sourceItemNames []string

	for _, itemID := range req.ItemIDs {
		item, err := a.database.GetItemByID(itemID)
		if err != nil || item == nil {
			continue
		}
		sourceItemNames = append(sourceItemNames, item.Name)

		ext := strings.ToLower(filepath.Ext(item.Name))

		// Check for multimodal types supported directly by Gemini (PDF and images)
		if ext == ".pdf" || item.MimeType == "application/pdf" {
			data, err := a.storage.ReadBinaryContent(item.StoragePath)
			if err == nil && len(data) > 0 && len(data) <= ai.MaxInlineBytes {
				promptParts = append(promptParts,
					ai.Part{Text: fmt.Sprintf("\n--- DOCUMENTO / SLIDE PDF: %s ---\n", item.Name)},
					ai.Part{
						InlineData: &ai.InlineData{
							MimeType: "application/pdf",
							Data:     base64.StdEncoding.EncodeToString(data),
						},
					},
				)
				continue
			}
		}

		if mime, ok := imageMimeByExt[ext]; ok {
			data, err := a.storage.ReadBinaryContent(item.StoragePath)
			if err == nil && len(data) > 0 && len(data) <= ai.MaxInlineBytes {
				promptParts = append(promptParts,
					ai.Part{Text: fmt.Sprintf("\n--- IMMAGINE / SLIDE GRAFICA: %s ---\n", item.Name)},
					ai.Part{
						InlineData: &ai.InlineData{
							MimeType: mime,
							Data:     base64.StdEncoding.EncodeToString(data),
						},
					},
				)
				continue
			}
		}

		// Textual documents (Markdown, TXT, Word docx)
		var textContent string
		switch ext {
		case ".md", ".markdown", ".txt":
			textContent, _ = a.storage.ReadTextContent(item.StoragePath)
		case ".docx", ".doc":
			fullPath := a.storage.GetFullPath(item.StoragePath)
			if fullPath != "" {
				textContent, _ = converter.ConvertDocument(fullPath)
			}
		default:
			textContent, _ = a.storage.ReadTextContent(item.StoragePath)
		}

		if strings.TrimSpace(textContent) != "" {
			if len(textContent) > 150_000 {
				textContent = textContent[:150_000] + "\n\n[...testo del documento troncato per limiti di contesto...]"
			}
			promptParts = append(promptParts, ai.Part{
				Text: fmt.Sprintf("\n--- DOCUMENTO / APPUNTI: %s ---\n%s\n", item.Name, textContent),
			})
		}
	}

	if len(promptParts) == 0 {
		a.emitHandoutProgress("error", 0, "", "Impossibile leggere il contenuto dei documenti selezionati")
		return nil, fmt.Errorf("nessun contenuto valido o supportato trovato nei documenti selezionati")
	}

	a.emitHandoutProgress("structuring", 35, "Organizzazione della struttura logica e didattica...", "")

	// 2. Select system prompt and mode directives
	systemPrompt, modeDirectives := buildHandoutPrompts(req.Mode, req.DetailLevel)

	userPromptBuilder := strings.Builder{}
	userPromptBuilder.WriteString(fmt.Sprintf("# OBIETTIVO: Generare una dispensa accademica completa partendo dai file forniti.\n"))
	if strings.TrimSpace(req.Title) != "" {
		userPromptBuilder.WriteString(fmt.Sprintf("- Titolo richiesto: %s\n", strings.TrimSpace(req.Title)))
	}
	if strings.TrimSpace(req.Topic) != "" {
		userPromptBuilder.WriteString(fmt.Sprintf("- Focus tematico / Argomento principale: %s\n", strings.TrimSpace(req.Topic)))
	}
	userPromptBuilder.WriteString(fmt.Sprintf("- Modalità didattica: %s\n", req.Mode))
	userPromptBuilder.WriteString(fmt.Sprintf("- Livello di dettaglio: %s\n", req.DetailLevel))

	if strings.TrimSpace(req.CustomInstructions) != "" {
		userPromptBuilder.WriteString(fmt.Sprintf("\nISTRUZIONI SPECIALI DELLO STUDENTE:\n\"\"\"\n%s\n\"\"\"\nTieni in massima considerazione queste richieste durante la stesura!\n", strings.TrimSpace(req.CustomInstructions)))
	}

	userPromptBuilder.WriteString(fmt.Sprintf("\n%s\n", modeDirectives))
	userPromptBuilder.WriteString("\nDi seguito sono allegati tutti i materiali, le slide e gli appunti di partenza:\n")

	// Assemble contents
	allUserParts := append([]ai.Part{{Text: userPromptBuilder.String()}}, promptParts...)
	allUserParts = append(allUserParts, ai.Part{
		Text: "\n\nGenera ora la dispensa completa in formato Markdown, rigorosa, chiara e pronta per lo studio universitario:",
	})

	contents := []ai.Content{
		{
			Role:  "user",
			Parts: allUserParts,
		},
	}

	// 3. Stream generation from Gemini
	a.emitHandoutProgress("generating", 50, "Redazione del testo in corso con sintesi e ragionamento...", "")

	client, err := a.newAIClient(apiKey)
	if err != nil {
		a.emitHandoutProgress("error", 0, "", err.Error())
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 7*time.Minute)
	defer cancel()

	var fullMarkdownBuilder strings.Builder
	chunkCount := 0

	err = client.StreamGenerate(ctx, systemPrompt, contents, func(chunk string) {
		fullMarkdownBuilder.WriteString(chunk)
		chunkCount++
		// Emit streaming chunks to UI
		a.emitHandoutChunk(reqID, chunk)
	})

	if err != nil {
		a.emitHandoutProgress("error", 0, "", "Errore durante la generazione della dispensa: "+err.Error())
		return nil, fmt.Errorf("generazione interrotta: %w", err)
	}

	finalMarkdown := strings.TrimSpace(fullMarkdownBuilder.String())
	if finalMarkdown == "" {
		a.emitHandoutProgress("error", 0, "", "La risposta generata dal modello era vuota")
		return nil, fmt.Errorf("nessun contenuto generato dal modello")
	}

	// Determine final title
	displayTitle := strings.TrimSpace(req.Title)
	if displayTitle == "" {
		if strings.TrimSpace(req.Topic) != "" {
			displayTitle = req.Topic
		} else if len(sourceItemNames) > 0 {
			displayTitle = "Dispensa - " + strings.TrimSuffix(sourceItemNames[0], filepath.Ext(sourceItemNames[0]))
		} else {
			displayTitle = "Dispensa Universitaria Integrata"
		}
	}

	a.emitHandoutProgress("saving", 85, "Salvataggio della dispensa nel database...", "")

	// 4. Create and persist StudyHandout model
	handoutID := uuid.New().String()
	handout := &models.StudyHandout{
		ID:              handoutID,
		Title:           displayTitle,
		Topic:           req.Topic,
		Mode:            req.Mode,
		DetailLevel:     req.DetailLevel,
		SourceItemIDs:   req.ItemIDs,
		SourceItemNames: sourceItemNames,
		ContentMarkdown: finalMarkdown,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// 5. Optionally save as physical Markdown file in Drive
	if req.SaveToDrive {
		a.emitHandoutProgress("saving", 92, "Creazione file Markdown nel tuo Drive...", "")
		mdFileName := sanitizeFileName(displayTitle) + ".md"
		createdDriveItem, err := a.CreateMarkdownFile(mdFileName, finalMarkdown, req.TargetFolderID)
		if err == nil && createdDriveItem != nil {
			handout.DriveItemID = &createdDriveItem.ID
		}
	}

	if err := a.database.InsertStudyHandout(handout); err != nil {
		a.emitHandoutProgress("error", 0, "", "Errore salvataggio nel database: "+err.Error())
		return nil, fmt.Errorf("failed to save handout: %w", err)
	}

	a.emitHandoutProgress("complete", 100, "Dispensa completata con successo!", "")
	return handout, nil
}

// buildHandoutPrompts configures the persona and instructions based on the requested didactic mode
func buildHandoutPrompts(mode, detailLevel string) (string, string) {
	systemPrompt := `Sei un professore universitario di straordinaria chiarezza espositiva, autore di manuali accademici di riferimento e tutor didattico di livello mondiale per studenti universitari.
Il tuo compito è analizzare insiemi eterogenei di materiali universitari (slide frammentate, elenchi puntati, note, dispense, diagrammi) e rielaborarli in un testo organico, logico, rigoroso e pedagogicamente perfetto.

REGOLE ESSENZIALI:
1. Lingua: Rispondi ESCLUSIVAMENTE in italiano accademico, chiaro, elegante e impeccabile.
2. Continuità e Discorso Logico: I materiali universitari (soprattutto le slide) sono pieni di elenchi puntati isolati e concetti telegrafici. NON copiare pedissequamente gli elenchi: devi RICOSTRUIRE IL FILO DEL DISCORSO, collegando causa ed effetto, spiegando le motivazioni teoriche e pratiche e guidando lo studente passo dopo passo.
3. Formule Matematiche: Tutte le formule devono essere scritte in formato LaTeX standard: $...$ per formule in linea e $$...$$ per equazioni a blocco. Spiega sempre il significato di ciascuna variabile e il senso intuitivo dell'equazione.
4. Formattazione Markdown Premium:
   - Usa titoli chiari (# Titolo Principale, ## Capitoli/Sezioni, ### Sottosezioni).
   - Usa grassetti per evidenziare i concetti cardine e i termini tecnici.
   - Usa blocchi citazione informativi per evidenziare concetti chiave (> [!NOTE] o > [!TIP] o > [!WARNING]).
   - Usa tabelle comparative Markdown quando serve mettere a confronto due o più algoritmi, teorie o concetti.
5. Rigore e Zero Allucinazioni: Basati strettamente sulle nozioni contenute nei materiali, integrandole e chiarendole senza inventare concetti incongruenti.`

	var directives strings.Builder

	switch mode {
	case "didactic_simplification":
		directives.WriteString(`MODALITÀ: SEMPLIFICAZIONE DIDATTICA (Metodo Feynman)
- Obiettivo Primario: Spiegare i concetti più difficili, astratti o nozionistici con la massima chiarezza e accessibilità, senza mai perdere di rigore scientifico.
- Usa analogie efficaci e metafore della vita reale per rendere intuitivi i meccanismi complessi.
- Scomponi ogni procedura o teorema in passaggi sequenziali elementari ("Passo 1", "Passo 2").
- Chiarisci i termini tecnici complessi prima di usarli formalmente.
- Includi una sezione "Errori Comuni di Comprensione" per fugare i dubbi tipici che confondono gli studenti.`)

	case "technical_deep_dive":
		directives.WriteString(`MODALITÀ: APPROFONDIMENTO TECNICO, FORMULE ED ESEMPI
- Obiettivo Primario: Colmare tutti i salti logici tipici delle slide universitarie, dove i passaggi algebrici o implementativi vengono omessi per brevità.
- Mostra tutte le derivazioni matematiche complete passaggio per passaggio in KaTeX, spiegando i passaggi intermedi.
- Se il tema è informatico o ingegneristico, fornisci esempi concreti di codice commentato o pseudocodice chiaro.
- Includi dettagli implementativi, complessità computazionale, trade-off prestazionali e casi d'uso concreti del mondo reale.`)

	case "exam_prep":
		directives.WriteString(`MODALITÀ: SCHEMI STRUTTURATI E PREPARAZIONE ESAME
- Obiettivo Primario: Ottimizzare la preparazione per superare l'esame con il massimo dei voti (30 e Lode).
- Crea una "Mappa Concettuale Ragionata" con i collegamenti chiave tra tutti gli argomenti affrontati nei file.
- Formula una lista di 6-10 "Domande d'Esame Tipiche" (sia teoriche che pratiche/applicative) che un docente esigente potrebbe porre all'orale o nello scritto.
- Per ogni domanda d'esame, fornisci la "Risposta Modello Perfetta", strutturata e argomentata.
- Concludi con la sezione "I Trabocchetti dell'Esame": le sottigliezze e i dettagli critici su cui i docenti mettono alla prova gli studenti.`)

	default: // "reasoned_handout"
		directives.WriteString(`MODALITÀ: DISPENSA COMPLETA RAGIONATA (Trattazione Integrata dei Materiali)
- Obiettivo Primario: Fondere le slide e i documenti in un vero e proprio capitolo di manuale universitario, discorsivo, completo e perfettamente sequenziale.
- Collega ogni slide alla successiva attraverso un filo logico coerente, eliminando la frammentarietà.
- Struttura la dispensa in:
  1. Introduzione e Motivazione (a cosa serve questo argomento e da cosa nasce).
  2. Fondamenti Teorici e Definizioni Formali.
  3. Sviluppo Logico e Analisi dei Casi.
  4. Esempi Pratici ed Esercizi Guidati.
  5. Sintesi di Fine Capitolo e Punti Cardine da Ricordare.`)
	}

	switch detailLevel {
	case "concise":
		directives.WriteString("\n- AMPIEZZA: Sintetica e concentrata sui soli concetti irrinunciabili (circa 800-1200 parole).")
	case "exhaustive":
		directives.WriteString("\n- AMPIEZZA: Esaustiva, estremamente approfondita e completa in ogni sfumatura didattica (trattazione estesa e dettagliata).")
	default:
		directives.WriteString("\n- AMPIEZZA: Trattazione equilibrata, con spiegazioni chiare per ogni punto chiave ma senza prolissità superflue.")
	}

	return systemPrompt, directives.String()
}

// ListStudyHandouts returns all saved study handouts
func (a *App) ListStudyHandouts() ([]models.StudyHandout, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.database.GetStudyHandouts()
}

// GetStudyHandout returns a specific study handout by its ID
func (a *App) GetStudyHandout(id string) (*models.StudyHandout, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.database.GetStudyHandoutByID(id)
}

// UpdateStudyHandout updates the title and markdown content of an existing study handout
func (a *App) UpdateStudyHandout(id string, title string, markdown string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}

	handout, err := a.database.GetStudyHandoutByID(id)
	if err != nil || handout == nil {
		return fmt.Errorf("dispensa non trovata")
	}

	handout.Title = strings.TrimSpace(title)
	handout.ContentMarkdown = markdown
	handout.UpdatedAt = time.Now()

	return a.database.UpdateStudyHandout(handout)
}

// DeleteStudyHandout deletes a study handout from the library
func (a *App) DeleteStudyHandout(id string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.database.DeleteStudyHandout(id)
}

// SaveStudyHandoutToDrive exports or updates a study handout directly into the user's EduDrive files
func (a *App) SaveStudyHandoutToDrive(handoutID string, folderID string) (*models.Item, error) {
	handout, err := a.database.GetStudyHandoutByID(handoutID)
	if err != nil || handout == nil {
		return nil, fmt.Errorf("dispensa non trovata")
	}

	fileName := sanitizeFileName(handout.Title) + ".md"

	// If it was already saved as a drive item, update that item's content
	if handout.DriveItemID != nil && *handout.DriveItemID != "" {
		existingItem, err := a.database.GetItemByID(*handout.DriveItemID)
		if err == nil && existingItem != nil && !existingItem.IsTrash {
			err = a.SaveMarkdownFile(existingItem.ID, handout.ContentMarkdown)
			if err == nil {
				return existingItem, nil
			}
		}
	}

	// Otherwise, create a new Markdown file in the requested folder (or root)
	item, err := a.CreateMarkdownFile(fileName, handout.ContentMarkdown, folderID)
	if err != nil {
		return nil, fmt.Errorf("impossibile salvare il file nel Drive: %w", err)
	}

	// Update reference
	handout.DriveItemID = &item.ID
	handout.UpdatedAt = time.Now()
	_ = a.database.UpdateStudyHandout(handout)

	return item, nil
}

// ExportStudyHandoutMarkdown prompts the user to save the markdown study guide to their local file system
func (a *App) ExportStudyHandoutMarkdown(handoutID string) error {
	handout, err := a.database.GetStudyHandoutByID(handoutID)
	if err != nil || handout == nil {
		return fmt.Errorf("dispensa non trovata")
	}

	defaultName := sanitizeFileName(handout.Title) + ".md"
	dest, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Esporta Dispensa in formato Markdown",
		DefaultFilename: defaultName,
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "File Markdown (*.md)", Pattern: "*.md"},
			{DisplayName: "File di Testo (*.txt)", Pattern: "*.txt"},
		},
	})
	if err != nil {
		return err
	}
	if dest == "" {
		return nil // User cancelled
	}

	return os.WriteFile(dest, []byte(handout.ContentMarkdown), 0644)
}

// sanitizeFileName cleans up a string to be used safely as a filename
func sanitizeFileName(name string) string {
	invalidChars := `/\:*?"<>|`
	res := name
	for _, c := range invalidChars {
		res = strings.ReplaceAll(res, string(c), " ")
	}
	res = strings.Join(strings.Fields(res), " ")
	if res == "" {
		res = "Dispensa_Studio"
	}
	return res
}
