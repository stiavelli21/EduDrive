package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"EduDrive/ai"
	"EduDrive/db"
	"EduDrive/models"
	"EduDrive/storage"
)

// newTestApp creates an App backed by a temporary database and storage directory
func newTestApp(t *testing.T) *App {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "edudrive_ai_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(tempDir) })

	database, err := db.InitDB(filepath.Join(tempDir, "edudrive.db"))
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	storageMgr, err := storage.NewStorageManager(filepath.Join(tempDir, "storage_data"))
	if err != nil {
		t.Fatalf("NewStorageManager failed: %v", err)
	}

	return &App{database: database, storage: storageMgr, dataDir: tempDir}
}

func TestAISettingsRoundTrip(t *testing.T) {
	app := newTestApp(t)

	settings, err := app.GetAISettings()
	if err != nil {
		t.Fatalf("GetAISettings failed: %v", err)
	}
	if settings.HasAPIKey || settings.Model != ai.DefaultModel {
		t.Fatalf("unexpected default settings: %+v", settings)
	}

	if err := app.SaveAISettings("AIzaSyTESTKEY123456", "models/gemini-custom"); err != nil {
		t.Fatalf("SaveAISettings failed: %v", err)
	}
	settings, _ = app.GetAISettings()
	if !settings.HasAPIKey || settings.Model != "gemini-custom" {
		t.Fatalf("settings not saved: %+v", settings)
	}
	if strings.Contains(settings.MaskedKey, "TESTKEY") {
		t.Fatalf("API key should be masked, got %s", settings.MaskedKey)
	}

	// Empty key keeps the existing one
	if err := app.SaveAISettings("", "gemini-other"); err != nil {
		t.Fatalf("SaveAISettings failed: %v", err)
	}
	settings, _ = app.GetAISettings()
	if !settings.HasAPIKey || settings.Model != "gemini-other" {
		t.Fatalf("existing key should be preserved: %+v", settings)
	}

	// Invalid model names are rejected
	if err := app.SaveAISettings("", "../evil?x=1"); err == nil {
		t.Fatalf("expected invalid model error")
	}

	if err := app.ClearAIAPIKey(); err != nil {
		t.Fatalf("ClearAIAPIKey failed: %v", err)
	}
	settings, _ = app.GetAISettings()
	if settings.HasAPIKey {
		t.Fatalf("API key should be cleared")
	}
}

func TestAskAIRequiresAPIKey(t *testing.T) {
	app := newTestApp(t)
	err := app.AskAI(models.AIAskRequest{RequestID: "r1", Question: "Ciao"})
	if err == nil || !strings.Contains(err.Error(), "API key") {
		t.Fatalf("expected missing API key error, got %v", err)
	}
}

func TestBuildDocumentPartsMarkdown(t *testing.T) {
	app := newTestApp(t)
	item, err := app.CreateMarkdownFile("Analisi.md", "# Limiti\nDefinizione di limite", "")
	if err != nil {
		t.Fatalf("CreateMarkdownFile failed: %v", err)
	}

	parts, err := app.buildDocumentParts(models.AIAskRequest{ItemID: item.ID})
	if err != nil {
		t.Fatalf("buildDocumentParts failed: %v", err)
	}
	if len(parts) != 1 || !strings.Contains(parts[0].Text, "Definizione di limite") || !strings.Contains(parts[0].Text, "Analisi.md") {
		t.Fatalf("unexpected markdown parts: %+v", parts)
	}

	// In-memory text overrides the stored file
	parts, err = app.buildDocumentParts(models.AIAskRequest{ItemID: item.ID, DocumentText: "Bozza non salvata"})
	if err != nil {
		t.Fatalf("buildDocumentParts failed: %v", err)
	}
	if !strings.Contains(parts[0].Text, "Bozza non salvata") {
		t.Fatalf("document text override ignored: %+v", parts)
	}
}

func TestBuildDocumentPartsPDFInline(t *testing.T) {
	app := newTestApp(t)
	item, err := app.SaveFileFromBase64("slide.pdf", "JVBERi0xLjQKJQ==", "")
	if err != nil {
		t.Fatalf("SaveFileFromBase64 failed: %v", err)
	}

	parts, err := app.buildDocumentParts(models.AIAskRequest{ItemID: item.ID})
	if err != nil {
		t.Fatalf("buildDocumentParts failed: %v", err)
	}
	if len(parts) != 2 || parts[1].InlineData == nil || parts[1].InlineData.MimeType != "application/pdf" {
		t.Fatalf("expected inline PDF part, got %+v", parts)
	}
}

func TestBuildAIContents(t *testing.T) {
	req := models.AIAskRequest{
		Question:        "E questo?",
		SelectedText:    "teorema di Rolle",
		ImageCropBase64: "iVBORw0KGgo=",
		History: []models.AIChatMessage{
			{Role: "model", Text: "orphan answer"},
			{Role: "user", Text: "Di cosa parla?"},
			{Role: "model", Text: "Parla di analisi."},
		},
	}
	docParts := []ai.Part{{Text: "DOCUMENTO"}}

	contents := buildAIContents(req, docParts)
	if len(contents) != 3 {
		t.Fatalf("expected 3 turns (leading model turn dropped), got %d", len(contents))
	}
	if contents[0].Role != "user" || contents[0].Parts[0].Text != "DOCUMENTO" {
		t.Fatalf("document must prefix the first user turn: %+v", contents[0])
	}
	last := contents[2]
	if last.Role != "user" || !strings.Contains(last.Parts[0].Text, "teorema di Rolle") {
		t.Fatalf("selection missing from current turn: %+v", last)
	}
	if len(last.Parts) != 2 || last.Parts[1].InlineData == nil || last.Parts[1].InlineData.MimeType != "image/png" {
		t.Fatalf("image crop missing from current turn: %+v", last)
	}
}
