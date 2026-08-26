package converter

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
)

// Relationships maps relationship IDs to their targets
type Relationships map[string]string

// DocxConverter converts a DOCX file to Markdown
type DocxConverter struct {
	zipReader     *zip.Reader
	relationships Relationships
	mediaFiles    map[string][]byte
}

// NewDocxConverter initializes a new converter from a zip reader
func NewDocxConverter(zr *zip.Reader) *DocxConverter {
	return &DocxConverter{
		zipReader:     zr,
		relationships: make(Relationships),
		mediaFiles:    make(map[string][]byte),
	}
}

// Convert converts the DOCX document into structured Markdown
func (c *DocxConverter) Convert() (string, error) {
	// 1. Read relationships from word/_rels/document.xml.rels
	if err := c.loadRelationships(); err != nil {
		// Non-fatal, proceed with empty relationships
	}

	// 2. Load media files (images) from word/media/
	if err := c.loadMediaFiles(); err != nil {
		// Non-fatal
	}

	// 3. Find and parse word/document.xml
	var docFile *zip.File
	for _, f := range c.zipReader.File {
		if f.Name == "word/document.xml" {
			docFile = f
			break
		}
	}

	if docFile == nil {
		return "", fmt.Errorf("invalid DOCX: word/document.xml not found")
	}

	rc, err := docFile.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open document.xml: %w", err)
	}
	defer rc.Close()

	xmlData, err := io.ReadAll(rc)
	if err != nil {
		return "", fmt.Errorf("failed to read document.xml: %w", err)
	}

	return c.parseDocumentXML(xmlData)
}

// loadRelationships parses word/_rels/document.xml.rels
func (c *DocxConverter) loadRelationships() error {
	var relFile *zip.File
	for _, f := range c.zipReader.File {
		if f.Name == "word/_rels/document.xml.rels" {
			relFile = f
			break
		}
	}
	if relFile == nil {
		return nil
	}

	rc, err := relFile.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	type Rel struct {
		ID     string `xml:"Id,attr"`
		Type   string `xml:"Type,attr"`
		Target string `xml:"Target,attr"`
	}
	type RelsDoc struct {
		Relationships []Rel `xml:"Relationship"`
	}

	var rels RelsDoc
	if err := xml.NewDecoder(rc).Decode(&rels); err != nil {
		return err
	}

	for _, r := range rels.Relationships {
		c.relationships[r.ID] = r.Target
	}
	return nil
}

// loadMediaFiles reads embedded images from the zip archive
func (c *DocxConverter) loadMediaFiles() error {
	for _, f := range c.zipReader.File {
		if strings.HasPrefix(f.Name, "word/media/") {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				continue
			}
			// Store with both full name and relative name (media/...)
			c.mediaFiles[f.Name] = data
			c.mediaFiles[strings.TrimPrefix(f.Name, "word/")] = data
			c.mediaFiles[filepath.Base(f.Name)] = data
		}
	}
	return nil
}

// parseDocumentXML parses the OpenXML body and produces Markdown
func (c *DocxConverter) parseDocumentXML(data []byte) (string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var out strings.Builder

	for {
		token, err := decoder.Token()
		if err != nil {
			if err == io.EOF {
				break
			}
			return "", err
		}

		switch elem := token.(type) {
		case xml.StartElement:
			switch elem.Name.Local {
			case "p":
				// Parse Paragraph
				pText := c.parseParagraph(decoder, &elem)
				if strings.TrimSpace(pText) != "" {
					out.WriteString(pText)
					out.WriteString("\n\n")
				}
			case "tbl":
				// Parse Table
				tblText := c.parseTable(decoder, &elem)
				if strings.TrimSpace(tblText) != "" {
					out.WriteString(tblText)
					out.WriteString("\n\n")
				}
			case "oMathPara":
				// Standalone display math block ($$...$$)
				mathText := c.parseOMath(decoder, &elem)
				if strings.TrimSpace(mathText) != "" {
					out.WriteString("$$\n")
					out.WriteString(strings.TrimSpace(mathText))
					out.WriteString("\n$$\n\n")
				}
			}
		}
	}

	cleanResult := cleanMarkdown(out.String())
	return cleanResult, nil
}

// parseParagraph extracts text, runs, styles, inline math, and images from a paragraph
func (c *DocxConverter) parseParagraph(decoder *xml.Decoder, start *xml.StartElement) string {
	var sb strings.Builder
	var styleName string
	var isBullet bool
	var isNumbered bool
	var listNum string

	depth := 1
	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}

		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			switch elem.Name.Local {
			case "pStyle":
				for _, attr := range elem.Attr {
					if attr.Name.Local == "val" {
						styleName = attr.Value
					}
				}
			case "numPr":
				// Numbered or bullet list property
				isBullet = true
			case "ilvl":
				for _, attr := range elem.Attr {
					if attr.Name.Local == "val" {
						listNum = attr.Value
					}
				}
			case "r":
				runText := c.parseRun(decoder, &elem)
				sb.WriteString(runText)
				depth-- // parseRun consumes its EndElement
			case "hyperlink":
				linkText := c.parseHyperlink(decoder, &elem)
				sb.WriteString(linkText)
				depth--
			case "oMath":
				mathText := c.parseOMath(decoder, &elem)
				if strings.TrimSpace(mathText) != "" {
					sb.WriteString("$")
					sb.WriteString(strings.TrimSpace(mathText))
					sb.WriteString("$")
				}
				depth--
			case "drawing":
				imgMarkdown := c.parseDrawing(decoder, &elem)
				sb.WriteString(imgMarkdown)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	content := strings.TrimSpace(sb.String())
	if content == "" {
		return ""
	}

	// Apply Heading Styles
	lowerStyle := strings.ToLower(styleName)
	switch {
	case strings.Contains(lowerStyle, "heading 1") || strings.Contains(lowerStyle, "heading1") || lowerStyle == "titolo 1" || lowerStyle == "titolo1":
		return "# " + content
	case strings.Contains(lowerStyle, "heading 2") || strings.Contains(lowerStyle, "heading2") || lowerStyle == "titolo 2" || lowerStyle == "titolo2":
		return "## " + content
	case strings.Contains(lowerStyle, "heading 3") || strings.Contains(lowerStyle, "heading3") || lowerStyle == "titolo 3" || lowerStyle == "titolo3":
		return "### " + content
	case strings.Contains(lowerStyle, "heading 4") || strings.Contains(lowerStyle, "heading4") || lowerStyle == "titolo 4" || lowerStyle == "titolo4":
		return "#### " + content
	case strings.Contains(lowerStyle, "heading 5") || strings.Contains(lowerStyle, "heading5"):
		return "##### " + content
	case strings.Contains(lowerStyle, "heading 6") || strings.Contains(lowerStyle, "heading6"):
		return "###### " + content
	case strings.Contains(lowerStyle, "quote") || strings.Contains(lowerStyle, "citazione"):
		return "> " + content
	case isBullet || strings.Contains(lowerStyle, "list"):
		indent := ""
		if listNum == "1" {
			indent = "  "
		} else if listNum == "2" {
			indent = "    "
		}
		if isNumbered {
			return indent + "1. " + content
		}
		return indent + "- " + content
	default:
		return content
	}
}

// parseRun extracts text and applies formatting (bold, italic, strikethrough, code)
func (c *DocxConverter) parseRun(decoder *xml.Decoder, start *xml.StartElement) string {
	var sb strings.Builder
	var isBold bool
	var isItalic bool
	var isStrike bool
	var isCode bool
	var isSup bool
	var isSub bool

	depth := 1
	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}

		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			switch elem.Name.Local {
			case "b", "bCs":
				isBold = true
			case "i", "iCs":
				isItalic = true
			case "strike", "dstrike":
				isStrike = true
			case "rFonts":
				for _, attr := range elem.Attr {
					if attr.Name.Local == "ascii" || attr.Name.Local == "hAnsi" {
						val := strings.ToLower(attr.Value)
						if strings.Contains(val, "consolas") || strings.Contains(val, "courier") || strings.Contains(val, "mono") {
							isCode = true
						}
					}
				}
			case "vertAlign":
				for _, attr := range elem.Attr {
					if attr.Name.Local == "val" {
						if attr.Value == "superscript" {
							isSup = true
						} else if attr.Value == "subscript" {
							isSub = true
						}
					}
				}
			case "t":
				text := c.readElementText(decoder, &elem)
				sb.WriteString(text)
				depth-- // readElementText consumed the closing tag
			case "tab":
				sb.WriteString("    ")
			case "br":
				sb.WriteString("\n")
			case "drawing":
				img := c.parseDrawing(decoder, &elem)
				sb.WriteString(img)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	text := sb.String()
	if text == "" {
		return ""
	}

	// Format text decorations
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return text
	}

	leadSpace := ""
	trailSpace := ""
	if strings.HasPrefix(text, " ") {
		leadSpace = " "
	}
	if strings.HasSuffix(text, " ") {
		trailSpace = " "
	}

	formatted := trimmed
	if isCode {
		formatted = "`" + formatted + "`"
	}
	if isBold && isItalic {
		formatted = "***" + formatted + "***"
	} else if isBold {
		formatted = "**" + formatted + "**"
	} else if isItalic {
		formatted = "*" + formatted + "*"
	}
	if isStrike {
		formatted = "~~" + formatted + "~~"
	}
	if isSup {
		formatted = "<sup>" + formatted + "</sup>"
	}
	if isSub {
		formatted = "<sub>" + formatted + "</sub>"
	}

	return leadSpace + formatted + trailSpace
}

// parseHyperlink handles docx hyperlinks
func (c *DocxConverter) parseHyperlink(decoder *xml.Decoder, start *xml.StartElement) string {
	var rID string
	for _, attr := range start.Attr {
		if attr.Name.Local == "id" {
			rID = attr.Value
		}
	}

	var sb strings.Builder
	depth := 1
	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "r" {
				sb.WriteString(c.parseRun(decoder, &elem))
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	linkText := strings.TrimSpace(sb.String())
	if linkText == "" {
		return ""
	}

	url, exists := c.relationships[rID]
	if !exists || url == "" {
		return linkText
	}

	return fmt.Sprintf("[%s](%s)", linkText, url)
}

// parseDrawing extracts embedded images from drawing tags
func (c *DocxConverter) parseDrawing(decoder *xml.Decoder, start *xml.StartElement) string {
	var embedID string
	var altText string

	depth := 1
	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "blip" || elem.Name.Local == "imagedata" {
				for _, attr := range elem.Attr {
					if attr.Name.Local == "embed" || attr.Name.Local == "id" {
						embedID = attr.Value
					}
				}
			} else if elem.Name.Local == "docPr" {
				for _, attr := range elem.Attr {
					if attr.Name.Local == "descr" || attr.Name.Local == "name" {
						if altText == "" {
							altText = attr.Value
						}
					}
				}
			}
		case xml.EndElement:
			depth--
		}
	}

	if embedID == "" {
		return ""
	}

	targetPath, exists := c.relationships[embedID]
	if !exists {
		return ""
	}

	// Lookup media data
	targetClean := strings.TrimPrefix(targetPath, "word/")
	data, found := c.mediaFiles[targetClean]
	if !found {
		data, found = c.mediaFiles[filepath.Base(targetPath)]
	}
	if !found || len(data) == 0 {
		return ""
	}

	mimeType := http.DetectContentType(data)
	b64 := base64.StdEncoding.EncodeToString(data)
	dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, b64)

	if altText == "" {
		altText = "immagine"
	}

	return fmt.Sprintf("\n\n![%s](%s)\n\n", altText, dataURI)
}

// parseTable converts OpenXML table (<w:tbl>) into a GFM Markdown table
func (c *DocxConverter) parseTable(decoder *xml.Decoder, start *xml.StartElement) string {
	var rows [][]string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "tr" {
				row := c.parseTableRow(decoder, &elem)
				if len(row) > 0 {
					rows = append(rows, row)
				}
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	if len(rows) == 0 {
		return ""
	}

	// Normalize columns count across all rows
	maxCols := 0
	for _, row := range rows {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}
	if maxCols == 0 {
		return ""
	}

	for i := range rows {
		for len(rows[i]) < maxCols {
			rows[i] = append(rows[i], "")
		}
	}

	var sb strings.Builder

	// Header row
	header := rows[0]
	sb.WriteString("|")
	for _, cell := range header {
		cleanCell := strings.ReplaceAll(cell, "|", "\\|")
		cleanCell = strings.ReplaceAll(cleanCell, "\n", " ")
		sb.WriteString(" ")
		sb.WriteString(strings.TrimSpace(cleanCell))
		sb.WriteString(" |")
	}
	sb.WriteString("\n")

	// Divider
	sb.WriteString("|")
	for range header {
		sb.WriteString(" --- |")
	}
	sb.WriteString("\n")

	// Data rows
	for _, row := range rows[1:] {
		sb.WriteString("|")
		for _, cell := range row {
			cleanCell := strings.ReplaceAll(cell, "|", "\\|")
			cleanCell = strings.ReplaceAll(cleanCell, "\n", " ")
			sb.WriteString(" ")
			sb.WriteString(strings.TrimSpace(cleanCell))
			sb.WriteString(" |")
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// parseTableRow extracts cells from a table row (<w:tr>)
func (c *DocxConverter) parseTableRow(decoder *xml.Decoder, start *xml.StartElement) []string {
	var cells []string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "tc" {
				cellContent := c.parseTableCell(decoder, &elem)
				cells = append(cells, cellContent)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}
	return cells
}

// parseTableCell extracts text from a table cell (<w:tc>)
func (c *DocxConverter) parseTableCell(decoder *xml.Decoder, start *xml.StartElement) string {
	var parts []string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "p" {
				pText := c.parseParagraph(decoder, &elem)
				if strings.TrimSpace(pText) != "" {
					parts = append(parts, pText)
				}
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}
	return strings.Join(parts, "<br>")
}

// parseOMath translates Office Math Markup Language (<m:oMath>, <m:oMathPara>) to LaTeX
func (c *DocxConverter) parseOMath(decoder *xml.Decoder, start *xml.StartElement) string {
	var sb strings.Builder
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			switch elem.Name.Local {
			case "f": // Fraction
				fracLaTeX := c.parseOMathFraction(decoder, &elem)
				sb.WriteString(fracLaTeX)
				depth--
			case "rad": // Radical / Square Root
				radLaTeX := c.parseOMathRadical(decoder, &elem)
				sb.WriteString(radLaTeX)
				depth--
			case "sSup": // Superscript
				supLaTeX := c.parseOMathSuperscript(decoder, &elem)
				sb.WriteString(supLaTeX)
				depth--
			case "sSub": // Subscript
				subLaTeX := c.parseOMathSubscript(decoder, &elem)
				sb.WriteString(subLaTeX)
				depth--
			case "sSubSup": // Subscript-Superscript
				subSupLaTeX := c.parseOMathSubSup(decoder, &elem)
				sb.WriteString(subSupLaTeX)
				depth--
			case "nary": // N-ary (Sum, Integral, Product)
				naryLaTeX := c.parseOMathNary(decoder, &elem)
				sb.WriteString(naryLaTeX)
				depth--
			case "d": // Delimiter / Parentheses
				delLaTeX := c.parseOMathDelimiter(decoder, &elem)
				sb.WriteString(delLaTeX)
				depth--
			case "m": // Matrix
				matrixLaTeX := c.parseOMathMatrix(decoder, &elem)
				sb.WriteString(matrixLaTeX)
				depth--
			case "func": // Function (sin, cos, log)
				funcLaTeX := c.parseOMathFunc(decoder, &elem)
				sb.WriteString(funcLaTeX)
				depth--
			case "t": // Math text / characters
				mathText := c.readElementText(decoder, &elem)
				sb.WriteString(convertMathSymbols(mathText))
				depth--
			case "r": // Math run
				// Let inner tags handle it
			}
		case xml.EndElement:
			depth--
		}
	}
	return sb.String()
}

// parseOMathFraction handles <m:f> -> \frac{num}{den}
func (c *DocxConverter) parseOMathFraction(decoder *xml.Decoder, start *xml.StartElement) string {
	var num, den string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "num" {
				num = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "den" {
				den = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}
	return fmt.Sprintf(" \\frac{%s}{%s} ", strings.TrimSpace(num), strings.TrimSpace(den))
}

// parseOMathRadical handles <m:rad> -> \sqrt{base} or \sqrt[deg]{base}
func (c *DocxConverter) parseOMathRadical(decoder *xml.Decoder, start *xml.StartElement) string {
	var base, deg string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "e" {
				base = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "deg" {
				deg = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	deg = strings.TrimSpace(deg)
	if deg != "" {
		return fmt.Sprintf(" \\sqrt[%s]{%s} ", deg, strings.TrimSpace(base))
	}
	return fmt.Sprintf(" \\sqrt{%s} ", strings.TrimSpace(base))
}

// parseOMathSuperscript handles <m:sSup> -> {base}^{sup}
func (c *DocxConverter) parseOMathSuperscript(decoder *xml.Decoder, start *xml.StartElement) string {
	var base, sup string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "e" {
				base = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "sup" {
				sup = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}
	return fmt.Sprintf("{%s}^{%s}", strings.TrimSpace(base), strings.TrimSpace(sup))
}

// parseOMathSubscript handles <m:sSub> -> {base}_{sub}
func (c *DocxConverter) parseOMathSubscript(decoder *xml.Decoder, start *xml.StartElement) string {
	var base, sub string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "e" {
				base = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "sub" {
				sub = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}
	return fmt.Sprintf("{%s}_{%s}", strings.TrimSpace(base), strings.TrimSpace(sub))
}

// parseOMathSubSup handles <m:sSubSup> -> {base}_{sub}^{sup}
func (c *DocxConverter) parseOMathSubSup(decoder *xml.Decoder, start *xml.StartElement) string {
	var base, sub, sup string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "e" {
				base = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "sub" {
				sub = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "sup" {
				sup = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}
	return fmt.Sprintf("{%s}_{%s}^{%s}", strings.TrimSpace(base), strings.TrimSpace(sub), strings.TrimSpace(sup))
}

// parseOMathNary handles <m:nary> -> \sum_{sub}^{sup}{body} or \int
func (c *DocxConverter) parseOMathNary(decoder *xml.Decoder, start *xml.StartElement) string {
	var chr, sub, sup, body string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "chr" {
				for _, a := range elem.Attr {
					if a.Name.Local == "val" {
						chr = a.Value
					}
				}
			} else if elem.Name.Local == "sub" {
				sub = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "sup" {
				sup = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "e" {
				body = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	op := "\\sum"
	switch chr {
	case "∫", "integral":
		op = "\\int"
	case "∏", "product":
		op = "\\prod"
	case "⋃", "union":
		op = "\\bigcup"
	case "⋂", "intersection":
		op = "\\bigcap"
	}

	var sb strings.Builder
	sb.WriteString(" ")
	sb.WriteString(op)
	if strings.TrimSpace(sub) != "" {
		sb.WriteString("_{")
		sb.WriteString(strings.TrimSpace(sub))
		sb.WriteString("}")
	}
	if strings.TrimSpace(sup) != "" {
		sb.WriteString("^{")
		sb.WriteString(strings.TrimSpace(sup))
		sb.WriteString("}")
	}
	sb.WriteString(" ")
	sb.WriteString(strings.TrimSpace(body))
	sb.WriteString(" ")
	return sb.String()
}

// parseOMathDelimiter handles <m:d> -> \left( ... \right)
func (c *DocxConverter) parseOMathDelimiter(decoder *xml.Decoder, start *xml.StartElement) string {
	begChr := "("
	endChr := ")"
	var body string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "begChr" {
				for _, a := range elem.Attr {
					if a.Name.Local == "val" {
						begChr = a.Value
					}
				}
			} else if elem.Name.Local == "endChr" {
				for _, a := range elem.Attr {
					if a.Name.Local == "val" {
						endChr = a.Value
					}
				}
			} else if elem.Name.Local == "e" {
				body = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	leftDelim := "\\left("
	rightDelim := "\\right)"
	switch begChr {
	case "[":
		leftDelim = "\\left["
	case "{":
		leftDelim = "\\left\\{"
	case "|":
		leftDelim = "\\left|"
	case "":
		leftDelim = "\\left."
	}

	switch endChr {
	case "]":
		rightDelim = "\\right]"
	case "}":
		rightDelim = "\\right\\}"
	case "|":
		rightDelim = "\\right|"
	case "":
		rightDelim = "\\right."
	}

	return fmt.Sprintf("%s %s %s", leftDelim, strings.TrimSpace(body), rightDelim)
}

// parseOMathMatrix handles <m:m> -> \begin{matrix} ... \end{matrix}
func (c *DocxConverter) parseOMathMatrix(decoder *xml.Decoder, start *xml.StartElement) string {
	var rows []string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "mr" { // Matrix row
				var rowCells []string
				rowDepth := 1
				for rowDepth > 0 {
					rTok, rErr := decoder.Token()
					if rErr != nil {
						break
					}
					switch rElem := rTok.(type) {
					case xml.StartElement:
						rowDepth++
						if rElem.Name.Local == "e" {
							cell := c.parseOMath(decoder, &rElem)
							rowCells = append(rowCells, strings.TrimSpace(cell))
							rowDepth--
						}
					case xml.EndElement:
						rowDepth--
					}
				}
				rows = append(rows, strings.Join(rowCells, " & "))
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	return fmt.Sprintf(" \\begin{matrix} %s \\end{matrix} ", strings.Join(rows, " \\\\ "))
}

// parseOMathFunc handles <m:func> -> \sin(x), \log, etc.
func (c *DocxConverter) parseOMathFunc(decoder *xml.Decoder, start *xml.StartElement) string {
	var fName, arg string
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch elem := token.(type) {
		case xml.StartElement:
			depth++
			if elem.Name.Local == "fName" {
				fName = c.parseOMath(decoder, &elem)
				depth--
			} else if elem.Name.Local == "e" {
				arg = c.parseOMath(decoder, &elem)
				depth--
			}
		case xml.EndElement:
			depth--
		}
	}

	cleanFn := strings.TrimSpace(fName)
	switch strings.ToLower(cleanFn) {
	case "sin":
		cleanFn = "\\sin"
	case "cos":
		cleanFn = "\\cos"
	case "tan":
		cleanFn = "\\tan"
	case "log":
		cleanFn = "\\log"
	case "ln":
		cleanFn = "\\ln"
	case "lim":
		cleanFn = "\\lim"
	case "exp":
		cleanFn = "\\exp"
	}

	return fmt.Sprintf(" %s %s ", cleanFn, strings.TrimSpace(arg))
}

// readElementText helper reads character data until closing tag
func (c *DocxConverter) readElementText(decoder *xml.Decoder, start *xml.StartElement) string {
	var sb strings.Builder
	depth := 1

	for depth > 0 {
		token, err := decoder.Token()
		if err != nil {
			break
		}
		switch t := token.(type) {
		case xml.CharData:
			sb.Write(t)
		case xml.StartElement:
			depth++
		case xml.EndElement:
			depth--
		}
	}
	return sb.String()
}

// convertMathSymbols maps Unicode characters to LaTeX commands
func convertMathSymbols(s string) string {
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
	}

	for u, l := range replacements {
		s = strings.ReplaceAll(s, u, l)
	}
	return s
}

// cleanMarkdown cleans multiple empty lines and spaces
func cleanMarkdown(s string) string {
	reMultiNewline := regexp.MustCompile(`\n{3,}`)
	s = reMultiNewline.ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}
