package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStorageOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_storage_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storageDir := filepath.Join(tempDir, "storage_data")
	sm, err := NewStorageManager(storageDir)
	if err != nil {
		t.Fatalf("NewStorageManager failed: %v", err)
	}

	// Create dummy test file
	sourceFile := filepath.Join(tempDir, "sample.txt")
	testContent := "Benvenuto su EduDrive! Contenuto di test."
	if err := os.WriteFile(sourceFile, []byte(testContent), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Test SaveFile
	storageName, size, mimeType, err := sm.SaveFile(sourceFile)
	if err != nil {
		t.Fatalf("SaveFile failed: %v", err)
	}
	if size != int64(len(testContent)) {
		t.Fatalf("Expected size %d, got %d", len(testContent), size)
	}
	if mimeType != "text/plain" {
		t.Fatalf("Expected text/plain, got %s", mimeType)
	}

	// Test GetFullPath
	fullPath := sm.GetFullPath(storageName)
	if _, err := os.Stat(fullPath); err != nil {
		t.Fatalf("Stored file does not exist on disk: %v", err)
	}

	// Test ExportFile
	exportPath := filepath.Join(tempDir, "exported.txt")
	if err := sm.ExportFile(storageName, exportPath); err != nil {
		t.Fatalf("ExportFile failed: %v", err)
	}
	exportedData, err := os.ReadFile(exportPath)
	if err != nil || string(exportedData) != testContent {
		t.Fatalf("Exported content mismatch: %s", string(exportedData))
	}

	// Test DeleteFile
	if err := sm.DeleteFile(storageName); err != nil {
		t.Fatalf("DeleteFile failed: %v", err)
	}
	if _, err := os.Stat(fullPath); !os.IsNotExist(err) {
		t.Fatalf("File should have been deleted from disk")
	}

	// Test SaveTextContent for Markdown
	mdContent := "# Titolo Appunti\n\n- Punto 1\n- Punto 2\n"
	mdStorageName, mdSize, mdMime, err := sm.SaveTextContent("appunti.md", mdContent)
	if err != nil {
		t.Fatalf("SaveTextContent failed: %v", err)
	}
	if mdSize != int64(len(mdContent)) {
		t.Fatalf("Expected mdSize %d, got %d", len(mdContent), mdSize)
	}
	if mdMime != "text/markdown" {
		t.Fatalf("Expected text/markdown, got %s", mdMime)
	}

	// Test ReadTextContent
	readContent, err := sm.ReadTextContent(mdStorageName)
	if err != nil {
		t.Fatalf("ReadTextContent failed: %v", err)
	}
	if readContent != mdContent {
		t.Fatalf("Expected content %q, got %q", mdContent, readContent)
	}

	// Test UpdateTextContent
	updatedMd := "# Titolo Modificato\n\n- Nuovo punto\n"
	updatedSize, err := sm.UpdateTextContent(mdStorageName, updatedMd)
	if err != nil {
		t.Fatalf("UpdateTextContent failed: %v", err)
	}
	if updatedSize != int64(len(updatedMd)) {
		t.Fatalf("Expected updated size %d, got %d", len(updatedMd), updatedSize)
	}

	readUpdated, err := sm.ReadTextContent(mdStorageName)
	if err != nil || readUpdated != updatedMd {
		t.Fatalf("Expected updated content %q, got %q", updatedMd, readUpdated)
	}
}

