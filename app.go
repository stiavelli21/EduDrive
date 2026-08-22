package main

import (
	"context"
	_ "embed"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"EduDrive/db"
	"EduDrive/models"
	"EduDrive/storage"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed README.md
var defaultReadmeContent string

// App struct
type App struct {
	ctx      context.Context
	database *db.Database
	storage  *storage.StorageManager
	dataDir  string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Determine data directory
	userConfigDir, err := os.UserConfigDir()
	if err != nil || userConfigDir == "" {
		userConfigDir = "."
	}
	a.dataDir = filepath.Join(userConfigDir, "EduDrive")
	if err := os.MkdirAll(a.dataDir, 0755); err != nil {
		a.dataDir = "./edudrive_data"
		_ = os.MkdirAll(a.dataDir, 0755)
	}

	// Initialize Database
	dbPath := filepath.Join(a.dataDir, "edudrive.db")
	database, err := db.InitDB(dbPath)
	if err != nil {
		wailsRuntime.LogErrorf(a.ctx, "Failed to initialize DB: %v", err)
	}
	a.database = database

	// Initialize Storage
	storageDir := filepath.Join(a.dataDir, "storage_data")
	storageMgr, err := storage.NewStorageManager(storageDir)
	if err != nil {
		wailsRuntime.LogErrorf(a.ctx, "Failed to initialize storage: %v", err)
	}
	a.storage = storageMgr

	// Seed default items on first launch
	a.seedInitialData()
}

// seedInitialData populates initial files and documents on first app launch
func (a *App) seedInitialData() {
	if a.database == nil || a.storage == nil {
		return
	}

	seeded, err := a.database.GetSetting("initial_seed_completed")
	if err != nil {
		wailsRuntime.LogErrorf(a.ctx, "Failed to check initial seed status: %v", err)
		return
	}

	if seeded == "1" {
		return
	}

	// Create default README.md in root directory if content is available
	if strings.TrimSpace(defaultReadmeContent) != "" {
		_, err := a.CreateMarkdownFile("README.md", defaultReadmeContent, "")
		if err != nil {
			wailsRuntime.LogErrorf(a.ctx, "Failed to create default README.md: %v", err)
		}
	}

	if err := a.database.SetSetting("initial_seed_completed", "1"); err != nil {
		wailsRuntime.LogErrorf(a.ctx, "Failed to update seed status: %v", err)
	}
}

// shutdown is called when the app terminates
func (a *App) shutdown(ctx context.Context) {
	if a.database != nil {
		_ = a.database.Close()
	}
}

// ListItems retrieves files and folders based on parentID and viewMode
func (a *App) ListItems(parentID string, viewMode string) ([]models.Item, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	switch strings.ToLower(viewMode) {
	case "trash":
		return a.database.GetTrashItems()
	case "recent":
		return a.database.GetRecentItems(50)
	default:
		return a.database.GetItemsByParentID(parentID)
	}
}

// GetBreadcrumbs returns folder navigation breadcrumbs
func (a *App) GetBreadcrumbs(folderID string) ([]models.Breadcrumb, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.database.GetBreadcrumbs(folderID)
}

// CreateFolder creates a new virtual folder in the DB
func (a *App) CreateFolder(name string, parentID string) (*models.Item, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		trimmedName = "Nuova cartella"
	}

	item := &models.Item{
		ID:        uuid.New().String(),
		Name:      trimmedName,
		IsFolder:  true,
		SizeBytes: 0,
		MimeType:  "folder",
		IsTrash:   false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if parentID != "" {
		item.ParentID = &parentID
	}

	if err := a.database.InsertItem(item); err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	return item, nil
}

// CreateWebLink creates a new web link / bookmark item
func (a *App) CreateWebLink(name string, targetURL string, parentID string) (*models.Item, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	trimmedURL := strings.TrimSpace(targetURL)
	if trimmedURL == "" {
		return nil, fmt.Errorf("URL cannot be empty")
	}

	// Normalize URL: prepend https:// if protocol is missing
	if !strings.HasPrefix(strings.ToLower(trimmedURL), "http://") && !strings.HasPrefix(strings.ToLower(trimmedURL), "https://") {
		trimmedURL = "https://" + trimmedURL
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		trimmedName = trimmedURL
	}

	item := &models.Item{
		ID:          uuid.New().String(),
		Name:        trimmedName,
		IsFolder:    false,
		SizeBytes:   int64(len(trimmedURL)),
		MimeType:    "url",
		StoragePath: trimmedURL,
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if parentID != "" {
		item.ParentID = &parentID
	}

	if err := a.database.InsertItem(item); err != nil {
		return nil, fmt.Errorf("failed to create web link: %w", err)
	}

	return item, nil
}

// ImportFiles opens native file dialog to import one or multiple files
func (a *App) ImportFiles(parentID string) ([]models.Item, error) {
	if a.database == nil || a.storage == nil {
		return nil, fmt.Errorf("services not initialized")
	}

	filePaths, err := wailsRuntime.OpenMultipleFilesDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Seleziona file da importare in EduDrive",
	})
	if err != nil {
		return nil, fmt.Errorf("file dialog error: %w", err)
	}

	if len(filePaths) == 0 {
		return []models.Item{}, nil
	}

	importedItems := make([]models.Item, 0, len(filePaths))
	for _, filePath := range filePaths {
		item, err := a.ImportFileByPath(filePath, parentID)
		if err != nil {
			wailsRuntime.LogWarningf(a.ctx, "Failed to import file %s: %v", filePath, err)
			continue
		}
		if item != nil {
			importedItems = append(importedItems, *item)
		}
	}

	return importedItems, nil
}

// ImportFileByPath imports a specific local file path (supports Drag & Drop)
func (a *App) ImportFileByPath(filePath string, parentID string) (*models.Item, error) {
	if a.database == nil || a.storage == nil {
		return nil, fmt.Errorf("services not initialized")
	}

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("invalid file path: %w", err)
	}

	// Ignore directories in simple file import
	if fileInfo.IsDir() {
		return nil, fmt.Errorf("direct folder drag-and-drop import not supported; please create a folder first")
	}

	storageFilename, size, mimeType, err := a.storage.SaveFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to save file to storage: %w", err)
	}

	originalName := filepath.Base(filePath)
	item := &models.Item{
		ID:          uuid.New().String(),
		Name:        originalName,
		IsFolder:    false,
		SizeBytes:   size,
		MimeType:    mimeType,
		StoragePath: storageFilename,
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if parentID != "" {
		item.ParentID = &parentID
	}

	if err := a.database.InsertItem(item); err != nil {
		_ = a.storage.DeleteFile(storageFilename)
		return nil, fmt.Errorf("failed to record file in database: %w", err)
	}

	return item, nil
}

// SaveFileFromBase64 saves binary data from webview drag & drop
func (a *App) SaveFileFromBase64(name string, base64Data string, parentID string) (*models.Item, error) {
	if a.database == nil || a.storage == nil {
		return nil, fmt.Errorf("services not initialized")
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("invalid base64: %w", err)
	}

	ext := filepath.Ext(name)
	storageFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	destPath := filepath.Join(a.storage.BaseDir, storageFilename)

	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	headerBuf := data
	if len(headerBuf) > 512 {
		headerBuf = headerBuf[:512]
	}
	mimeType := storage.DetectMimeType(name, headerBuf)

	item := &models.Item{
		ID:          uuid.New().String(),
		Name:        name,
		IsFolder:    false,
		SizeBytes:   int64(len(data)),
		MimeType:    mimeType,
		StoragePath: storageFilename,
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if parentID != "" {
		item.ParentID = &parentID
	}

	if err := a.database.InsertItem(item); err != nil {
		_ = a.storage.DeleteFile(storageFilename)
		return nil, fmt.Errorf("failed to save to database: %w", err)
	}

	return item, nil
}

// CreateMarkdownFile creates a new markdown document directly inside EduDrive
func (a *App) CreateMarkdownFile(name string, content string, parentID string) (*models.Item, error) {
	if a.database == nil || a.storage == nil {
		return nil, fmt.Errorf("services not initialized")
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		trimmedName = "Nuovo documento.md"
	}

	// Ensure .md extension
	if !strings.HasSuffix(strings.ToLower(trimmedName), ".md") && !strings.HasSuffix(strings.ToLower(trimmedName), ".markdown") {
		trimmedName += ".md"
	}

	storageFilename, size, mimeType, err := a.storage.SaveTextContent(trimmedName, content)
	if err != nil {
		return nil, fmt.Errorf("failed to create markdown file on disk: %w", err)
	}

	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = "text/markdown"
	}

	item := &models.Item{
		ID:          uuid.New().String(),
		Name:        trimmedName,
		IsFolder:    false,
		SizeBytes:   size,
		MimeType:    mimeType,
		StoragePath: storageFilename,
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if parentID != "" {
		item.ParentID = &parentID
	}

	if err := a.database.InsertItem(item); err != nil {
		_ = a.storage.DeleteFile(storageFilename)
		return nil, fmt.Errorf("failed to record markdown file in database: %w", err)
	}

	return item, nil
}

// GetFileContent retrieves the text content of a stored file (for Markdown reader / editor)
func (a *App) GetFileContent(id string) (string, error) {
	if a.database == nil || a.storage == nil {
		return "", fmt.Errorf("services not initialized")
	}

	item, err := a.database.GetItemByID(id)
	if err != nil || item == nil {
		return "", fmt.Errorf("file not found")
	}

	if item.IsFolder {
		return "", fmt.Errorf("cannot read contents of a folder")
	}

	if item.MimeType == "url" {
		return item.StoragePath, nil
	}

	if item.StoragePath == "" {
		return "", fmt.Errorf("file has no storage path")
	}

	return a.storage.ReadTextContent(item.StoragePath)
}

// SaveMarkdownFile updates the content of an existing markdown file and synchronizes DB metadata
func (a *App) SaveMarkdownFile(id string, content string) error {
	if a.database == nil || a.storage == nil {
		return fmt.Errorf("services not initialized")
	}

	item, err := a.database.GetItemByID(id)
	if err != nil || item == nil {
		return fmt.Errorf("file not found")
	}

	if item.IsFolder {
		return fmt.Errorf("cannot modify folder content")
	}

	if item.MimeType == "url" {
		return fmt.Errorf("cannot edit web link as markdown")
	}

	newSize, err := a.storage.UpdateTextContent(item.StoragePath, content)
	if err != nil {
		return fmt.Errorf("failed to update file on disk: %w", err)
	}

	if err := a.database.UpdateItemSizeAndTimestamp(id, newSize); err != nil {
		return fmt.Errorf("failed to update database metadata: %w", err)
	}

	return nil
}


// ExportFile lets the user choose a destination and saves a copy of the stored file or .url shortcut
func (a *App) ExportFile(id string) error {
	if a.database == nil || a.storage == nil {
		return fmt.Errorf("services not initialized")
	}

	item, err := a.database.GetItemByID(id)
	if err != nil || item == nil {
		return fmt.Errorf("file not found")
	}

	if item.IsFolder {
		return fmt.Errorf("cannot export folder directly")
	}

	// If the item is a web link, export as a Windows Internet Shortcut (.url)
	if item.MimeType == "url" || strings.HasPrefix(item.StoragePath, "http://") || strings.HasPrefix(item.StoragePath, "https://") {
		defaultFilename := item.Name
		if !strings.HasSuffix(strings.ToLower(defaultFilename), ".url") {
			defaultFilename += ".url"
		}
		destinationPath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
			Title:           "Esporta collegamento web",
			DefaultFilename: defaultFilename,
		})
		if err != nil {
			return err
		}
		if destinationPath == "" {
			return nil // User cancelled
		}
		shortcutContent := fmt.Sprintf("[InternetShortcut]\r\nURL=%s\r\n", item.StoragePath)
		return os.WriteFile(destinationPath, []byte(shortcutContent), 0644)
	}

	destinationPath, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "Esporta file da EduDrive",
		DefaultFilename: item.Name,
	})
	if err != nil {
		return err
	}

	if destinationPath == "" {
		return nil // User cancelled
	}

	return a.storage.ExportFile(item.StoragePath, destinationPath)
}

// OpenFileLocally opens the file using the default OS application or default browser for web links
func (a *App) OpenFileLocally(id string) error {
	if a.database == nil || a.storage == nil {
		return fmt.Errorf("services not initialized")
	}

	item, err := a.database.GetItemByID(id)
	if err != nil || item == nil {
		return fmt.Errorf("item not found")
	}

	if item.IsFolder {
		return nil
	}

	// Check if this item is a web link
	if item.MimeType == "url" || strings.HasPrefix(item.StoragePath, "http://") || strings.HasPrefix(item.StoragePath, "https://") {
		wailsRuntime.BrowserOpenURL(a.ctx, item.StoragePath)
		return nil
	}

	fullPath := a.storage.GetFullPath(item.StoragePath)
	if fullPath == "" {
		return fmt.Errorf("storage path is empty")
	}

	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return fmt.Errorf("physical file not found on disk")
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", fullPath)
	case "darwin":
		cmd = exec.Command("open", fullPath)
	default:
		cmd = exec.Command("xdg-open", fullPath)
	}

	return cmd.Start()
}

// RenameItem updates the name of a file or folder
func (a *App) RenameItem(id string, newName string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}

	trimmed := strings.TrimSpace(newName)
	if trimmed == "" {
		return fmt.Errorf("name cannot be empty")
	}

	return a.database.UpdateItemName(id, trimmed)
}

// DeleteItem moves an item to trash or permanently deletes it
func (a *App) DeleteItem(id string, permanent bool) error {
	if a.database == nil || a.storage == nil {
		return fmt.Errorf("services not initialized")
	}

	if permanent {
		deletedItems, err := a.database.DeletePermanent(id)
		if err != nil {
			return err
		}
		// Clean up physical disk files
		for _, item := range deletedItems {
			if !item.IsFolder && item.StoragePath != "" && item.MimeType != "url" {
				_ = a.storage.DeleteFile(item.StoragePath)
			}
		}
		return nil
	}

	return a.database.SetTrashStatus(id, true)
}

// RestoreItem restores an item and all its sub-elements from the trash
func (a *App) RestoreItem(id string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.database.SetTrashStatus(id, false)
}

// EmptyTrash deletes all items in trash and their physical files
func (a *App) EmptyTrash() error {
	if a.database == nil || a.storage == nil {
		return fmt.Errorf("services not initialized")
	}

	deletedItems, err := a.database.EmptyTrash()
	if err != nil {
		return err
	}

	for _, item := range deletedItems {
		if !item.IsFolder && item.StoragePath != "" && item.MimeType != "url" {
			_ = a.storage.DeleteFile(item.StoragePath)
		}
	}

	return nil
}

// SearchItems searches active items matching a query string
func (a *App) SearchItems(query string) ([]models.Item, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []models.Item{}, nil
	}

	return a.database.SearchItems(trimmed)
}

// GetStorageStats retrieves storage statistics
func (a *App) GetStorageStats() (*models.StorageStats, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.database.GetStorageStats()
}

// GetAppStoragePath returns the path where EduDrive data is kept
func (a *App) GetAppStoragePath() string {
	return a.dataDir
}

// CreateExamDate creates and stores a new exam deadline
func (a *App) CreateExamDate(subject string, examDateStr string) (*models.ExamDate, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	trimmedSubject := strings.TrimSpace(subject)
	if trimmedSubject == "" {
		return nil, fmt.Errorf("subject name cannot be empty")
	}

	trimmedDateStr := strings.TrimSpace(examDateStr)
	if trimmedDateStr == "" {
		return nil, fmt.Errorf("exam date cannot be empty")
	}

	// Support standard HTML date picker (YYYY-MM-DD) and RFC3339 formats
	var parsedDate time.Time
	var parseErr error

	formats := []string{
		"2006-01-02",
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}

	for _, layout := range formats {
		parsedDate, parseErr = time.ParseInLocation(layout, trimmedDateStr, time.Local)
		if parseErr == nil {
			break
		}
	}

	if parseErr != nil {
		return nil, fmt.Errorf("invalid date format: %w", parseErr)
	}

	exam := &models.ExamDate{
		ID:        uuid.New().String(),
		Subject:   trimmedSubject,
		ExamDate:  parsedDate,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := a.database.InsertExamDate(exam); err != nil {
		return nil, fmt.Errorf("failed to save exam date: %w", err)
	}

	return exam, nil
}

// ListExamDates returns all registered exam deadlines
func (a *App) ListExamDates() ([]models.ExamDate, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.database.GetExamDates()
}

// DeleteExamDate removes an exam deadline by its ID
func (a *App) DeleteExamDate(id string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.database.DeleteExamDate(id)
}

// ListPassedExams retrieves all passed exams recorded in the student booklet
func (a *App) ListPassedExams() ([]models.PassedExam, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return a.database.GetPassedExams()
}

// CreatePassedExam adds a new passed exam to the booklet with subject, grade, honors, and CFU
func (a *App) CreatePassedExam(subject string, grade int, isHonors bool, cfu int, examDate string) (*models.PassedExam, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	trimmedSubject := strings.TrimSpace(subject)
	if trimmedSubject == "" {
		return nil, fmt.Errorf("subject name cannot be empty")
	}

	if grade < 18 || grade > 30 {
		return nil, fmt.Errorf("grade must be between 18 and 30")
	}

	if isHonors && grade != 30 {
		grade = 30
	}

	if cfu < 1 || cfu > 60 {
		return nil, fmt.Errorf("CFU must be between 1 and 60")
	}

	exam := &models.PassedExam{
		ID:        uuid.New().String(),
		Subject:   trimmedSubject,
		Grade:     grade,
		IsHonors:  isHonors,
		CFU:       cfu,
		ExamDate:  strings.TrimSpace(examDate),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := a.database.InsertPassedExam(exam); err != nil {
		return nil, fmt.Errorf("failed to save passed exam: %w", err)
	}

	return exam, nil
}

// UpdatePassedExam updates an existing passed exam record
func (a *App) UpdatePassedExam(id string, subject string, grade int, isHonors bool, cfu int, examDate string) (*models.PassedExam, error) {
	if a.database == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	trimmedSubject := strings.TrimSpace(subject)
	if trimmedSubject == "" {
		return nil, fmt.Errorf("subject name cannot be empty")
	}

	if grade < 18 || grade > 30 {
		return nil, fmt.Errorf("grade must be between 18 and 30")
	}

	if isHonors && grade != 30 {
		grade = 30
	}

	if cfu < 1 || cfu > 60 {
		return nil, fmt.Errorf("CFU must be between 1 and 60")
	}

	exam := &models.PassedExam{
		ID:        id,
		Subject:   trimmedSubject,
		Grade:     grade,
		IsHonors:  isHonors,
		CFU:       cfu,
		ExamDate:  strings.TrimSpace(examDate),
		UpdatedAt: time.Now(),
	}

	if err := a.database.UpdatePassedExam(exam); err != nil {
		return nil, fmt.Errorf("failed to update passed exam: %w", err)
	}

	return exam, nil
}

// DeletePassedExam removes a passed exam record by its ID
func (a *App) DeletePassedExam(id string) error {
	if a.database == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.database.DeletePassedExam(id)
}


