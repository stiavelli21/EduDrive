package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"EduDrive/db"
	"EduDrive/models"
	"EduDrive/storage"
)

func TestBuildHandoutPrompts(t *testing.T) {
	modes := []string{"reasoned_handout", "didactic_simplification", "technical_deep_dive", "exam_prep"}
	for _, mode := range modes {
		systemPrompt, directives := buildHandoutPrompts(mode, "standard")
		if !strings.Contains(systemPrompt, "professore universitario") {
			t.Errorf("expected systemPrompt for mode %s to mention professore", mode)
		}
		if len(directives) == 0 {
			t.Errorf("expected directives for mode %s to be non-empty", mode)
		}
	}

	// Verify Feynman mention in simplification
	_, simpDirectives := buildHandoutPrompts("didactic_simplification", "concise")
	if !strings.Contains(simpDirectives, "Feynman") {
		t.Errorf("expected didactic_simplification directives to reference Feynman method")
	}

	// Verify KaTeX derivations in technical deep dive
	_, techDirectives := buildHandoutPrompts("technical_deep_dive", "exhaustive")
	if !strings.Contains(techDirectives, "KaTeX") {
		t.Errorf("expected technical_deep_dive directives to reference KaTeX")
	}

	// Verify exam prep questions
	_, examDirectives := buildHandoutPrompts("exam_prep", "standard")
	if !strings.Contains(examDirectives, "Domande d'Esame") {
		t.Errorf("expected exam_prep directives to reference Domande d'Esame")
	}
}

func TestSanitizeFileName(t *testing.T) {
	input := `Dispensa: Analisi I / Esercizi? <Tutti>`
	clean := sanitizeFileName(input)
	if strings.ContainsAny(clean, `:/?<>`) {
		t.Errorf("sanitizeFileName failed to remove forbidden characters: %s", clean)
	}
	if clean != "Dispensa Analisi I Esercizi Tutti" {
		t.Errorf("unexpected sanitized filename: %s", clean)
	}
}

func TestStudyHandoutLifecycleInApp(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_app_handout_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := db.InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer database.Close()

	storageDir := filepath.Join(tempDir, "storage_data")
	stor, err := storage.NewStorageManager(storageDir)
	if err != nil {
		t.Fatalf("NewStorageManager failed: %v", err)
	}

	app := &App{
		database: database,
		storage:  stor,
	}

	// Test GenerateStudyHandout error on empty item list
	_, err = app.GenerateStudyHandout(models.StudyHandoutGenerateRequest{
		ItemIDs: []string{},
	})
	if err == nil {
		t.Fatalf("expected error when generating handout with no items, got nil")
	}

	// Test Insert and List directly
	h := &models.StudyHandout{
		ID:              "handout-test-1",
		Title:           "Sintesi Fisica Meccanica",
		Topic:           "Cinematica e Dinamica",
		Mode:            "reasoned_handout",
		DetailLevel:     "standard",
		SourceItemIDs:   []string{"item-1"},
		SourceItemNames: []string{"Slide1.pdf"},
		ContentMarkdown: "# Cinematica\n\n$v = \\frac{ds}{dt}$",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := database.InsertStudyHandout(h); err != nil {
		t.Fatalf("InsertStudyHandout failed: %v", err)
	}

	list, err := app.ListStudyHandouts()
	if err != nil {
		t.Fatalf("ListStudyHandouts failed: %v", err)
	}
	if len(list) != 1 || list[0].Title != h.Title {
		t.Fatalf("expected 1 handout, got %+v", list)
	}

	// Test GetStudyHandout
	fetched, err := app.GetStudyHandout("handout-test-1")
	if err != nil || fetched == nil {
		t.Fatalf("GetStudyHandout failed: %v", err)
	}

	// Test UpdateStudyHandout
	err = app.UpdateStudyHandout("handout-test-1", "Nuovo Titolo Fisica", "# Aggiornato")
	if err != nil {
		t.Fatalf("UpdateStudyHandout failed: %v", err)
	}

	updated, err := app.GetStudyHandout("handout-test-1")
	if err != nil || updated.Title != "Nuovo Titolo Fisica" || updated.ContentMarkdown != "# Aggiornato" {
		t.Fatalf("Updated study handout mismatch: %+v", updated)
	}

	// Test SaveStudyHandoutToDrive
	driveItem, err := app.SaveStudyHandoutToDrive("handout-test-1", "")
	if err != nil || driveItem == nil {
		t.Fatalf("SaveStudyHandoutToDrive failed: %v", err)
	}
	if driveItem.Name != "Nuovo Titolo Fisica.md" {
		t.Fatalf("expected drive item name 'Nuovo Titolo Fisica.md', got %s", driveItem.Name)
	}

	// Test DeleteStudyHandout
	err = app.DeleteStudyHandout("handout-test-1")
	if err != nil {
		t.Fatalf("DeleteStudyHandout failed: %v", err)
	}

	remaining, err := app.ListStudyHandouts()
	if err != nil || len(remaining) != 0 {
		t.Fatalf("expected 0 handouts after delete, got %d", len(remaining))
	}
}
