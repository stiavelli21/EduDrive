package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"EduDrive/db"
	"EduDrive/storage"
)

func TestSeedInitialData(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_app_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "edudrive.db")
	database, err := db.InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer database.Close()

	storageDir := filepath.Join(tempDir, "storage_data")
	storageMgr, err := storage.NewStorageManager(storageDir)
	if err != nil {
		t.Fatalf("NewStorageManager failed: %v", err)
	}

	app := &App{
		database: database,
		storage:  storageMgr,
		dataDir:  tempDir,
	}

	// First execution: initial seed should run
	app.seedInitialData()

	items, err := database.GetItemsByParentID("")
	if err != nil {
		t.Fatalf("GetItemsByParentID failed: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("Expected 1 item (README.md) after initial seed, got %d", len(items))
	}

	if items[0].Name != "README.md" || items[0].MimeType != "text/markdown" {
		t.Fatalf("Unexpected item attributes: %+v", items[0])
	}

	// Verify file content on disk
	content, err := app.GetFileContent(items[0].ID)
	if err != nil {
		t.Fatalf("GetFileContent failed: %v", err)
	}
	if !strings.Contains(content, "EduDrive") {
		t.Fatalf("Expected embedded README content containing 'EduDrive', got: %s", content)
	}

	// Check setting flag
	flag, err := database.GetSetting("initial_seed_completed")
	if err != nil || flag != "1" {
		t.Fatalf("Expected initial_seed_completed = 1, got: %s (err: %v)", flag, err)
	}

	// Delete the item (simulate user deleting README.md)
	if err := app.DeleteItem(items[0].ID, true); err != nil {
		t.Fatalf("DeleteItem failed: %v", err)
	}

	// Verify drive is empty
	itemsAfterDelete, err := database.GetItemsByParentID("")
	if err != nil {
		t.Fatalf("GetItemsByParentID failed: %v", err)
	}
	if len(itemsAfterDelete) != 0 {
		t.Fatalf("Expected 0 items after deletion, got %d", len(itemsAfterDelete))
	}

	// Second execution: seedInitialData should NOT recreate the deleted README.md
	app.seedInitialData()

	itemsAfterSecondSeed, err := database.GetItemsByParentID("")
	if err != nil {
		t.Fatalf("GetItemsByParentID failed: %v", err)
	}
	if len(itemsAfterSecondSeed) != 0 {
		t.Fatalf("Expected 0 items on subsequent launch after deletion, got %d", len(itemsAfterSecondSeed))
	}
}
