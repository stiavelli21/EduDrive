package main

import (
	"path/filepath"
	"testing"
	"time"

	"EduDrive/db"
	"EduDrive/models"
	"EduDrive/storage"
)

func setupTestPodcastApp(t *testing.T) *App {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_podcast.db")
	database, err := db.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}

	storageDir := filepath.Join(tmpDir, "storage")
	sm, err := storage.NewStorageManager(storageDir)
	if err != nil {
		t.Fatalf("failed to init storage: %v", err)
	}

	return &App{
		database: database,
		storage:  sm,
		dataDir:  tmpDir,
	}
}

func TestPodcastEpisodeCRUD(t *testing.T) {
	app := setupTestPodcastApp(t)
	defer app.database.Close()

	// 1. Create dummy audio file in storage
	dummyAudio := []byte{0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00}
	filename, err := app.storage.SaveBinaryContent(".mp3", dummyAudio)
	if err != nil {
		t.Fatalf("failed to save dummy audio: %v", err)
	}

	episode := &models.PodcastEpisode{
		ID:              "ep-test-123",
		Title:           "Podcast: Analisi Matematica",
		Topic:           "Spiegare il teorema dei valori intermedi",
		Tone:            "academic",
		SourceItemIDs:   []string{"item-1"},
		SourceItemNames: []string{"Analisi1.pdf"},
		Turns: []models.PodcastTurn{
			{Speaker: "Marco", Text: "Ciao a tutti!", StartTime: 0.0, EndTime: 2.5},
			{Speaker: "Elena", Text: "Oggi parliamo di teoremi fondamentali.", StartTime: 2.5, EndTime: 6.0},
		},
		AudioPath:       filename,
		DurationSeconds: 6.0,
		CreatedAt:       time.Now(),
	}

	// 2. Insert
	if err := app.database.InsertPodcast(episode); err != nil {
		t.Fatalf("failed to insert podcast: %v", err)
	}

	// 3. List
	episodes, err := app.ListPodcasts()
	if err != nil {
		t.Fatalf("failed to list podcasts: %v", err)
	}
	if len(episodes) != 1 {
		t.Fatalf("expected 1 episode, got %d", len(episodes))
	}
	if episodes[0].Title != "Podcast: Analisi Matematica" {
		t.Fatalf("unexpected title: %s", episodes[0].Title)
	}
	if len(episodes[0].Turns) != 2 {
		t.Fatalf("expected 2 turns, got %d", len(episodes[0].Turns))
	}

	// 4. Get by ID
	fetched, err := app.GetPodcast("ep-test-123")
	if err != nil {
		t.Fatalf("failed to get podcast: %v", err)
	}
	if fetched == nil || fetched.ID != "ep-test-123" {
		t.Fatalf("failed to fetch correct episode")
	}

	// 5. Get Audio Base64
	dataURL, err := app.GetPodcastAudioBase64("ep-test-123")
	if err != nil {
		t.Fatalf("failed to get audio base64: %v", err)
	}
	if len(dataURL) < 20 {
		t.Fatalf("expected non-empty data URL, got %s", dataURL)
	}

	// 6. Delete
	if err := app.DeletePodcast("ep-test-123"); err != nil {
		t.Fatalf("failed to delete podcast: %v", err)
	}

	// Verify deletion
	afterDel, err := app.ListPodcasts()
	if err != nil {
		t.Fatalf("failed to list after delete: %v", err)
	}
	if len(afterDel) != 0 {
		t.Fatalf("expected 0 episodes after delete, got %d", len(afterDel))
	}
}
