package main

import (
	"net/http"
	"net/http/httptest"
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

func TestGetFileBase64(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_app_b64_test_*")
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

	item, err := app.CreateMarkdownFile("test.md", "Hello Base64 Test", "")
	if err != nil {
		t.Fatalf("CreateMarkdownFile failed: %v", err)
	}

	b64, err := app.GetFileBase64(item.ID)
	if err != nil {
		t.Fatalf("GetFileBase64 failed: %v", err)
	}

	if b64 == "" {
		t.Fatalf("Expected non-empty base64 string")
	}
}

func TestAppFileOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_app_ops_test_*")
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

	// 1. Create a folder
	folder, err := app.CreateFolder("Appunti", "")
	if err != nil {
		t.Fatalf("CreateFolder failed: %v", err)
	}

	// 2. Create a markdown file at root
	item, err := app.CreateMarkdownFile("lezione.md", "# Prima Lezione", "")
	if err != nil {
		t.Fatalf("CreateMarkdownFile failed: %v", err)
	}

	// 3. Test GetFileUrl
	url, err := app.GetFileUrl(item.ID)
	if err != nil {
		t.Fatalf("GetFileUrl failed: %v", err)
	}
	if !strings.HasPrefix(url, "/storage/") {
		t.Fatalf("Expected URL prefix /storage/, got %s", url)
	}

	// 4. Test SaveTextFile
	err = app.SaveTextFile(item.ID, "# Prima Lezione - Aggiornata")
	if err != nil {
		t.Fatalf("SaveTextFile failed: %v", err)
	}
	updatedContent, err := app.GetFileContent(item.ID)
	if err != nil || !strings.Contains(updatedContent, "Aggiornata") {
		t.Fatalf("Expected updated content, got %s", updatedContent)
	}

	// 5. Test MoveItem (move file into folder)
	err = app.MoveItem(item.ID, folder.ID)
	if err != nil {
		t.Fatalf("MoveItem failed: %v", err)
	}
	movedItem, err := database.GetItemByID(item.ID)
	if err != nil || movedItem.ParentID == nil || *movedItem.ParentID != folder.ID {
		t.Fatalf("Expected parent ID %s, got %v", folder.ID, movedItem.ParentID)
	}

	// 6. Test GetAllFolders
	folders, err := app.GetAllFolders()
	if err != nil {
		t.Fatalf("GetAllFolders failed: %v", err)
	}
	if len(folders) != 1 || folders[0].ID != folder.ID {
		t.Fatalf("Expected 1 folder, got %d", len(folders))
	}

	// 7. Test getAssetHandler serving the file
	handler := app.getAssetHandler()
	storagePath := item.StoragePath
	req := httptest.NewRequest("GET", "/storage/"+storagePath, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("AssetHandler returned status %d, expected 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Aggiornata") {
		t.Fatalf("AssetHandler body missing expected content: %s", rec.Body.String())
	}
}

