package converter

import (
	"bytes"
	"compress/zlib"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// createMockPdf creates a minimal PDF with given uncompressed stream content
func createMockPdf(t *testing.T, streamContent string) string {
	t.Helper()
	tmpDir := t.TempDir()
	pdfPath := filepath.Join(tmpDir, "test.pdf")

	var compressedStream bytes.Buffer
	zw := zlib.NewWriter(&compressedStream)
	_, _ = zw.Write([]byte(streamContent))
	_ = zw.Close()

	pdfData := fmt.Sprintf(`%%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length %d /Filter /FlateDecode >>
stream
%s
endstream
endobj
xref
0 5
0000000000 65535 f 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
500
%%%%EOF`, compressedStream.Len(), compressedStream.String())

	if err := os.WriteFile(pdfPath, []byte(pdfData), 0644); err != nil {
		t.Fatalf("failed to write test pdf: %v", err)
	}

	return pdfPath
}

func TestPdfConverterTextAndHeadings(t *testing.T) {
	stream := `BT
/F1_Bold 24 Tf
1 0 0 1 50 700 Tm
(Appunti di Fisica Generale) Tj
ET
BT
/F2 12 Tf
1 0 0 1 50 650 Tm
(Questo documento descrive i principi fondamentali della dinamica.) Tj
ET
BT
/F2 12 Tf
1 0 0 1 50 600 Tm
(• Primo principio: principio di inerzia) Tj
ET
BT
/F2 12 Tf
1 0 0 1 50 550 Tm
(Formula: \alpha + \beta = \Delta) Tj
ET`

	pdfPath := createMockPdf(t, stream)
	conv := NewPdfConverter(pdfPath)
	md, err := conv.Convert()
	if err != nil {
		t.Fatalf("PDF conversion failed: %v", err)
	}

	if !strings.Contains(md, "Appunti di Fisica Generale") {
		t.Errorf("expected title text, got:\n%s", md)
	}
	if !strings.Contains(md, "principi fondamentali") {
		t.Errorf("expected paragraph text, got:\n%s", md)
	}
	if !strings.Contains(md, "- Primo principio") {
		t.Errorf("expected bullet list item, got:\n%s", md)
	}
}

func TestConvertMathSymbols(t *testing.T) {
	input := "Formula: α + β = Δ e sommatoria ∑"
	output := convertMathSymbolsInLine(input)
	if !strings.Contains(output, "\\alpha") || !strings.Contains(output, "\\beta") || !strings.Contains(output, "\\Delta") || !strings.Contains(output, "\\sum") {
		t.Errorf("expected LaTeX converted symbols, got: %s", output)
	}
}
