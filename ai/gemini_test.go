package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestClient returns a client pointed at the given test server.
func newTestClient(serverURL string) *Client {
	c := NewClient("test-key", "gemini-test")
	c.BaseURL = serverURL
	return c
}

func TestStreamGenerateParsesSSE(t *testing.T) {
	var receivedBody generateRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Validate endpoint, auth header and body shape
		if !strings.HasSuffix(r.URL.Path, "/models/gemini-test:streamGenerateContent") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("alt") != "sse" {
			t.Errorf("expected alt=sse query parameter")
		}
		if r.Header.Get("x-goog-api-key") != "test-key" {
			t.Errorf("missing api key header")
		}
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &receivedBody); err != nil {
			t.Errorf("invalid request body: %v", err)
		}

		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"thinking\",\"thought\":true}]}}]}\n\n")
		_, _ = io.WriteString(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Ciao \"}]}}]}\n\n")
		_, _ = io.WriteString(w, "data: not-json\n\n")
		_, _ = io.WriteString(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"mondo\"}]},\"finishReason\":\"STOP\"}]}\n\n")
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	var sb strings.Builder
	contents := []Content{{Role: "user", Parts: []Part{
		{Text: "Spiega"},
		{InlineData: &InlineData{MimeType: "application/pdf", Data: "QUJD"}},
	}}}

	err := client.StreamGenerate(context.Background(), "system", contents, func(s string) { sb.WriteString(s) })
	if err != nil {
		t.Fatalf("StreamGenerate failed: %v", err)
	}
	if sb.String() != "Ciao mondo" {
		t.Fatalf("unexpected streamed text: %q", sb.String())
	}
	if receivedBody.SystemInstruction == nil || receivedBody.SystemInstruction.Parts[0].Text != "system" {
		t.Fatalf("system instruction not sent")
	}
	if len(receivedBody.Contents) != 1 || receivedBody.Contents[0].Parts[1].InlineData == nil {
		t.Fatalf("inline data not sent correctly: %+v", receivedBody.Contents)
	}
}

func TestStreamGenerateAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	err := client.StreamGenerate(context.Background(), "", []Content{{Role: "user", Parts: []Part{{Text: "x"}}}}, func(string) {})

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %v", err)
	}
	if apiErr.HTTPStatus != http.StatusBadRequest {
		t.Fatalf("unexpected status: %d", apiErr.HTTPStatus)
	}
	if !strings.Contains(FriendlyMessage(err), "API key non valida") {
		t.Fatalf("unexpected friendly message: %s", FriendlyMessage(err))
	}
}

func TestStreamGenerateBlocked(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "data: {\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}\n\n")
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	err := client.StreamGenerate(context.Background(), "", []Content{{Role: "user", Parts: []Part{{Text: "x"}}}}, func(string) {})
	if !errors.Is(err, ErrBlocked) {
		t.Fatalf("expected ErrBlocked, got %v", err)
	}
}

func TestStreamGenerateRequiresKey(t *testing.T) {
	client := NewClient("", "")
	if client.Model != DefaultModel {
		t.Fatalf("expected default model, got %s", client.Model)
	}
	err := client.StreamGenerate(context.Background(), "", []Content{{Role: "user", Parts: []Part{{Text: "x"}}}}, func(string) {})
	if err == nil {
		t.Fatalf("expected error for missing API key")
	}
}

func TestListModelsFilters(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/models") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_, _ = io.WriteString(w, `{"models":[
			{"name":"models/gemini-flash-latest","displayName":"Gemini Flash","supportedGenerationMethods":["generateContent","countTokens"]},
			{"name":"models/gemini-embedding-001","supportedGenerationMethods":["embedContent"]},
			{"name":"models/gemini-flash-tts","supportedGenerationMethods":["generateContent"]},
			{"name":"models/imagen-4","supportedGenerationMethods":["predict"]}
		]}`)
	}))
	defer server.Close()

	client := newTestClient(server.URL)
	models, err := client.ListModels(context.Background())
	if err != nil {
		t.Fatalf("ListModels failed: %v", err)
	}
	if len(models) != 1 || models[0].Name != "gemini-flash-latest" {
		t.Fatalf("unexpected filtered models: %+v", models)
	}
}

func TestFriendlyMessageCancelled(t *testing.T) {
	if FriendlyMessage(context.Canceled) != "Richiesta annullata." {
		t.Fatalf("unexpected cancel message")
	}
	if FriendlyMessage(&APIError{HTTPStatus: 429}) == "" {
		t.Fatalf("expected rate limit message")
	}
}
