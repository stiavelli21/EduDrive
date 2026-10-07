package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"EduDrive/ai"
	"EduDrive/converter"
	"EduDrive/models"
	"EduDrive/tts"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Wails event name for podcast generation progress
const eventPodcastProgress = "podcast:progress"

// emitPodcastProgress dispatches a progress update to the frontend UI
func (a *App) emitPodcastProgress(stage string, percent int, message string, currentTurn int, totalTurns int, errStr string) {
	if a.ctx == nil {
		return
	}
	evt := models.PodcastProgressEvent{
		Stage:       stage,
		Percent:     percent,
		Message:     message,
		CurrentTurn: currentTurn,
		TotalTurns:  totalTurns,
		Error:       errStr,
	}
	wailsRuntime.EventsEmit(a.ctx, eventPodcastProgress, evt)
}

// GeneratePodcast orchestrates script generation via Gemini and neural TTS synthesis via Edge-TTS
func (a *App) GeneratePodcast(req models.PodcastGenerateRequest) (*models.PodcastEpisode, error) {
	if len(req.ItemIDs) == 0 {
		return nil, fmt.Errorf("seleziona almeno un documento per creare il podcast")
	}

	apiKey, err := a.database.GetSetting(settingAIAPIKey)
	if err != nil || apiKey == "" {
		return nil, fmt.Errorf("per generare un podcast con l'IA devi prima configurare la tua API key di Google Gemini nelle impostazioni IA")
	}

	model, _ := a.database.GetSetting(settingAIModel)
	if model == "" {
		model = ai.DefaultModel
	}

	a.emitPodcastProgress("sources", 10, "Lettura dei documenti selezionati in corso...", 0, 0, "")

	// 1. Collect and parse content from selected source documents
	var sourceTexts []string
	var sourceNames []string

	for _, itemID := range req.ItemIDs {
		item, err := a.database.GetItemByID(itemID)
		if err != nil || item == nil {
			continue
		}
		sourceNames = append(sourceNames, item.Name)

		ext := strings.ToLower(filepath.Ext(item.Name))
		var docContent string

		switch ext {
		case ".md", ".markdown", ".txt":
			docContent, _ = a.storage.ReadTextContent(item.StoragePath)
		case ".docx", ".doc", ".pdf":
			fullPath := a.storage.GetFullPath(item.StoragePath)
			if fullPath != "" {
				docContent, _ = converter.ConvertDocument(fullPath)
			}
		default:
			// Fallback: try reading as text
			docContent, _ = a.storage.ReadTextContent(item.StoragePath)
		}

		if strings.TrimSpace(docContent) != "" {
			// Limit each source document to a reasonable size for the script writer
			if len(docContent) > 100_000 {
				docContent = docContent[:100_000] + "\n\n[...testo del documento troncato per lunghezza...]"
			}
			sourceTexts = append(sourceTexts, fmt.Sprintf("=== DOCUMENTO: %s ===\n%s", item.Name, docContent))
		}
	}

	if len(sourceTexts) == 0 {
		return nil, fmt.Errorf("impossibile estrarre contenuto di testo valido dai documenti selezionati")
	}

	a.emitPodcastProgress("script", 25, "Generazione della sceneggiatura con Marco ed Elena in corso...", 0, 0, "")

	// 2. Build script prompt for Gemini
	lengthInstruction := "Crea una puntata completa di circa 12-16 battute complessive tra i due conduttori."
	if req.Length == "short" {
		lengthInstruction = "Crea una puntata sintetica e dinamica di circa 6-8 battute complessive tra i due conduttori."
	} else if req.Length == "deep" {
		lengthInstruction = "Crea una puntata approfondita e ricca di dettagli di circa 18-22 battute complessive tra i due conduttori."
	}

	toneInstruction := "Tono amichevole, divulgativo e stimolante, accessibile ma rigoroso sui concetti chiave."
	if req.Tone == "academic" {
		toneInstruction = "Tono accademico avanzato, con rigore universitario, focus su definizioni, formule e domande d'esame tipiche."
	}

	customQuestionsBlock := ""
	if strings.TrimSpace(req.CustomQuestions) != "" {
		customQuestionsBlock = fmt.Sprintf(
			"\n\nDOMANDE SPECIFICHE E TOPIC DI FOCUS RICHIESTI DALL'UTENTE:\n\"\"\"\n%s\n\"\"\"\nI conduttori DEVONO assolutamente discutere e rispondere chiaramente a queste domande durante la puntata!\n",
			strings.TrimSpace(req.CustomQuestions),
		)
	}

	systemPrompt := `Sei un autore esperto di podcast scientifici e universitari in stile NotebookLM (Audio Overview).
Il tuo compito è scrivere una sceneggiatura per un podcast formativo e brillante tra due conduttori:
- Marco: curioso, entusiasta, bravissimo a fare analogie col mondo reale, a porre dubbi comuni agli studenti e a sintetizzare i punti cardine.
- Elena: analitica, brillante, precisa, approfondisce i concetti chiave, anticipa i dettagli e le possibili domande di un esame universitario.

Regole essenziali:
1. I conduttori parlano in italiano fluido e naturale (usa espressioni come "Esatto!", "Aspetta, fammi capire bene...", "C'è un dettaglio fondamentale qui", "In vista dell'esame questo è il punto focale!").
2. Il ritmo deve essere vivace, un vero dialogo a due con domande, riflessioni, risposte e spiegazioni chiare.
3. Rispondi ESCLUSIVAMENTE con un array JSON di oggetti battuta, senza alcun testo introduttivo o conclusivo e senza blocchi di codice markdown.
Formato richiesto:
[
  {"speaker": "Marco", "text": "Bentornati al nostro studio podcast di EduDrive! Oggi abbiamo sotto mano un tema davvero affascinante..."},
  {"speaker": "Elena", "text": "Esatto Marco! Si tratta proprio di..."}
]
Nota: all'interno del campo "text", usa solo testo pronunciabile chiaramente (niente simboli matematici grezzi o elenchi Markdown).`

	userPrompt := fmt.Sprintf(
		"Ecco i documenti di studio su cui basare il podcast:\n\n%s\n%s\n\nIstruzioni aggiuntive:\n- %s\n- %s\n\nGenera ora la sceneggiatura JSON:",
		strings.Join(sourceTexts, "\n\n"),
		customQuestionsBlock,
		lengthInstruction,
		toneInstruction,
	)

	// Call Gemini
	aiClient := ai.NewClient(apiKey, model)
	if a.aiBaseURL != "" {
		aiClient.BaseURL = a.aiBaseURL
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	var scriptBuilder strings.Builder
	streamErr := aiClient.StreamGenerate(
		ctx,
		systemPrompt,
		[]ai.Content{
			{Role: "user", Parts: []ai.Part{{Text: userPrompt}}},
		},
		func(chunk string) {
			scriptBuilder.WriteString(chunk)
		},
	)
	if streamErr != nil {
		a.emitPodcastProgress("error", 0, "", 0, 0, streamErr.Error())
		return nil, fmt.Errorf("errore durante la scrittura del podcast con Gemini: %w", streamErr)
	}

	// 3. Parse JSON script
	rawScript := strings.TrimSpace(scriptBuilder.String())
	rawScript = strings.TrimPrefix(rawScript, "```json")
	rawScript = strings.TrimPrefix(rawScript, "```")
	rawScript = strings.TrimSuffix(rawScript, "```")
	rawScript = strings.TrimSpace(rawScript)

	var turns []models.PodcastTurn
	if err := json.Unmarshal([]byte(rawScript), &turns); err != nil {
		// Attempt to extract JSON substring if extra text was included
		startIdx := strings.Index(rawScript, "[")
		endIdx := strings.LastIndex(rawScript, "]")
		if startIdx >= 0 && endIdx > startIdx {
			_ = json.Unmarshal([]byte(rawScript[startIdx:endIdx+1]), &turns)
		}
	}

	if len(turns) == 0 {
		return nil, fmt.Errorf("l'IA non ha restituito una sceneggiatura valida per il podcast")
	}

	// Normalize speaker names to "Marco" or "Elena"
	for i := range turns {
		speakerLower := strings.ToLower(turns[i].Speaker)
		if strings.Contains(speakerLower, "elena") {
			turns[i].Speaker = "Elena"
		} else {
			turns[i].Speaker = "Marco"
		}
	}

	// 4. Synthesize speech for each dialogue turn using Edge-TTS
	totalTurns := len(turns)
	a.emitPodcastProgress("synthesis", 40, fmt.Sprintf("Inizio sintesi vocale neurale (0/%d battute)...", totalTurns), 0, totalTurns, "")

	synthesizer := tts.NewSynthesizer()
	var fullAudioBuffer []byte
	var currentAudioOffset float64 = 0.0

	for i, turn := range turns {
		turnNum := i + 1
		percent := 40 + int((float64(turnNum)/float64(totalTurns))*50)
		a.emitPodcastProgress("synthesis", percent, fmt.Sprintf("Sintesi vocale in corso (%d/%d: %s)...", turnNum, totalTurns, turn.Speaker), turnNum, totalTurns, "")

		voice := "it-IT-DiegoNeural"
		if turn.Speaker == "Elena" {
			voice = "it-IT-ElsaNeural"
		}

		audioChunk, err := synthesizer.Synthesize(turn.Text, voice)
		if err != nil {
			// Retry once with other voice if single turn fails
			time.Sleep(500 * time.Millisecond)
			audioChunk, err = synthesizer.Synthesize(turn.Text, voice)
			if err != nil {
				a.emitPodcastProgress("error", 0, "", turnNum, totalTurns, err.Error())
				return nil, fmt.Errorf("errore durante la sintesi vocale della battuta %d: %w", turnNum, err)
			}
		}

		// Calculate turn duration based on 48 kbps CBR MP3 (6,000 bytes per second)
		turnDuration := float64(len(audioChunk)) / 6000.0
		turns[i].StartTime = currentAudioOffset
		turns[i].EndTime = currentAudioOffset + turnDuration
		currentAudioOffset += turnDuration

		fullAudioBuffer = append(fullAudioBuffer, audioChunk...)
	}

	a.emitPodcastProgress("saving", 95, "Salvataggio episodio nella memoria di EduDrive...", totalTurns, totalTurns, "")

	// 5. Save concatenated MP3 audio in storage
	audioFilename, err := a.storage.SaveBinaryContent(".mp3", fullAudioBuffer)
	if err != nil {
		return nil, fmt.Errorf("failed to save podcast audio: %w", err)
	}

	// 6. Build podcast title
	podcastTitle := "Podcast di Studio"
	if len(sourceNames) > 0 {
		baseName := strings.TrimSuffix(sourceNames[0], filepath.Ext(sourceNames[0]))
		if len(sourceNames) == 1 {
			podcastTitle = fmt.Sprintf("Podcast: %s", baseName)
		} else {
			podcastTitle = fmt.Sprintf("Podcast: %s (+%d fonti)", baseName, len(sourceNames)-1)
		}
	}

	episode := &models.PodcastEpisode{
		ID:              uuid.New().String(),
		Title:           podcastTitle,
		Topic:           strings.TrimSpace(req.CustomQuestions),
		Tone:            req.Tone,
		SourceItemIDs:   req.ItemIDs,
		SourceItemNames: sourceNames,
		Turns:           turns,
		AudioPath:       audioFilename,
		DurationSeconds: currentAudioOffset,
		CreatedAt:       time.Now(),
	}

	if err := a.database.InsertPodcast(episode); err != nil {
		return nil, fmt.Errorf("failed to save podcast to database: %w", err)
	}

	a.emitPodcastProgress("complete", 100, "Podcast generato con successo!", totalTurns, totalTurns, "")
	return episode, nil
}

// ListPodcasts returns all previously generated podcast episodes
func (a *App) ListPodcasts() ([]models.PodcastEpisode, error) {
	return a.database.GetPodcasts()
}

// GetPodcast retrieves a single podcast episode by ID
func (a *App) GetPodcast(id string) (*models.PodcastEpisode, error) {
	ep, err := a.database.GetPodcastByID(id)
	if err != nil {
		return nil, err
	}
	if ep == nil {
		return nil, fmt.Errorf("podcast non trovato")
	}
	return ep, nil
}

// DeletePodcast removes a podcast episode and deletes its associated audio file
func (a *App) DeletePodcast(id string) error {
	ep, err := a.database.GetPodcastByID(id)
	if err == nil && ep != nil && ep.AudioPath != "" {
		_ = a.storage.DeleteFile(ep.AudioPath)
	}
	return a.database.DeletePodcast(id)
}

// GetPodcastAudioBase64 returns the full MP3 file as a base64 Data URL for the frontend audio player
func (a *App) GetPodcastAudioBase64(id string) (string, error) {
	ep, err := a.database.GetPodcastByID(id)
	if err != nil || ep == nil {
		return nilStr(), fmt.Errorf("podcast non trovato")
	}

	audioData, err := a.storage.ReadBinaryContent(ep.AudioPath)
	if err != nil {
		return nilStr(), fmt.Errorf("impossibile leggere la traccia audio: %w", err)
	}

	return fmt.Sprintf("data:audio/mp3;base64,%s", base64.StdEncoding.EncodeToString(audioData)), nil
}

func nilStr() string {
	return ""
}

// ExportPodcastAudio prompts the user to save the generated MP3 file to disk
func (a *App) ExportPodcastAudio(id string) error {
	ep, err := a.database.GetPodcastByID(id)
	if err != nil || ep == nil {
		return fmt.Errorf("podcast non trovato")
	}

	defaultName := strings.ReplaceAll(ep.Title, ":", " -") + ".mp3"
	dest, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Esporta traccia audio del podcast",
		DefaultFilename: defaultName,
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "File Audio MP3 (*.mp3)", Pattern: "*.mp3"},
		},
	})
	if err != nil {
		return err
	}
	if dest == "" {
		return nil // User cancelled
	}

	return a.storage.ExportFile(ep.AudioPath, dest)
}

// ExportPodcastScript prompts the user to save the markdown transcript of the podcast to disk
func (a *App) ExportPodcastScript(id string) error {
	ep, err := a.database.GetPodcastByID(id)
	if err != nil || ep == nil {
		return fmt.Errorf("podcast non trovato")
	}

	defaultName := strings.ReplaceAll(ep.Title, ":", " -") + " - Copione.md"
	dest, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Esporta sceneggiatura del podcast",
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

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# %s\n\n", ep.Title))
	sb.WriteString(fmt.Sprintf("- **Data di registrazione**: %s\n", ep.CreatedAt.Format("02/01/2006 15:04")))
	sb.WriteString(fmt.Sprintf("- **Durata stimata**: %d minuti e %d secondi\n", int(ep.DurationSeconds)/60, int(ep.DurationSeconds)%60))
	if len(ep.SourceItemNames) > 0 {
		sb.WriteString(fmt.Sprintf("- **Fonti documentali**: %s\n", strings.Join(ep.SourceItemNames, ", ")))
	}
	if ep.Topic != "" {
		sb.WriteString(fmt.Sprintf("- **Domande / Focus di studio**: %s\n", ep.Topic))
	}
	sb.WriteString("\n---\n\n## Trascrizione del Dialogo\n\n")

	for _, turn := range ep.Turns {
		minutes := int(turn.StartTime) / 60
		seconds := int(turn.StartTime) % 60
		sb.WriteString(fmt.Sprintf("### [%02d:%02d] %s\n%s\n\n", minutes, seconds, turn.Speaker, turn.Text))
	}

	return os.WriteFile(dest, []byte(sb.String()), 0644)
}
