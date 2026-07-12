// =============================================================================
// EduDrive — Document Conversion Service
// =============================================================================
// Handles automatic conversion of uploaded textual files (.docx, .doc, .txt, .html, .rtf)
// into coherent Markdown (.md) preserving formatting and highlighted words.
// Also handles reverse conversion ("convertitore alla rovescia") when downloading
// .md files into .docx, .txt, or .md format.
// =============================================================================

import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';

// =============================================================================
// 1. UPLOAD CONVERSION -> MARKDOWN (.md)
// =============================================================================

/**
 * Checks if a file is candidate for automatic conversion to Markdown.
 * Textual documents (.docx, .doc, .txt, .rtf, .html) will be converted to .md.
 */
export function isTextualCandidateForMarkdown(originalname = '', mimetype = '') {
  const lowerName = originalname.toLowerCase();
  if (lowerName.endsWith('.md') || mimetype === 'text/markdown') {
    return false; // Already markdown
  }

  const allowedExtensions = ['.docx', '.doc', '.txt', '.rtf', '.html', '.htm'];
  const hasAllowedExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));

  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/html',
    'application/rtf',
    'text/rtf',
  ];
  const hasAllowedMime = allowedMimes.includes(mimetype) || mimetype.startsWith('text/');

  return hasAllowedExt || hasAllowedMime;
}

/**
 * Converts an uploaded textual file buffer (.docx, .doc, .txt, .html, .rtf)
 * to coherent Markdown (.md), preserving highlighted words, bold, headings, tables, etc.
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - MIME type
 * @param {string} originalname - Original filename
 * @returns {Promise<{buffer: Buffer, filename: string, mimeType: string, converted: boolean}>}
 */
export async function convertFileToMarkdown(buffer, mimetype, originalname) {
  const lowerName = originalname.toLowerCase();

  // If Word Document (.docx, .doc)
  if (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    mimetype.includes('wordprocessingml') ||
    mimetype === 'application/msword'
  ) {
    try {
      // Mammoth convert to HTML with style mapping to preserve highlights (<mark>)
      const mammothResult = await mammoth.convertToHtml(
        { buffer },
        {
          styleMap: [
            'run[highlight] => mark',
            "run[style-name='Highlight'] => mark",
            "run[style-name='Mark'] => mark",
            "run[style-name='Evidenziato'] => mark",
            "run[style-name='Evidenziazione'] => mark",
          ],
        }
      );

      const htmlContent = mammothResult.value || '';

      // Turndown HTML to Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        hr: '---',
        bulletListMarker: '-',
      });
      turndownService.use(gfm);

      // Rule for <mark> tags -> ==highlighted text==
      turndownService.addRule('markTag', {
        filter: ['mark'],
        replacement: (content) => {
          const trimmed = content.trim();
          return trimmed ? `==${trimmed}==` : '';
        },
      });

      // Rule for inline spans with background color -> ==highlighted text==
      turndownService.addRule('highlightSpan', {
        filter: (node) => {
          if (node.nodeName !== 'SPAN') return false;
          const style = (node.getAttribute('style') || '').toLowerCase();
          const className = (node.className || '').toLowerCase();
          return style.includes('background') || className.includes('highlight');
        },
        replacement: (content) => {
          const trimmed = content.trim();
          return trimmed ? `==${trimmed}==` : '';
        },
      });

      let markdownText = turndownService.turndown(htmlContent);

      // Ensure clean spacing and header title if empty
      if (!markdownText.trim()) {
        markdownText = `# ${originalname.replace(/\.(docx?|doc)$/i, '')}\n\n(Documento vuoto)`;
      }

      const newFilename = originalname.replace(/\.(docx?|doc)$/i, '.md');
      return {
        buffer: Buffer.from(markdownText, 'utf-8'),
        filename: newFilename,
        mimeType: 'text/markdown',
        converted: true,
      };
    } catch (err) {
      console.warn('⚠️ Fallback during DOCX to Markdown conversion:', err.message);
      // If Word parsing fails, keep original buffer or throw
    }
  }

  // If HTML (.html, .htm)
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || mimetype === 'text/html') {
    const htmlContent = buffer.toString('utf-8');
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    turndownService.use(gfm);
    turndownService.addRule('markTag', {
      filter: ['mark'],
      replacement: (content) => (content.trim() ? `==${content.trim()}==` : ''),
    });
    const markdownText = turndownService.turndown(htmlContent);
    const newFilename = originalname.replace(/\.html?$/i, '.md');
    return {
      buffer: Buffer.from(markdownText, 'utf-8'),
      filename: newFilename,
      mimeType: 'text/markdown',
      converted: true,
    };
  }

  // If Plain Text (.txt, .rtf) or any text/*
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.rtf') || mimetype.startsWith('text/')) {
    let textContent = buffer.toString('utf-8');
    // If it was RTF, strip basic RTF tags if needed or format cleanly
    if (lowerName.endsWith('.rtf')) {
      textContent = textContent.replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z0-9]+|\\[~|-]/g, ' ').trim();
    }
    const newFilename = originalname.replace(/\.(txt|rtf)$/i, '.md');
    const finalFilename = newFilename.endsWith('.md') ? newFilename : `${newFilename}.md`;
    return {
      buffer: Buffer.from(textContent, 'utf-8'),
      filename: finalFilename,
      mimeType: 'text/markdown',
      converted: true,
    };
  }

  // Fallback: return unchanged
  return {
    buffer,
    filename: originalname,
    mimeType: mimetype,
    converted: false,
  };
}

// =============================================================================
// 2. DOWNLOAD REVERSE CONVERSION ("CONVERTITORE ALLA ROVESCIA")
// =============================================================================

/**
 * Converts Markdown content (.md) back to .docx, .txt, or .md on download.
 *
 * @param {string|Buffer} markdownContent - Original markdown content
 * @param {string} targetFormat - 'md', 'docx', or 'txt'
 * @param {string} originalFilename - Current filename (e.g., 'Appunti.md')
 * @returns {Promise<{buffer: Buffer, filename: string, mimeType: string}>}
 */
export async function convertMarkdownToFormat(markdownContent, targetFormat = 'md', originalFilename = 'documento.md') {
  const text = typeof markdownContent === 'string' ? markdownContent : markdownContent.toString('utf-8');
  const baseName = originalFilename.replace(/\.md$/i, '');

  // 1. Markdown (.md)
  if (targetFormat === 'md') {
    return {
      buffer: Buffer.from(text, 'utf-8'),
      filename: `${baseName}.md`,
      mimeType: 'text/markdown; charset=utf-8',
    };
  }

  // 2. Plain Text (.txt) - Strip formatting and highlights
  if (targetFormat === 'txt') {
    let plainText = text;
    // Remove highlights ==text== and <mark>text</mark>
    plainText = plainText.replace(/==([^=\r\n]+)==/g, '$1');
    plainText = plainText.replace(/<mark[^>]*>([^<]+)<\/mark>/gi, '$1');
    // Remove headings #
    plainText = plainText.replace(/^#{1,6}\s+/gm, '');
    // Remove bold/italics
    plainText = plainText.replace(/\*\*([^*]+)\*\*/g, '$1');
    plainText = plainText.replace(/\*([^*]+)\*/g, '$1');
    plainText = plainText.replace(/__([^_]+)__/g, '$1');
    plainText = plainText.replace(/_([^_]+)_/g, '$1');
    // Remove links [text](url)
    plainText = plainText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    // Remove blockquote >
    plainText = plainText.replace(/^>\s+/gm, '');
    // Remove code blocks
    plainText = plainText.replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      return lines.slice(1, -1).join('\n');
    });

    return {
      buffer: Buffer.from(plainText, 'utf-8'),
      filename: `${baseName}.txt`,
      mimeType: 'text/plain; charset=utf-8',
    };
  }

  // 3. Word Document (.docx) - Convert markdown formatting to DOCX elements
  if (targetFormat === 'docx') {
    const docBuffer = await buildDocxFromMarkdown(text, baseName);
    return {
      buffer: docBuffer,
      filename: `${baseName}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // Default fallback to markdown
  return {
    buffer: Buffer.from(text, 'utf-8'),
    filename: `${baseName}.md`,
    mimeType: 'text/markdown; charset=utf-8',
  };
}

// =============================================================================
// HELPER: BUILD DOCX FROM MARKDOWN (REVERSE CONVERTER)
// =============================================================================

async function buildDocxFromMarkdown(markdownText, documentTitle = 'Documento') {
  const lines = markdownText.split(/\r?\n/);
  const paragraphs = [];

  // Helper: recursive inline run tokenizer for bold, italics, highlights, and links
  function parseInlineToRuns(str, baseStyle = {}) {
    if (!str) return [];

    // Check for highlight ==text== or <mark>text</mark>
    const highlightMatch = str.match(/==([^=\r\n]+)==|<mark[^>]*>([^<]+)<\/mark>/i);
    if (highlightMatch) {
      const idx = highlightMatch.index;
      const matchedText = highlightMatch[1] || highlightMatch[2];
      const fullMatch = highlightMatch[0];
      const left = str.slice(0, idx);
      const right = str.slice(idx + fullMatch.length);

      return [
        ...parseInlineToRuns(left, baseStyle),
        ...parseInlineToRuns(matchedText, { ...baseStyle, highlight: 'yellow' }),
        ...parseInlineToRuns(right, baseStyle),
      ];
    }

    // Check for bold **text** or __text__
    const boldMatch = str.match(/\*\*([^*]+)\*\*|__([^_]+)__/);
    if (boldMatch) {
      const idx = boldMatch.index;
      const matchedText = boldMatch[1] || boldMatch[2];
      const fullMatch = boldMatch[0];
      const left = str.slice(0, idx);
      const right = str.slice(idx + fullMatch.length);

      return [
        ...parseInlineToRuns(left, baseStyle),
        ...parseInlineToRuns(matchedText, { ...baseStyle, bold: true }),
        ...parseInlineToRuns(right, baseStyle),
      ];
    }

    // Check for italic *text* or _text_
    const italicMatch = str.match(/\*([^*]+)\*|_([^_]+)_/);
    if (italicMatch) {
      const idx = italicMatch.index;
      const matchedText = italicMatch[1] || italicMatch[2];
      const fullMatch = italicMatch[0];
      const left = str.slice(0, idx);
      const right = str.slice(idx + fullMatch.length);

      return [
        ...parseInlineToRuns(left, baseStyle),
        ...parseInlineToRuns(matchedText, { ...baseStyle, italics: true }),
        ...parseInlineToRuns(right, baseStyle),
      ];
    }

    // Check for code `text`
    const codeMatch = str.match(/`([^`]+)`/);
    if (codeMatch) {
      const idx = codeMatch.index;
      const matchedText = codeMatch[1];
      const fullMatch = codeMatch[0];
      const left = str.slice(0, idx);
      const right = str.slice(idx + fullMatch.length);

      return [
        ...parseInlineToRuns(left, baseStyle),
        new TextRun({ text: matchedText, ...baseStyle, font: 'Courier New', shading: { fill: 'F3F4F6' } }),
        ...parseInlineToRuns(right, baseStyle),
      ];
    }

    // Check for links [text](url)
    const linkMatch = str.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const idx = linkMatch.index;
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      const fullMatch = linkMatch[0];
      const left = str.slice(0, idx);
      const right = str.slice(idx + fullMatch.length);

      return [
        ...parseInlineToRuns(left, baseStyle),
        new TextRun({ text: `${linkText} (${linkUrl})`, ...baseStyle, color: '2563EB', underline: {} }),
        ...parseInlineToRuns(right, baseStyle),
      ];
    }

    // No further special inline tokens -> return base text run
    return [new TextRun({ text: str, ...baseStyle })];
  }

  let inCodeBlock = false;
  let codeBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code block boundaries
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeBuffer.join('\n'),
                font: 'Courier New',
                size: 20,
              }),
            ],
            shading: { fill: 'F3F4F6' },
            spacing: { before: 120, after: 120 },
          })
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Check headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const levelNum = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ];
      paragraphs.push(
        new Paragraph({
          children: parseInlineToRuns(headingText),
          heading: headingLevels[levelNum - 1] || HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // Check horizontal rule
    if (/^(-\s*){3,}$|^(\*\s*){3,}$|^(_\s*){3,}$/.test(line.trim())) {
      paragraphs.push(
        new Paragraph({
          border: {
            bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 },
          },
          spacing: { before: 240, after: 240 },
        })
      );
      continue;
    }

    // Check bullet list item
    const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineToRuns(bulletMatch[1]),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
      continue;
    }

    // Check numbered list item
    const numberMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineToRuns(numberMatch[1]),
          numbering: { reference: 'my-numbering', level: 0 },
          spacing: { after: 80 },
        })
      );
      continue;
    }

    // Check blockquote
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineToRuns(quoteMatch[1], { italics: true, color: '475569' }),
          indent: { left: 720 },
          border: {
            left: { color: '3B82F6', space: 10, style: BorderStyle.SINGLE, size: 24 },
          },
          spacing: { before: 120, after: 120 },
        })
      );
      continue;
    }

    // Empty line -> spacing
    if (!line.trim()) {
      continue;
    }

    // Normal paragraph
    paragraphs.push(
      new Paragraph({
        children: parseInlineToRuns(line),
        spacing: { after: 140 },
      })
    );
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'my-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: 'left',
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: documentTitle })],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
