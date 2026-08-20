package storage

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// StorageManager manages physical file operations in EduDrive
type StorageManager struct {
	BaseDir string
}

// NewStorageManager initializes the storage directory
func NewStorageManager(baseDir string) (*StorageManager, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory %s: %w", baseDir, err)
	}
	return &StorageManager{BaseDir: baseDir}, nil
}

// DetectMimeType determines MIME type from extension and file header
func DetectMimeType(filename string, headerBytes []byte) string {
	ext := strings.ToLower(filepath.Ext(filename))
	
	// Custom common extension overrides
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".doc":
		return "application/msword"
	case ".xls":
		return "application/vnd.ms-excel"
	case ".ppt":
		return "application/vnd.ms-powerpoint"
	case ".zip":
		return "application/zip"
	case ".rar":
		return "application/x-rar-compressed"
	case ".7z":
		return "application/x-7z-compressed"
	case ".tar":
		return "application/x-tar"
	case ".gz":
		return "application/gzip"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".mp4":
		return "video/mp4"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".webp":
		return "image/webp"
	case ".txt":
		return "text/plain"
	case ".md":
		return "text/markdown"
	case ".json":
		return "application/json"
	case ".csv":
		return "text/csv"
	case ".js", ".ts", ".jsx", ".tsx", ".go", ".py", ".html", ".css", ".java", ".c", ".cpp":
		return "text/plain"
	}

	mimeType := mime.TypeByExtension(ext)
	if mimeType != "" {
		return strings.Split(mimeType, ";")[0]
	}

	if len(headerBytes) > 0 {
		detected := http.DetectContentType(headerBytes)
		return strings.Split(detected, ";")[0]
	}

	return "application/octet-stream"
}

// SaveFile copies a file from sourcePath to the storage directory with a unique UUID filename
func (sm *StorageManager) SaveFile(sourcePath string) (storageFilename string, size int64, mimeType string, err error) {
	src, err := os.Open(sourcePath)
	if err != nil {
		return "", 0, "", fmt.Errorf("failed to open source file %s: %w", sourcePath, err)
	}
	defer src.Close()

	fileInfo, err := src.Stat()
	if err != nil {
		return "", 0, "", fmt.Errorf("failed to stat source file %s: %w", sourcePath, err)
	}

	ext := filepath.Ext(sourcePath)
	storageFilename = fmt.Sprintf("%s%s", uuid.New().String(), ext)
	destPath := filepath.Join(sm.BaseDir, storageFilename)

	dest, err := os.Create(destPath)
	if err != nil {
		return "", 0, "", fmt.Errorf("failed to create storage destination %s: %w", destPath, err)
	}
	defer dest.Close()

	// Read first 512 bytes for MIME detection
	headerBuf := make([]byte, 512)
	n, _ := src.Read(headerBuf)
	mimeType = DetectMimeType(sourcePath, headerBuf[:n])

	// Reset src to beginning
	if _, err := src.Seek(0, 0); err != nil {
		return "", 0, "", fmt.Errorf("failed to seek source file: %w", err)
	}

	copiedBytes, err := io.Copy(dest, src)
	if err != nil {
		os.Remove(destPath)
		return "", 0, "", fmt.Errorf("failed to copy file contents: %w", err)
	}

	if copiedBytes != fileInfo.Size() {
		size = copiedBytes
	} else {
		size = fileInfo.Size()
	}

	return storageFilename, size, mimeType, nil
}

// GetFullPath returns the absolute path of a stored file
func (sm *StorageManager) GetFullPath(storageFilename string) string {
	if storageFilename == "" {
		return ""
	}
	return filepath.Join(sm.BaseDir, storageFilename)
}

// DeleteFile physically deletes a file from the storage directory
func (sm *StorageManager) DeleteFile(storageFilename string) error {
	if storageFilename == "" {
		return nil
	}
	fullPath := filepath.Join(sm.BaseDir, storageFilename)
	if _, err := os.Stat(fullPath); err == nil {
		return os.Remove(fullPath)
	}
	return nil
}

// ExportFile copies a stored file to a destination path
func (sm *StorageManager) ExportFile(storageFilename string, destinationPath string) error {
	sourcePath := filepath.Join(sm.BaseDir, storageFilename)
	src, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("failed to open source storage file: %w", err)
	}
	defer src.Close()

	dest, err := os.Create(destinationPath)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dest.Close()

	if _, err := io.Copy(dest, src); err != nil {
		return fmt.Errorf("failed to copy file during export: %w", err)
	}

	return nil
}
