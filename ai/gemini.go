// Package ai implements a minimal, dependency-free client for the Google Gemini REST API.
// It relies only on the Go standard library (net/http), keeping the project free of CGO.
package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DefaultBaseURL is the public Gemini API endpoint.
const DefaultBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// DefaultModel is a rolling alias that always points to the latest stable Flash model.
const DefaultModel = "gemini-flash-latest"

// MaxInlineBytes is the maximum raw size of binary data that can be sent inline.
// The Gemini API limits the whole request to ~20MB, base64 adds ~33% overhead.
const MaxInlineBytes = 14 * 1024 * 1024

// InlineData carries base64 encoded binary content (PDF, images) inside a request part.
type InlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}

// Part is a single piece of a message: either text or inline binary data.
type Part struct {
	Text       string      `json:"text,omitempty"`
	InlineData *InlineData `json:"inline_data,omitempty"`
}

// Content is a conversation turn with a role ("user" or "model") and its parts.
type Content struct {
	Role  string `json:"role,omitempty"`
	Parts []Part `json:"parts"`
}

// ModelInfo describes a model returned by the ListModels endpoint.
type ModelInfo struct {
	Name                       string   `json:"name"`
	DisplayName                string   `json:"displayName"`
	Description                string   `json:"description"`
	SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
}

// APIError represents an error payload returned by the Gemini API.
type APIError struct {
	HTTPStatus int
	Code       int    `json:"code"`
	Message    string `json:"message"`
	Status     string `json:"status"`
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return fmt.Sprintf("gemini api error %d (%s): %s", e.HTTPStatus, e.Status, e.Message)
}

// Client is a lightweight Gemini API client.
type Client struct {
	APIKey  string
	Model   string
	BaseURL string
	HTTP    *http.Client
}

// NewClient creates a client with sensible defaults.
func NewClient(apiKey, model string) *Client {
	if strings.TrimSpace(model) == "" {
		model = DefaultModel
	}
	return &Client{
		APIKey:  strings.TrimSpace(apiKey),
		Model:   strings.TrimPrefix(strings.TrimSpace(model), "models/"),
		BaseURL: DefaultBaseURL,
		// No global timeout: streaming responses may legitimately take a while.
		// Cancellation is driven by the request context instead.
		HTTP: &http.Client{},
	}
}

// generateRequest is the JSON body for generateContent / streamGenerateContent.
type generateRequest struct {
	SystemInstruction *Content         `json:"system_instruction,omitempty"`
	Contents          []Content        `json:"contents"`
	GenerationConfig  generationConfig `json:"generationConfig"`
}

type generationConfig struct {
	Temperature     float64 `json:"temperature"`
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
}

// streamChunk is a single SSE event payload.
type streamChunk struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text    string `json:"text"`
				Thought bool   `json:"thought"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	PromptFeedback *struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
	Error *APIError `json:"error"`
}

// ErrBlocked is returned when the prompt or response is blocked by safety filters.
var ErrBlocked = errors.New("content blocked by safety filters")

// StreamGenerate sends a conversation and invokes onChunk for every text fragment received.
// It returns when the stream ends, the context is cancelled or an error occurs.
func (c *Client) StreamGenerate(ctx context.Context, systemPrompt string, contents []Content, onChunk func(string)) error {
	if c.APIKey == "" {
		return errors.New("missing API key")
	}
	if len(contents) == 0 {
		return errors.New("empty conversation")
	}

	body := generateRequest{
		Contents:         contents,
		GenerationConfig: generationConfig{Temperature: 0.4},
	}
	if strings.TrimSpace(systemPrompt) != "" {
		body.SystemInstruction = &Content{Parts: []Part{{Text: systemPrompt}}}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to encode request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse", c.BaseURL, c.Model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", c.APIKey)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return parseAPIError(resp)
	}

	// SSE lines can be large (long text chunks), so enlarge the scanner buffer.
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)

	receivedText := false
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}

		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			// Skip malformed events instead of aborting the whole stream.
			continue
		}
		if chunk.Error != nil {
			return chunk.Error
		}
		if chunk.PromptFeedback != nil && chunk.PromptFeedback.BlockReason != "" {
			return ErrBlocked
		}
		for _, cand := range chunk.Candidates {
			for _, p := range cand.Content.Parts {
				// Skip internal reasoning parts emitted by thinking models.
				if p.Thought || p.Text == "" {
					continue
				}
				receivedText = true
				onChunk(p.Text)
			}
			if cand.FinishReason == "SAFETY" || cand.FinishReason == "PROHIBITED_CONTENT" {
				return ErrBlocked
			}
		}
	}

	if err := scanner.Err(); err != nil {
		// A cancelled context surfaces as a read error: report the cancellation instead.
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("stream read error: %w", err)
	}
	if !receivedText && ctx.Err() == nil {
		return errors.New("empty response from model")
	}
	return ctx.Err()
}

// ListModels returns the models available for the configured API key that support text generation.
func (c *Client) ListModels(ctx context.Context) ([]ModelInfo, error) {
	if c.APIKey == "" {
		return nil, errors.New("missing API key")
	}

	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/models?pageSize=1000", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-goog-api-key", c.APIKey)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, parseAPIError(resp)
	}

	var parsed struct {
		Models []ModelInfo `json:"models"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("failed to decode models list: %w", err)
	}

	// Keep only Gemini models able to generate content (exclude embeddings, TTS, image-only models).
	result := make([]ModelInfo, 0, len(parsed.Models))
	for _, m := range parsed.Models {
		id := strings.TrimPrefix(m.Name, "models/")
		if !strings.HasPrefix(id, "gemini") {
			continue
		}
		if strings.Contains(id, "tts") || strings.Contains(id, "image") || strings.Contains(id, "embedding") || strings.Contains(id, "live") {
			continue
		}
		supportsGenerate := false
		for _, method := range m.SupportedGenerationMethods {
			if method == "generateContent" {
				supportsGenerate = true
				break
			}
		}
		if supportsGenerate {
			m.Name = id
			result = append(result, m)
		}
	}
	return result, nil
}

// parseAPIError extracts a structured error from a non-200 response.
func parseAPIError(resp *http.Response) error {
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))

	// The API may return either an object or (for streaming) an array of objects.
	var single struct {
		Error *APIError `json:"error"`
	}
	if err := json.Unmarshal(raw, &single); err == nil && single.Error != nil {
		single.Error.HTTPStatus = resp.StatusCode
		return single.Error
	}
	var list []struct {
		Error *APIError `json:"error"`
	}
	if err := json.Unmarshal(raw, &list); err == nil && len(list) > 0 && list[0].Error != nil {
		list[0].Error.HTTPStatus = resp.StatusCode
		return list[0].Error
	}

	return &APIError{
		HTTPStatus: resp.StatusCode,
		Code:       resp.StatusCode,
		Status:     http.StatusText(resp.StatusCode),
		Message:    strings.TrimSpace(string(raw)),
	}
}

// FriendlyMessage converts low-level errors into short Italian messages suitable for the UI.
func FriendlyMessage(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.Canceled) {
		return "Richiesta annullata."
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "La richiesta ha impiegato troppo tempo. Riprova."
	}
	if errors.Is(err, ErrBlocked) {
		return "La risposta è stata bloccata dai filtri di sicurezza di Gemini."
	}

	var apiErr *APIError
	if errors.As(err, &apiErr) {
		msg := strings.ToLower(apiErr.Message)
		switch {
		case apiErr.HTTPStatus == http.StatusBadRequest && (strings.Contains(msg, "api key") || strings.Contains(msg, "api_key")):
			return "API key non valida. Controlla la chiave nelle impostazioni dell'assistente."
		case apiErr.HTTPStatus == http.StatusUnauthorized || apiErr.HTTPStatus == http.StatusForbidden:
			return "Accesso negato: la API key non è valida o non ha i permessi necessari."
		case apiErr.HTTPStatus == http.StatusNotFound:
			return "Modello non trovato. Scegline un altro nelle impostazioni dell'assistente."
		case apiErr.HTTPStatus == http.StatusTooManyRequests:
			return "Limite di richieste raggiunto per la tua API key. Attendi qualche istante e riprova."
		case apiErr.HTTPStatus == http.StatusRequestEntityTooLarge:
			return "Il file è troppo grande per essere inviato all'assistente."
		case apiErr.HTTPStatus >= 500:
			return "Il servizio Gemini non è al momento disponibile. Riprova più tardi."
		}
		if apiErr.Message != "" {
			return "Errore Gemini: " + apiErr.Message
		}
	}

	if strings.Contains(strings.ToLower(err.Error()), "no such host") || strings.Contains(strings.ToLower(err.Error()), "dial tcp") {
		return "Connessione a internet assente o servizio non raggiungibile."
	}
	return err.Error()
}
