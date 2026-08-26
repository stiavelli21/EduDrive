package converter

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ConvertDocument converts a supported document file (.pdf, .docx, .doc, .txt) to Markdown
func ConvertDocument(filePath string) (string, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return "", fmt.Errorf("file not found: %w", err)
	}

	if fileInfo.IsDir() {
		return "", fmt.Errorf("cannot convert directory to markdown")
	}

	ext := strings.ToLower(filepath.Ext(filePath))

	switch ext {
	case ".docx":
		zr, err := zip.OpenReader(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to open docx archive: %w", err)
		}
		defer zr.Close()

		c := NewDocxConverter(&zr.Reader)
		return c.Convert()

	case ".pdf":
		return "", fmt.Errorf("la conversione da PDF a Markdown non è supportata")

	case ".txt", ".md", ".markdown", ".csv", ".json", ".xml", ".html", ".log":
		// Direct text content reading
		content, err := os.ReadFile(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to read text file: %w", err)
		}
		return string(content), nil

	case ".doc":
		// Legacy binary DOC format: extract clean ASCII / UTF-8 strings
		content, err := os.ReadFile(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to read doc file: %w", err)
		}
		return extractStringsFromBinary(content), nil

	default:
		return "", fmt.Errorf("unsupported file format %s for markdown conversion", ext)
	}
}

// extractStringsFromBinary extracts printable string sequences from legacy binary files
func extractStringsFromBinary(data []byte) string {
	var sb strings.Builder
	var current strings.Builder

	for _, b := range data {
		if (b >= 32 && b <= 126) || b == '\n' || b == '\t' || b == '\r' {
			current.WriteByte(b)
		} else {
			if current.Len() >= 4 {
				str := strings.TrimSpace(current.String())
				if str != "" {
					sb.WriteString(str)
					sb.WriteString("\n\n")
				}
			}
			current.Reset()
		}
	}

	if current.Len() >= 4 {
		str := strings.TrimSpace(current.String())
		if str != "" {
			sb.WriteString(str)
		}
	}

	return cleanMarkdown(sb.String())
}
