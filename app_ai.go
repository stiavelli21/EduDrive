package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"EduDrive/ai"
	"EduDrive/converter"
	"EduDrive/models"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Settings keys used to persist the AI configuration in the local SQLite settings table
const (
	settingAIAPIKey = "ai_api_key"
	settingAIModel  = "ai_model"
)

// Wails event names used to stream AI answers to the frontend
const (
	eventAIChunk = "ai:chunk"
	eventAIDone  = "ai:done"
	eventAIError = "ai:error"
)

// Limits protecting the request size and the model context window
const (
	aiMaxDocumentChars = 800_000 // Text documents longer than this are truncated
	aiMaxHistoryTurns  = 20      // Only the most recent turns are re-sent to the model
	aiRequestTimeout   = 5 * time.Minute
)

// modelIDPattern restricts model identifiers to safe URL path characters
var modelIDPattern = regexp.MustCompile(`^[a-zA-Z0-9._\-]+$`)

// aiSystemPrompt instructs the model to behave as a study tutor for the user's notes.
// The prompt is written in Italian because the app UI and the expected answers are in Italian.
const aiSystemPrompt = `Sei l'assistente di studio integrato in EduDrive, un'app per studenti universitari.
L'utente ti fornisce un documento (appunti, dispense, slide, foto di appunti scritti a mano) e ti fa domande su di esso.

Regole:
- Rispondi sempre in italiano, con tono chiaro e didattico, come un tutor universitario.
- Basati prima di tutto sul contenuto del documento. Se aggiungi conoscenze esterne, indicalo esplicitamente.
- Se l'utente seleziona un passaggio, spiega cosa significa quel passaggio, quale ruolo ha nella struttura dell'appunto e come si collega a cio che viene prima e dopo.
- Se la domanda non trova risposta nel documento, dillo chiaramente.
- Usa Markdown: titoli brevi, elenchi puntati, grassetto per i concetti chiave.
- Scrivi le formule in LaTeX usando $...$ per le formule in linea e $$...$$ per quelle a blocco.
- Sii conciso: preferisci risposte compatte e ben strutturate, salvo richiesta di approfondimento.`

// imageMimeByExt maps image extensions supported by Gemini vision to their MIME types
var imageMimeByExt = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".heic": "image/heic",
	".heif": "image/heif",
}

// emitEvent sends a Wails event to the frontend if the runtime context is available
func (a *App) emitEvent(name string, data interface{}) {
	if a.ctx == nil {
		return
	}
	wailsRuntime.EventsEmit(a.ctx, name, data)
}

// newAIClient builds a Gemini client from the stored settings (or an explicit key override)
func (a *App) newAIClient(apiKeyOverride string) (*ai.Client, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	apiKey := strings.TrimSpace(apiKeyOverride)
	if apiKey == "" {
		stored, err := a.database.GetSetting(settingAIAPIKey)
		if err != nil {
			return nil, fmt.Errorf("failed to read AI settings: %w", err)
		}
		apiKey = strings.TrimSpace(stored)
	}
	if apiKey == "" {
		return nil, fmt.Errorf("API key Gemini non configurata: aprila dalle impostazioni dell'assistente IA")
	}

	model, err := a.database.GetSetting(settingAIModel)
	if err != nil {
		return nil, fmt.Errorf("failed to read AI settings: %w", err)
	}

	client := ai.NewClient(apiKey, model)
	if a.aiBaseURL != "" {
		client.BaseURL = a.aiBaseURL
	}
	return client, nil
}

// maskAPIKey hides most characters of an API key for display purposes
func maskAPIKey(key string) string {
	if len(key) <= 8 {
		return strings.Repeat("•", len(key))
	}
	return key[:4] + strings.Repeat("•", 8) + key[len(key)-4:]
}

// GetAISettings returns the AI assistant configuration without exposing the API key
func (a *App) GetAISettings() (*models.AISettings, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	key, err := a.database.GetSetting(settingAIAPIKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read AI settings: %w", err)
	}
	model, err := a.database.GetSetting(settingAIModel)
	if err != nil {
		return nil, fmt.Errorf("failed to read AI settings: %w", err)
	}
	if strings.TrimSpace(model) == "" {
		model = ai.DefaultModel
	}

	key = strings.TrimSpace(key)
	settings := &models.AISettings{
		HasAPIKey: key != "",
		Model:     model,
	}
	if key != "" {
		settings.MaskedKey = maskAPIKey(key)
	}
	return settings, nil
}

// SaveAISettings stores the API key and model. An empty apiKey keeps the existing key.
func (a *App) SaveAISettings(apiKey string, model string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}

	model = strings.TrimPrefix(strings.TrimSpace(model), "models/")
	if model == "" {
		model = ai.DefaultModel
	}
	if !modelIDPattern.MatchString(model) {
		return fmt.Errorf("nome del modello non valido")
	}

	if trimmed := strings.TrimSpace(apiKey); trimmed != "" {
		if err := a.database.SetSetting(settingAIAPIKey, trimmed); err != nil {
			return fmt.Errorf("failed to save API key: %w", err)
		}
	}
	if err := a.database.SetSetting(settingAIModel, model); err != nil {
		return fmt.Errorf("failed to save AI model: %w", err)
	}
	return nil
}

// ClearAIAPIKey removes the stored API key, disabling the assistant
func (a *App) ClearAIAPIKey() error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.database.SetSetting(settingAIAPIKey, "")
}

// ListAIModels verifies the API key (the given one or the stored one) and returns usable models
func (a *App) ListAIModels(apiKey string) ([]models.AIModelInfo, error) {
	client, err := a.newAIClient(apiKey)
	if err != nil {
		return nil, err
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	list, err := client.ListModels(ctx)
	if err != nil {
		return nil, fmt.Errorf("%s", ai.FriendlyMessage(err))
	}

	result := make([]models.AIModelInfo, 0, len(list))
	for _, m := range list {
		result = append(result, models.AIModelInfo{
			ID:          m.Name,
			DisplayName: m.DisplayName,
			Description: m.Description,
		})
	}
	return result, nil
}

// truncateDocument limits the document size sent to the model
func truncateDocument(text string) string {
	if len(text) <= aiMaxDocumentChars {
		return text
	}
	// Cut on a valid UTF-8 boundary
	cut := aiMaxDocumentChars
	for cut > 0 && (text[cut]&0xC0) == 0x80 {
		cut--
	}
	return text[:cut] + "\n\n[... documento troncato perche troppo lungo ...]"
}

// buildDocumentParts prepares the document context (text or inline binary) for the AI request
func (a *App) buildDocumentParts(req models.AIAskRequest) ([]ai.Part, error) {
	name := strings.TrimSpace(req.DocumentName)

	// In-memory text (e.g. unsaved Markdown editor content) takes precedence over the stored file
	if strings.TrimSpace(req.DocumentText) != "" {
		if name == "" {
			name = "Documento"
		}
		return []ai.Part{{Text: fmt.Sprintf("DOCUMENTO DI RIFERIMENTO (%s):\n\n%s", name, truncateDocument(req.DocumentText))}}, nil
	}

	if strings.TrimSpace(req.ItemID) == "" {
		// No document: the assistant answers general questions
		return nil, nil
	}

	if a.database == nil || a.storage == nil {
		return nil, fmt.Errorf("services not initialized")
	}

	item, err := a.database.GetItemByID(req.ItemID)
	if err != nil || item == nil {
		return nil, fmt.Errorf("file not found")
	}
	if item.IsFolder || item.MimeType == "url" {
		return nil, fmt.Errorf("l'assistente funziona solo sui file, non su cartelle o collegamenti")
	}
	if name == "" {
		name = item.Name
	}

	ext := strings.ToLower(filepath.Ext(item.Name))
	header := ai.Part{Text: fmt.Sprintf("DOCUMENTO DI RIFERIMENTO: %s", name)}

	// Binary formats understood natively by Gemini: PDF and images
	inlineMime := ""
	if ext == ".pdf" || item.MimeType == "application/pdf" {
		inlineMime = "application/pdf"
	} else if mime, ok := imageMimeByExt[ext]; ok {
		inlineMime = mime
	}

	if inlineMime != "" {
		data, err := a.storage.ReadBinaryContent(item.StoragePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read file: %w", err)
		}
		if len(data) > ai.MaxInlineBytes {
			return nil, fmt.Errorf("il file e troppo grande per l'assistente (massimo %d MB)", ai.MaxInlineBytes/(1024*1024))
		}
		return []ai.Part{
			header,
			{InlineData: &ai.InlineData{MimeType: inlineMime, Data: base64.StdEncoding.EncodeToString(data)}},
		}, nil
	}

	// Plain text formats are read directly
	var text string
	switch ext {
	case ".md", ".markdown", ".txt":
		text, err = a.storage.ReadTextContent(item.StoragePath)
	default:
		// Word and other documents go through the existing Markdown converter
		fullPath := a.storage.GetFullPath(item.StoragePath)
		if fullPath == "" {
			return nil, fmt.Errorf("file storage path not found")
		}
		text, err = converter.ConvertDocument(fullPath)
	}
	if err != nil {
		return nil, fmt.Errorf("formato non supportato dall'assistente: %w", err)
	}

	return []ai.Part{{Text: fmt.Sprintf("%s\n\n%s", header.Text, truncateDocument(text))}}, nil
}

// composeUserText merges a question with the optional selected passage into the prompt text
func composeUserText(question, selectedText string, hasImageCrop bool) string {
	question = strings.TrimSpace(question)
	selectedText = strings.TrimSpace(selectedText)

	var sb strings.Builder
	if selectedText != "" {
		sb.WriteString("Passaggio selezionato nel documento:\n\"\"\"\n")
		sb.WriteString(selectedText)
		sb.WriteString("\n\"\"\"\n\n")
	}
	if hasImageCrop {
		sb.WriteString("[La domanda si riferisce alla porzione di immagine selezionata dall'utente.]\n\n")
	}
	if question == "" {
		question = "Spiegami questo passaggio."
	}
	sb.WriteString("Richiesta: ")
	sb.WriteString(question)
	return sb.String()
}

// buildAIContents assembles the full conversation: document context, history and current question
func buildAIContents(req models.AIAskRequest, docParts []ai.Part) []ai.Content {
	history := req.History
	if len(history) > aiMaxHistoryTurns {
		history = history[len(history)-aiMaxHistoryTurns:]
	}
	// The conversation must start with a user turn
	for len(history) > 0 && history[0].Role != "user" {
		history = history[1:]
	}

	contents := make([]ai.Content, 0, len(history)+1)
	for _, msg := range history {
		if strings.TrimSpace(msg.Text) == "" && msg.Role == "model" {
			continue
		}
		if msg.Role == "model" {
			contents = append(contents, ai.Content{Role: "model", Parts: []ai.Part{{Text: msg.Text}}})
		} else {
			contents = append(contents, ai.Content{Role: "user", Parts: []ai.Part{{Text: composeUserText(msg.Text, msg.SelectedText, msg.HasImageCrop)}}})
		}
	}

	// Current question, with the optional image crop attached
	hasCrop := strings.TrimSpace(req.ImageCropBase64) != ""
	current := ai.Content{Role: "user", Parts: []ai.Part{{Text: composeUserText(req.Question, req.SelectedText, hasCrop)}}}
	if hasCrop {
		mime := req.ImageCropMime
		if mime == "" {
			mime = "image/png"
		}
		current.Parts = append(current.Parts, ai.Part{InlineData: &ai.InlineData{MimeType: mime, Data: req.ImageCropBase64}})
	}
	contents = append(contents, current)

	// The document is attached once, at the beginning of the first user turn
	if len(docParts) > 0 {
		first := contents[0]
		parts := make([]ai.Part, 0, len(docParts)+len(first.Parts))
		parts = append(parts, docParts...)
		parts = append(parts, first.Parts...)
		contents[0] = ai.Content{Role: first.Role, Parts: parts}
	}

	return contents
}

// AskAI starts streaming an answer. Text fragments are emitted as "ai:chunk" events,
// completion as "ai:done" and failures as "ai:error", all tagged with req.RequestID.
func (a *App) AskAI(req models.AIAskRequest) error {
	req.RequestID = strings.TrimSpace(req.RequestID)
	if req.RequestID == "" {
		return fmt.Errorf("missing request ID")
	}
	if strings.TrimSpace(req.Question) == "" && strings.TrimSpace(req.SelectedText) == "" && req.ImageCropBase64 == "" {
		return fmt.Errorf("scrivi una domanda o seleziona una parte del documento")
	}
	if len(req.ImageCropBase64) > ai.MaxInlineBytes {
		return fmt.Errorf("l'area selezionata e troppo grande")
	}

	client, err := a.newAIClient("")
	if err != nil {
		return err
	}

	docParts, err := a.buildDocumentParts(req)
	if err != nil {
		return err
	}
	contents := buildAIContents(req, docParts)

	parent := a.ctx
	if parent == nil {
		parent = context.Background()
	}
	ctx, cancel := context.WithTimeout(parent, aiRequestTimeout)

	a.aiMu.Lock()
	if a.aiCancels == nil {
		a.aiCancels = make(map[string]context.CancelFunc)
	}
	a.aiCancels[req.RequestID] = cancel
	a.aiMu.Unlock()

	go func(requestID string) {
		defer func() {
			cancel()
			a.aiMu.Lock()
			delete(a.aiCancels, requestID)
			a.aiMu.Unlock()
		}()

		streamErr := client.StreamGenerate(ctx, aiSystemPrompt, contents, func(text string) {
			a.emitEvent(eventAIChunk, map[string]string{"requestId": requestID, "text": text})
		})

		if streamErr != nil {
			if ctx.Err() == context.Canceled {
				// User-initiated cancellation is not an error
				a.emitEvent(eventAIDone, map[string]interface{}{"requestId": requestID, "cancelled": true})
				return
			}
			if a.ctx != nil {
				wailsRuntime.LogWarningf(a.ctx, "AI request %s failed: %v", requestID, streamErr)
			}
			a.emitEvent(eventAIError, map[string]string{"requestId": requestID, "message": ai.FriendlyMessage(streamErr)})
			return
		}
		a.emitEvent(eventAIDone, map[string]interface{}{"requestId": requestID, "cancelled": false})
	}(req.RequestID)

	return nil
}

// CancelAIRequest stops an in-flight AI stream
func (a *App) CancelAIRequest(requestID string) error {
	a.aiMu.Lock()
	cancel, ok := a.aiCancels[requestID]
	a.aiMu.Unlock()
	if ok {
		cancel()
	}
	return nil
}
