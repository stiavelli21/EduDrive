package storage

import (
	"net/http"
	"net/http/httptest"
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

	// Test ReadBinaryContent
	binaryData, err := sm.ReadBinaryContent(mdStorageName)
	if err != nil {
		t.Fatalf("ReadBinaryContent failed: %v", err)
	}
	if string(binaryData) != updatedMd {
		t.Fatalf("Expected binary content %q, got %q", updatedMd, string(binaryData))
	}
}

func TestServeStorageFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_http_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storageDir := filepath.Join(tempDir, "storage_data")
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		t.Fatalf("Failed to create storage dir: %v", err)
	}

	testFileName := "testfile.txt"
	testContent := "0123456789HelloEduDriveStreaming"
	if err := os.WriteFile(filepath.Join(storageDir, testFileName), []byte(testContent), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// 1. Successful GET request
	req := httptest.NewRequest("GET", "/storage/"+testFileName, nil)
	rec := httptest.NewRecorder()
	ServeStorageFile(rec, req, storageDir)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", rec.Code)
	}
	if rec.Body.String() != testContent {
		t.Fatalf("Expected body %q, got %q", testContent, rec.Body.String())
	}
	if rec.Header().Get("Content-Type") != "text/plain" {
		t.Fatalf("Expected Content-Type text/plain, got %s", rec.Header().Get("Content-Type"))
	}

	// 2. HTTP Range request (streaming seek)
	rangeReq := httptest.NewRequest("GET", "/storage/"+testFileName, nil)
	rangeReq.Header.Set("Range", "bytes=0-9")
	rangeRec := httptest.NewRecorder()
	ServeStorageFile(rangeRec, rangeReq, storageDir)

	if rangeRec.Code != http.StatusPartialContent {
		t.Fatalf("Expected status 206 for Range request, got %d", rangeRec.Code)
	}
	if rangeRec.Body.String() != "0123456789" {
		t.Fatalf("Expected range bytes '0123456789', got %q", rangeRec.Body.String())
	}

	// 3. Path traversal attack attempt
	traversalReq := httptest.NewRequest("GET", "/storage/../storage_data/"+testFileName, nil)
	traversalRec := httptest.NewRecorder()
	ServeStorageFile(traversalRec, traversalReq, storageDir)
	if traversalRec.Code == http.StatusOK {
		t.Fatalf("Expected error on path traversal attempt, got status 200")
	}

	// 4. Non-existent file
	missingReq := httptest.NewRequest("GET", "/storage/nonexistent.txt", nil)
	missingRec := httptest.NewRecorder()
	ServeStorageFile(missingRec, missingReq, storageDir)
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("Expected status 404 for missing file, got %d", missingRec.Code)
	}

	// 5. Method not allowed
	postReq := httptest.NewRequest("POST", "/storage/"+testFileName, nil)
	postRec := httptest.NewRecorder()
	ServeStorageFile(postRec, postReq, storageDir)
	if postRec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("Expected status 405 for POST request, got %d", postRec.Code)
	}
}


