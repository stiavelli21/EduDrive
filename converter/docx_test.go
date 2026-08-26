package converter

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

// createMockDocx creates an in-memory DOCX zip file with given document.xml and rels
func createMockDocx(t *testing.T, documentXML string, relsXML string) *zip.Reader {
	t.Helper()
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Write word/document.xml
	docEntry, err := zw.Create("word/document.xml")
	if err != nil {
		t.Fatalf("failed to create document.xml in zip: %v", err)
	}
	if _, err := docEntry.Write([]byte(documentXML)); err != nil {
		t.Fatalf("failed to write document.xml: %v", err)
	}

	// Write word/_rels/document.xml.rels
	if relsXML != "" {
		relsEntry, err := zw.Create("word/_rels/document.xml.rels")
		if err != nil {
			t.Fatalf("failed to create rels in zip: %v", err)
		}
		if _, err := relsEntry.Write([]byte(relsXML)); err != nil {
			t.Fatalf("failed to write rels: %v", err)
		}
	}

	if err := zw.Close(); err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}

	reader, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("failed to create zip reader: %v", err)
	}
	return reader
}

func TestDocxHeadingsAndParagraphs(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
	<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
		<w:body>
			<w:p>
				<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
				<w:r><w:t>Introduzione al Corso</w:t></w:r>
			</w:p>
			<w:p>
				<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
				<w:r><w:t>Capitolo 1</w:t></w:r>
			</w:p>
			<w:p>
				<w:r><w:t>Questo è un paragrafo con testo </w:t></w:r>
				<w:r><w:rPr><w:b/></w:rPr><w:t>in grassetto</w:t></w:r>
				<w:r><w:t> e </w:t></w:r>
				<w:r><w:rPr><w:i/></w:rPr><w:t>in corsivo</w:t></w:r>
				<w:r><w:t>.</w:t></w:r>
			</w:p>
		</w:body>
	</w:document>`

	zr := createMockDocx(t, xml, "")
	conv := NewDocxConverter(zr)
	md, err := conv.Convert()
	if err != nil {
		t.Fatalf("conversion failed: %v", err)
	}

	if !strings.Contains(md, "# Introduzione al Corso") {
		t.Errorf("expected Heading 1 '# Introduzione al Corso', got:\n%s", md)
	}
	if !strings.Contains(md, "## Capitolo 1") {
		t.Errorf("expected Heading 2 '## Capitolo 1', got:\n%s", md)
	}
	if !strings.Contains(md, "**in grassetto**") {
		t.Errorf("expected bold '**in grassetto**', got:\n%s", md)
	}
	if !strings.Contains(md, "*in corsivo*") {
		t.Errorf("expected italic '*in corsivo*', got:\n%s", md)
	}
}

func TestDocxTableConversion(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
	<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
		<w:body>
			<w:tbl>
				<w:tr>
					<w:tc><w:p><w:r><w:t>Materia</w:t></w:r></w:p></w:tc>
					<w:tc><w:p><w:r><w:t>CFU</w:t></w:r></w:p></w:tc>
					<w:tc><w:p><w:r><w:t>Voto</w:t></w:r></w:p></w:tc>
				</w:tr>
				<w:tr>
					<w:tc><w:p><w:r><w:t>Analisi Matematica</w:t></w:r></w:p></w:tc>
					<w:tc><w:p><w:r><w:t>9</w:t></w:r></w:p></w:tc>
					<w:tc><w:p><w:r><w:t>30L</w:t></w:r></w:p></w:tc>
				</w:tr>
			</w:tbl>
		</w:body>
	</w:document>`

	zr := createMockDocx(t, xml, "")
	conv := NewDocxConverter(zr)
	md, err := conv.Convert()
	if err != nil {
		t.Fatalf("conversion failed: %v", err)
	}

	if !strings.Contains(md, "| Materia | CFU | Voto |") {
		t.Errorf("expected table header, got:\n%s", md)
	}
	if !strings.Contains(md, "| --- | --- | --- |") {
		t.Errorf("expected table divider, got:\n%s", md)
	}
	if !strings.Contains(md, "| Analisi Matematica | 9 | 30L |") {
		t.Errorf("expected table data row, got:\n%s", md)
	}
}

func TestDocxOMMLMathToLaTeX(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
	<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
				xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
		<w:body>
			<w:p>
				<w:r><w:t>Formula: </w:t></w:r>
				<m:oMath>
					<m:f>
						<m:num><m:r><m:t>-b \pm \sqrt{\Delta}</m:t></m:r></m:num>
						<m:den><m:r><m:t>2a</m:t></m:r></m:den>
					</m:f>
				</m:oMath>
			</w:p>
			<m:oMathPara>
				<m:oMath>
					<m:nary>
						<m:naryPr><m:chr m:val="∑"/></m:naryPr>
						<m:sub><m:r><m:t>i=1</m:t></m:r></m:sub>
						<m:sup><m:r><m:t>n</m:t></m:r></m:sup>
						<m:e><m:r><m:t>i</m:t></m:r></m:e>
					</m:nary>
				</m:oMath>
			</m:oMathPara>
		</w:body>
	</w:document>`

	zr := createMockDocx(t, xml, "")
	conv := NewDocxConverter(zr)
	md, err := conv.Convert()
	if err != nil {
		t.Fatalf("conversion failed: %v", err)
	}

	if !strings.Contains(md, "\\frac") {
		t.Errorf("expected LaTeX fraction '\\frac', got:\n%s", md)
	}
	if !strings.Contains(md, "\\sum") {
		t.Errorf("expected LaTeX summation '\\sum', got:\n%s", md)
	}
	if !strings.Contains(md, "$$") {
		t.Errorf("expected LaTeX display math block '$$', got:\n%s", md)
	}
}
