package db

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"EduDrive/models"
)

func TestDatabaseOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer database.Close()

	// 1. Insert Folder
	folder := &models.Item{
		ID:        "folder-1",
		Name:      "Documenti",
		IsFolder:  true,
		SizeBytes: 0,
		MimeType:  "folder",
		IsTrash:   false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := database.InsertItem(folder); err != nil {
		t.Fatalf("InsertItem folder failed: %v", err)
	}

	// 2. Insert File inside Folder
	parentID := "folder-1"
	file := &models.Item{
		ID:          "file-1",
		Name:        "tesi.pdf",
		ParentID:    &parentID,
		IsFolder:    false,
		SizeBytes:   1024 * 500, // 500 KB
		MimeType:    "application/pdf",
		StoragePath: "uuid-1234.pdf",
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := database.InsertItem(file); err != nil {
		t.Fatalf("InsertItem file failed: %v", err)
	}

	// 3. Retrieve Root items
	rootItems, err := database.GetItemsByParentID("")
	if err != nil {
		t.Fatalf("GetItemsByParentID root failed: %v", err)
	}
	if len(rootItems) != 1 || rootItems[0].ID != "folder-1" {
		t.Fatalf("Expected 1 root item (folder-1), got %d", len(rootItems))
	}

	// 4. Retrieve Folder-1 items
	folderItems, err := database.GetItemsByParentID("folder-1")
	if err != nil {
		t.Fatalf("GetItemsByParentID folder-1 failed: %v", err)
	}
	if len(folderItems) != 1 || folderItems[0].ID != "file-1" {
		t.Fatalf("Expected 1 child item (file-1), got %d", len(folderItems))
	}

	// 5. Breadcrumbs
	crumbs, err := database.GetBreadcrumbs("folder-1")
	if err != nil {
		t.Fatalf("GetBreadcrumbs failed: %v", err)
	}
	if len(crumbs) != 2 || crumbs[0].Name != "Il mio Drive" || crumbs[1].Name != "Documenti" {
		t.Fatalf("Unexpected breadcrumbs: %+v", crumbs)
	}

	// 6. Search
	searchRes, err := database.SearchItems("tesi")
	if err != nil {
		t.Fatalf("SearchItems failed: %v", err)
	}
	if len(searchRes) != 1 || searchRes[0].Name != "tesi.pdf" {
		t.Fatalf("Expected search match for tesi.pdf, got %+v", searchRes)
	}

	// 7. Stats
	stats, err := database.GetStorageStats()
	if err != nil {
		t.Fatalf("GetStorageStats failed: %v", err)
	}
	if stats.TotalFiles != 1 || stats.TotalFolders != 1 || stats.TotalSizeBytes != 1024*500 {
		t.Fatalf("Unexpected stats: %+v", stats)
	}

	// 8. Rename
	if err := database.UpdateItemName("file-1", "tesi_finale.pdf"); err != nil {
		t.Fatalf("UpdateItemName failed: %v", err)
	}
	renamed, err := database.GetItemByID("file-1")
	if err != nil || renamed.Name != "tesi_finale.pdf" {
		t.Fatalf("Rename verification failed: %+v", renamed)
	}

	// 9. Trash
	if err := database.SetTrashStatus("folder-1", true); err != nil {
		t.Fatalf("SetTrashStatus failed: %v", err)
	}
	trashItems, err := database.GetTrashItems()
	if err != nil {
		t.Fatalf("GetTrashItems failed: %v", err)
	}
	if len(trashItems) != 2 {
		t.Fatalf("Expected both folder-1 and file-1 in trash, got %d", len(trashItems))
	}

	// 10. Restore
	if err := database.SetTrashStatus("folder-1", false); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}
	trashItemsAfterRestore, _ := database.GetTrashItems()
	if len(trashItemsAfterRestore) != 0 {
		t.Fatalf("Expected 0 trash items after restore, got %d", len(trashItemsAfterRestore))
	}
}
