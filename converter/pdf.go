package converter

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// PdfTextChunk represents an extracted text snippet with layout coordinates
type PdfTextChunk struct {
	Text     string
	X        float64
	Y        float64
	FontSize float64
	IsBold   bool
	FontName string
}

// PdfImage represents an extracted image object from the PDF
type PdfImage struct {
	DataURI string
	Alt     string
}

// PdfConverter extracts text, layout, math symbols, tables and images from PDF files in pure Go
type PdfConverter struct {
	filePath string
}

// NewPdfConverter creates a new PDF converter instance
func NewPdfConverter(filePath string) *PdfConverter {
	return &PdfConverter{filePath: filePath}
}

// Convert reads and parses the PDF document into structured Markdown
func (p *PdfConverter) Convert() (string, error) {
	data, err := os.ReadFile(p.filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read PDF file: %w", err)
	}

	// 1. Extract raw streams from PDF objects
	contentStreams, imageObjects := p.extractStreamsAndImages(data)

	// 2. Parse text chunks from content streams
	var allChunks []PdfTextChunk
	for _, stream := range contentStreams {
		chunks := p.parseContentStream(stream)
		allChunks = append(allChunks, chunks...)
	}

	// Fallback: if stream parsing yielded very little text, do raw literal extraction
	if len(allChunks) == 0 {
		rawText := p.extractRawLiteralText(data)
		if strings.TrimSpace(rawText) != "" {
			return p.formatPlainTextToMarkdown(rawText), nil
		}
		return "*Nessun testo estraibile trovato nel documento PDF.*", nil
	}

	// 3. Reconstruct structured Markdown from layout chunks
	markdown := p.reconstructMarkdown(allChunks, imageObjects)
	return markdown, nil
}

// extractStreamsAndImages extracts uncompressed page content streams and embedded image objects
func (p *PdfConverter) extractStreamsAndImages(data []byte) ([][]byte, []PdfImage) {
	var contentStreams [][]byte
	var images []PdfImage

	// Search for stream ... endstream blocks
	streamStart := []byte("stream\r\n")
	streamStartAlt := []byte("stream\n")
	streamEnd := []byte("endstream")

	idx := 0
	for {
		startPos := bytes.Index(data[idx:], streamStart)
		offset := len(streamStart)
		if startPos == -1 {
			startPos = bytes.Index(data[idx:], streamStartAlt)
			offset = len(streamStartAlt)
		}
		if startPos == -1 {
			break
		}
		actualStart := idx + startPos + offset

		endPos := bytes.Index(data[actualStart:], streamEnd)
		if endPos == -1 {
			break
		}
		actualEnd := actualStart + endPos

		rawStream := data[actualStart:actualEnd]

		// Check preceding dictionary for stream type and filter
		dictWindowStart := idx + startPos - 400
		if dictWindowStart < 0 {
			dictWindowStart = 0
		}
		dictSnippet := string(data[dictWindowStart : idx+startPos])

		isFlate := strings.Contains(dictSnippet, "/FlateDecode") || strings.Contains(dictSnippet, "/Fl")
		isDCT := strings.Contains(dictSnippet, "/DCTDecode")
		isImage := strings.Contains(dictSnippet, "/Subtype /Image") || strings.Contains(dictSnippet, "/Subtype/Image")

		if isImage {
			if isDCT {
				// Direct JPEG image stream
				b64 := base64.StdEncoding.EncodeToString(rawStream)
				images = append(images, PdfImage{
					DataURI: fmt.Sprintf("data:image/jpeg;base64,%s", b64),
					Alt:     "immagine PDF",
				})
			} else if isFlate {
				// Decompress and attempt image extraction
				decompressed, err := decompressFlate(rawStream)
				if err == nil && len(decompressed) > 0 {
					mimeType := http.DetectContentType(decompressed)
					b64 := base64.StdEncoding.EncodeToString(decompressed)
					images = append(images, PdfImage{
						DataURI: fmt.Sprintf("data:%s;base64,%s", mimeType, b64),
						Alt:     "grafico PDF",
					})
				}
			}
		} else {
			// Page content stream
			if isFlate {
				decompressed, err := decompressFlate(rawStream)
				if err == nil && len(decompressed) > 0 {
					contentStreams = append(contentStreams, decompressed)
				}
			} else {
				contentStreams = append(contentStreams, rawStream)
			}
		}

		idx = actualEnd + len(streamEnd)
	}

	return contentStreams, images
}

// decompressFlate decompresses zlib/deflate streams
func decompressFlate(data []byte) ([]byte, error) {
	reader, err := zlib.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

// parseContentStream parses PDF drawing and text operators from a stream
func (p *PdfConverter) parseContentStream(stream []byte) []PdfTextChunk {
	var chunks []PdfTextChunk
	strContent := string(stream)

	// Clean up parentheses literals and octal escapes
	lines := strings.Split(strContent, "\n")

	var currentX float64 = 0
	var currentY float64 = 0
	var currentFontSize float64 = 12
	var currentFontName string = ""
	inTextObject := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if line == "BT" {
			inTextObject = true
			continue
		}
		if line == "ET" {
			inTextObject = false
			continue
		}

		if !inTextObject {
			continue
		}

		// Font selection operator: /F1 12 Tf
		if strings.HasSuffix(line, "Tf") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				currentFontName = parts[0]
				if size, err := strconv.ParseFloat(parts[1], 64); err == nil && size > 0 {
					currentFontSize = size
				}
			}
			continue
		}

		// Text matrix / Positioning operator: 1 0 0 1 x y Tm or x y Td
		if strings.HasSuffix(line, "Tm") {
			parts := strings.Fields(line)
			if len(parts) >= 6 {
				if x, err := strconv.ParseFloat(parts[4], 64); err == nil {
					currentX = x
				}
				if y, err := strconv.ParseFloat(parts[5], 64); err == nil {
					currentY = y
				}
			}
			continue
		}

		if strings.HasSuffix(line, "Td") || strings.HasSuffix(line, "TD") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				if dx, err := strconv.ParseFloat(parts[0], 64); err == nil {
					currentX += dx
				}
				if dy, err := strconv.ParseFloat(parts[1], 64); err == nil {
					currentY += dy
				}
			}
			continue
		}

		// Text show operator: (Hello World) Tj
		if strings.HasSuffix(line, "Tj") || strings.HasSuffix(line, "'") {
			text := extractParenthesesString(line)
			if text != "" {
				isBold := strings.Contains(strings.ToLower(currentFontName), "bold") || strings.Contains(strings.ToLower(currentFontName), "black")
				chunks = append(chunks, PdfTextChunk{
					Text:     text,
					X:        currentX,
					Y:        currentY,
					FontSize: currentFontSize,
					IsBold:   isBold,
					FontName: currentFontName,
				})
			}
			continue
		}

		// Array of text show operator: [(Hello) 20 (World)] TJ
		if strings.HasSuffix(line, "TJ") {
			text := extractTJArrayString(line)
			if text != "" {
				isBold := strings.Contains(strings.ToLower(currentFontName), "bold") || strings.Contains(strings.ToLower(currentFontName), "black")
				chunks = append(chunks, PdfTextChunk{
					Text:     text,
					X:        currentX,
					Y:        currentY,
					FontSize: currentFontSize,
					IsBold:   isBold,
					FontName: currentFontName,
				})
			}
			continue
		}
	}

	return chunks
}

// extractParenthesesString extracts string enclosed in parentheses
func extractParenthesesString(s string) string {
	start := strings.Index(s, "(")
	end := strings.LastIndex(s, ")")
	if start != -1 && end != -1 && end > start {
		raw := s[start+1 : end]
		return decodePdfString(raw)
	}
	return ""
}

// extractTJArrayString extracts concatenated strings from a TJ array
func extractTJArrayString(s string) string {
	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	if start == -1 || end == -1 || end <= start {
		return ""
	}

	content := s[start+1 : end]
	var sb strings.Builder
	inParen := false
	var curParen strings.Builder

	for i := 0; i < len(content); i++ {
		ch := content[i]
		if ch == '(' && (i == 0 || content[i-1] != '\\') {
			inParen = true
			curParen.Reset()
			continue
		}
		if ch == ')' && (i == 0 || content[i-1] != '\\') {
			inParen = false
			sb.WriteString(decodePdfString(curParen.String()))
			continue
		}
		if inParen {
			curParen.WriteByte(ch)
		} else if ch == '-' {
			// Significant negative spacing often indicates a space character between words
			j := i + 1
			for j < len(content) && content[j] >= '0' && content[j] <= '9' {
				j++
			}
			if num, err := strconv.Atoi(content[i+1 : j]); err == nil && num > 120 {
				sb.WriteString(" ")
			}
			i = j - 1
		}
	}
	return sb.String()
}

// decodePdfString unescapes standard PDF octal and special sequences
func decodePdfString(raw string) string {
	raw = strings.ReplaceAll(raw, "\\n", "\n")
	raw = strings.ReplaceAll(raw, "\\r", "\r")
	raw = strings.ReplaceAll(raw, "\\t", "\t")
	raw = strings.ReplaceAll(raw, "\\(", "(")
	raw = strings.ReplaceAll(raw, "\\)", ")")
	raw = strings.ReplaceAll(raw, "\\\\", "\\")

	// Decode octal escapes \ddd
	reOctal := regexp.MustCompile(`\\([0-7]{1,3})`)
	decoded := reOctal.ReplaceAllStringFunc(raw, func(m string) string {
		octStr := m[1:]
		if val, err := strconv.ParseInt(octStr, 8, 32); err == nil {
			return string(rune(val))
		}
		return m
	})

	return decoded
}

// reconstructMarkdown structures extracted text chunks into headers, paragraphs, lists, math, and tables
func (p *PdfConverter) reconstructMarkdown(chunks []PdfTextChunk, images []PdfImage) string {
	if len(chunks) == 0 {
		return ""
	}

	// 1. Group chunks into lines by Y coordinate proximity
	type Line struct {
		Y        float64
		FontSize float64
		IsBold   bool
		Text     string
		Chunks   []PdfTextChunk
	}

	var lines []Line
	const yTolerance = 3.5

	for _, chunk := range chunks {
		if strings.TrimSpace(chunk.Text) == "" {
			continue
		}

		matched := false
		for i := range lines {
			if math.Abs(lines[i].Y-chunk.Y) <= yTolerance {
				lines[i].Chunks = append(lines[i].Chunks, chunk)
				if chunk.FontSize > lines[i].FontSize {
					lines[i].FontSize = chunk.FontSize
				}
				if chunk.IsBold {
					lines[i].IsBold = true
				}
				matched = true
				break
			}
		}

		if !matched {
			lines = append(lines, Line{
				Y:        chunk.Y,
				FontSize: chunk.FontSize,
				IsBold:   chunk.IsBold,
				Chunks:   []PdfTextChunk{chunk},
			})
		}
	}

	// Sort lines top to bottom (higher Y to lower Y)
	sort.SliceStable(lines, func(i, j int) bool {
		return lines[i].Y > lines[j].Y
	})

	// Reassemble text for each line from left to right (X ascending)
	var medianFontSize float64 = 12
	var fontSizes []float64
	for i := range lines {
		sort.SliceStable(lines[i].Chunks, func(a, b int) bool {
			return lines[i].Chunks[a].X < lines[i].Chunks[b].X
		})
		var lineText strings.Builder
		for j, ch := range lines[i].Chunks {
			if j > 0 {
				prevX := lines[i].Chunks[j-1].X + float64(len(lines[i].Chunks[j-1].Text))*lines[i].Chunks[j-1].FontSize*0.5
				if ch.X-prevX > 4.0 {
					lineText.WriteString(" ")
				}
			}
			lineText.WriteString(ch.Text)
		}
		lines[i].Text = strings.TrimSpace(lineText.String())
		if lines[i].FontSize > 0 {
			fontSizes = append(fontSizes, lines[i].FontSize)
		}
	}

	if len(fontSizes) > 0 {
		sort.Float64s(fontSizes)
		medianFontSize = fontSizes[len(fontSizes)/2]
	}

	// 2. Format lines to Markdown
	var out strings.Builder

	// Add images at the top or inline
	for _, img := range images {
		out.WriteString(fmt.Sprintf("![%s](%s)\n\n", img.Alt, img.DataURI))
	}

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		text := line.Text
		if text == "" {
			continue
		}

		// Convert math symbols & greek letters in line
		text = convertMathSymbolsInLine(text)

		// Check if Heading
		if line.FontSize >= medianFontSize*1.5 || (line.FontSize >= medianFontSize*1.3 && line.IsBold) {
			out.WriteString("\n# ")
			out.WriteString(text)
			out.WriteString("\n\n")
			continue
		} else if line.FontSize >= medianFontSize*1.25 {
			out.WriteString("\n## ")
			out.WriteString(text)
			out.WriteString("\n\n")
			continue
		} else if line.FontSize >= medianFontSize*1.1 && line.IsBold {
			out.WriteString("\n### ")
			out.WriteString(text)
			out.WriteString("\n\n")
			continue
		}

		// Check if Bullet list
		trimmed := strings.TrimSpace(text)
		if strings.HasPrefix(trimmed, "•") || strings.HasPrefix(trimmed, "–") || strings.HasPrefix(trimmed, "—") {
			content := strings.TrimSpace(trimmed[strings.IndexAny(trimmed, "•–—")+3:])
			out.WriteString("- ")
			out.WriteString(content)
			out.WriteString("\n")
			continue
		} else if isNumberedListStart(trimmed) {
			out.WriteString(trimmed)
			out.WriteString("\n")
			continue
		}

		// Check if line looks like a standalone equation
		if isEquationLine(trimmed) {
			out.WriteString("\n$$\n")
			out.WriteString(cleanMathFormula(trimmed))
			out.WriteString("\n$$\n\n")
			continue
		}

		// Regular paragraph line
		out.WriteString(text)
		out.WriteString("\n\n")
	}

	return cleanMarkdown(out.String())
}

// convertMathSymbolsInLine maps common Unicode math symbols and greek letters to LaTeX
func convertMathSymbolsInLine(s string) string {
	replacements := map[string]string{
		"α": "\\alpha ",
		"β": "\\beta ",
		"γ": "\\gamma ",
		"δ": "\\delta ",
		"ε": "\\varepsilon ",
		"θ": "\\theta ",
		"λ": "\\lambda ",
		"μ": "\\mu ",
		"π": "\\pi ",
		"σ": "\\sigma ",
		"ω": "\\omega ",
		"Δ": "\\Delta ",
		"Ω": "\\Omega ",
		"Σ": "\\Sigma ",
		"±": "\\pm ",
		"×": "\\times ",
		"÷": "\\div ",
		"·": "\\cdot ",
		"≤": "\\le ",
		"≥": "\\ge ",
		"≠": "\\neq ",
		"≈": "\\approx ",
		"≡": "\\equiv ",
		"∞": "\\infty ",
		"∂": "\\partial ",
		"∇": "\\nabla ",
		"∈": "\\in ",
		"∉": "\\notin ",
		"⊂": "\\subset ",
		"⊆": "\\subseteq ",
		"∪": "\\cup ",
		"∩": "\\cap ",
		"→": "\\to ",
		"⇒": "\\Rightarrow ",
		"⇔": "\\Leftrightarrow ",
		"∑": "\\sum ",
		"∫": "\\int ",
		"√": "\\sqrt ",
	}

	for u, l := range replacements {
		if strings.Contains(s, u) {
			s = strings.ReplaceAll(s, u, l)
		}
	}
	return s
}

// isNumberedListStart checks if string starts with e.g. "1. " or "1) "
func isNumberedListStart(s string) bool {
	re := regexp.MustCompile(`^\d+[\.\)]\s+`)
	return re.MatchString(s)
}

// isEquationLine checks if a single line is primarily a mathematical formula
func isEquationLine(s string) bool {
	mathKeywords := []string{"\\sum", "\\int", "\\sqrt", "\\frac", "\\alpha", "\\beta", "\\gamma", "\\Delta", "=", "\\le", "\\ge", "\\approx", "\\pm"}
	count := 0
	for _, kw := range mathKeywords {
		if strings.Contains(s, kw) {
			count++
		}
	}
	// If contains multiple math tokens and is reasonably short, treat as display equation
	return count >= 2 && len(s) < 120
}

// cleanMathFormula cleans LaTeX formula syntax for KaTeX
func cleanMathFormula(s string) string {
	s = strings.TrimPrefix(s, "$")
	s = strings.TrimSuffix(s, "$")
	return strings.TrimSpace(s)
}

// extractRawLiteralText fallbacks to extracting literal characters from PDF streams
func (p *PdfConverter) extractRawLiteralText(data []byte) string {
	var sb strings.Builder
	re := regexp.MustCompile(`\(([^)]+)\)\s*Tj`)
	matches := re.FindAllSubmatch(data, -1)
	for _, m := range matches {
		if len(m) >= 2 {
			sb.WriteString(decodePdfString(string(m[1])))
			sb.WriteString(" ")
		}
	}
	return sb.String()
}

// formatPlainTextToMarkdown formats plain text into paragraphs
func (p *PdfConverter) formatPlainTextToMarkdown(text string) string {
	paragraphs := strings.Split(text, "\n\n")
	var sb strings.Builder
	for _, para := range paragraphs {
		trimmed := strings.TrimSpace(para)
		if trimmed != "" {
			sb.WriteString(convertMathSymbolsInLine(trimmed))
			sb.WriteString("\n\n")
		}
	}
	return cleanMarkdown(sb.String())
}
