import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';

import {
  FileText,
  X,
  Save,
  Edit3,
  Eye,
  Columns,
  Copy,
  Check,
  Download,
  ExternalLink,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Terminal,
  Quote,
  Table as TableIcon,
  Minus,
  Link as LinkIcon,
  Clock,
  FileCode,
  ArrowLeft,
  Sigma,
  SquareFunction,
  Palette,
  Image as ImageIcon,
  Sparkles,
  Printer,
  Search,
  AlignLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DriveItem } from '../../types';
import { escapeHtml } from '../../utils/formatters';

interface MarkdownModalProps {
  isOpen: boolean;
  item?: DriveItem | null; // If null/undefined, mode is "create"
  initialContent?: string;
  onClose: () => void;
  onSave: (name: string, content: string, id?: string) => Promise<void>;
  onExport?: (item: DriveItem) => void;
  onOpenExternally?: (item: DriveItem) => void;
}

export interface TocHeading {
  id: string;
  level: number;
  text: string;
}

// Extract headings H1, H2, H3 ignoring code blocks
export function extractHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`~[\]]/g, '').trim();
      const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      const id = `toc-${headings.length}-${slug}`;
      headings.push({ id, level, text });
    }
  }

  return headings;
}

export const MarkdownModal: React.FC<MarkdownModalProps> = ({
  isOpen,
  item,
  initialContent = '',
  onClose,
  onSave,
  onExport,
  onOpenExternally,
}) => {
  const isCreating = !item;
  const [mode, setMode] = useState<'view' | 'edit'>(isCreating ? 'edit' : 'view');
  const [editorLayout, setEditorLayout] = useState<'split' | 'edit-only' | 'preview-only'>('split');
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // TOC State
  const [isTocOpen, setIsTocOpen] = useState<boolean>(true);
  const [headings, setHeadings] = useState<TocHeading[]>([]);

  // Search & Replace State
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset state when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFileName(item.name);
        setContent(initialContent);
        setOriginalContent(initialContent);
        setMode('view');
      } else {
        setFileName('Nuova nota.md');
        setContent('');
        setOriginalContent('');
        setMode('edit');
        setEditorLayout('split');
      }
      setIsCopied(false);
      setIsSearchOpen(false);
      setSearchQuery('');
      setReplaceQuery('');
    }
  }, [isOpen, item, initialContent]);

  // Debounced TOC headings calculation to avoid lag on long documents
  useEffect(() => {
    const timer = setTimeout(() => {
      setHeadings(extractHeadings(content));
    }, 200);
    return () => clearTimeout(timer);
  }, [content]);

  // Statistics calculation
  const stats = useMemo(() => {
    const text = content.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const lines = content.split('\n').length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { chars, words, lines, readingTimeMinutes };
  }, [content]);

  // Search matches indices in content
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const fullText = content.toLowerCase();
    const indices: number[] = [];
    let pos = 0;
    while (pos < fullText.length) {
      const found = fullText.indexOf(query, pos);
      if (found === -1) break;
      indices.push(found);
      pos = found + query.length;
    }
    return indices;
  }, [searchQuery, content]);

  // Navigate to current search match in editor
  useEffect(() => {
    if (!isSearchOpen || searchMatches.length === 0 || !searchQuery.trim()) return;
    const matchPos = searchMatches[currentMatchIndex];
    if (matchPos !== undefined && textareaRef.current && mode === 'edit') {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(matchPos, matchPos + searchQuery.length);
      const linesBefore = content.substring(0, matchPos).split('\n').length;
      const lineHeight = 22;
      textareaRef.current.scrollTop = Math.max(0, (linesBefore - 4) * lineHeight);
    }
  }, [currentMatchIndex, searchMatches, isSearchOpen, mode, searchQuery, content]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const handleReplace = () => {
    if (!searchQuery || searchMatches.length === 0) return;
    const matchPos = searchMatches[currentMatchIndex];
    const newContent =
      content.substring(0, matchPos) +
      replaceQuery +
      content.substring(matchPos + searchQuery.length);
    setContent(newContent);
  };

  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    setContent(content.replace(regex, replaceQuery));
  };

  const handlePrint = () => {
    window.print();
  };

  const hasUnsavedChanges = content !== originalContent || (isCreating && fileName !== 'Nuova nota.md');

  // Insert markdown snippet at textarea cursor position
  const insertSnippet = (before: string, after: string = '', defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultPlaceholder;

    const newText =
      content.substring(0, start) +
      before +
      selectedText +
      after +
      content.substring(end);

    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle Tab key in textarea for clean indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // Save handler
  const handleSave = async () => {
    let finalName = fileName.trim();
    if (!finalName) {
      finalName = 'Documento.md';
    }
    if (!finalName.toLowerCase().endsWith('.md') && !finalName.toLowerCase().endsWith('.markdown')) {
      finalName += '.md';
    }

    setIsSaving(true);
    try {
      await onSave(finalName, content, item?.id);
      setOriginalContent(content);
      setFileName(finalName);
      if (item) {
        setMode('view');
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to save markdown:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy document markdown text
  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Close confirmation if dirty
  const handleRequestClose = () => {
    if (hasUnsavedChanges && mode === 'edit') {
      if (window.confirm('Hai delle modifiche non salvate. Sei sicuro di voler uscire?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div data-print-container="true" className="fixed inset-0 z-50 w-screen h-screen bg-white flex flex-col overflow-hidden animate-fade-in select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-gray-50/95 shrink-0 no-print">
        <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
          <button
            onClick={handleRequestClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-gray-200/70 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer text-xs font-semibold shrink-0"
            title="Torna alla navigazione del Drive"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Drive</span>
          </button>

          <div className="h-4 w-px bg-gray-300 mx-1 hidden sm:block" />

          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
            <FileCode className="w-4 h-4" />
          </div>

          {isCreating || mode === 'edit' ? (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Nome del file (es. Appunti.md)"
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              <h3 className="text-base font-semibold text-gray-900 truncate" title={fileName}>
                {fileName}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-200 shrink-0">
                Markdown
              </span>
            </div>
          )}
        </div>


          {/* Action Bar & Mode Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Actions */}
            {mode === 'view' && item && (
              <>
                <button
                  onClick={() => setIsTocOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    isTocOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                  title="Mostra / Nascondi indice dei contenuti"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Indice</span>
                </button>

                <button
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
                  title="Modifica questo documento"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modifica</span>
                </button>

                <button
                  onClick={() => {
                    setIsSearchOpen((prev) => !prev);
                    if (!isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                    isSearchOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-600'
                  }`}
                  title="Cerca nel documento (Ctrl+F)"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  onClick={handleCopyContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 transition-colors cursor-pointer"
                  title="Copia testo negli appunti"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copiato!' : 'Copia'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="p-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors cursor-pointer"
                  title="Stampa / Esporta in PDF formattato (Ctrl+P)"
                >
                  <Printer className="w-4 h-4" />
                </button>

                {onExport && (
                  <button
                    onClick={() => onExport(item)}
                    className="p-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors cursor-pointer"
                    title="Esporta copia su disco"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}

                {onOpenExternally && (
                  <button
                    onClick={() => onOpenExternally(item)}
                    className="p-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors cursor-pointer"
                    title="Apri con app di sistema"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {/* Edit / Create Mode Actions */}
            {mode === 'edit' && (
              <>
                <button
                  onClick={() => {
                    setIsSearchOpen((prev) => !prev);
                    if (!isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className={`p-1.5 rounded-xl border mr-1 transition-colors cursor-pointer ${
                    isSearchOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-600'
                  }`}
                  title="Cerca e sostituisci nel documento (Ctrl+F)"
                >
                  <Search className="w-4 h-4" />
                </button>

                {/* Layout Switcher */}
                <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg mr-2">
                  <button
                    onClick={() => setEditorLayout('edit-only')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      editorLayout === 'edit-only' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Solo Editor"
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setEditorLayout('split')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      editorLayout === 'split' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Editor e Anteprima affiancati"
                  >
                    <Columns className="w-3 h-3" />
                    <span>Split</span>
                  </button>
                  <button
                    onClick={() => setEditorLayout('preview-only')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      editorLayout === 'preview-only' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Solo Anteprima"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Anteprima</span>
                  </button>
                </div>

                {item && (
                  <button
                    onClick={() => {
                      if (hasUnsavedChanges && !window.confirm('Annullare le modifiche non salvate?')) {
                        return;
                      }
                      setContent(originalContent);
                      setMode('view');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
                  >
                    Annulla
                  </button>
                )}

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Salvataggio...' : isCreating ? 'Crea file' : 'Salva'}</span>
                </button>
              </>
            )}

            {/* Close Button */}
            <button
              onClick={handleRequestClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer ml-1"
              title="Chiudi visualizzatore"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Replace Floating Bar */}
        {isSearchOpen && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-gray-200 text-xs shrink-0 select-none flex-wrap no-print">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-300">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                placeholder="Cerca nel testo..."
                className="outline-hidden text-xs text-gray-800 placeholder:text-gray-400 w-44"
              />
            </div>

            <span className="text-gray-500 font-mono text-[11px] min-w-[70px]">
              {searchMatches.length > 0
                ? `${currentMatchIndex + 1} di ${searchMatches.length}`
                : searchQuery.trim()
                ? 'Nessun riscontro'
                : ''}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMatch}
                disabled={searchMatches.length === 0}
                className="p-1 rounded bg-white hover:bg-gray-100 disabled:opacity-30 border border-gray-200 text-gray-600 cursor-pointer"
                title="Riscontro precedente"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNextMatch}
                disabled={searchMatches.length === 0}
                className="p-1 rounded bg-white hover:bg-gray-100 disabled:opacity-30 border border-gray-200 text-gray-600 cursor-pointer"
                title="Riscontro successivo"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {mode === 'edit' && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Sostituisci con..."
                  className="px-2.5 py-1 bg-white rounded-lg border border-gray-300 outline-hidden text-xs text-gray-800 placeholder:text-gray-400 w-40"
                />
                <button
                  onClick={handleReplace}
                  disabled={searchMatches.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-30 border border-gray-200 text-gray-700 font-medium cursor-pointer"
                >
                  Sostituisci
                </button>
                <button
                  onClick={handleReplaceAll}
                  disabled={searchMatches.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-30 border border-gray-200 text-gray-700 font-medium cursor-pointer"
                >
                  Tutti
                </button>
              </div>
            )}

            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 ml-auto cursor-pointer"
              title="Chiudi ricerca (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* Formatting Toolbar (Only in Edit Mode) */}
        {mode === 'edit' && editorLayout !== 'preview-only' && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white overflow-x-auto shrink-0 select-none no-print">
            <button
              type="button"
              onClick={() => insertSnippet('# ', '', 'Titolo')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Intestazione 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('## ', '', 'Sottotitolo')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Intestazione 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('### ', '', 'Sezione')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Intestazione 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => insertSnippet('**', '**', 'grassetto')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Grassetto"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('*', '*', 'corsivo')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Corsivo"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('~~', '~~', 'testo barrato')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Barrato"
            >
              <Strikethrough className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => insertSnippet('- ', '', 'Elemento')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Elenco puntato"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('1. ', '', 'Elemento')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Elenco numerato"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('- [ ] ', '', 'Attività da fare')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Checklist / Attività"
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => insertSnippet('`', '`', 'codice')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Codice inline"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('```\n', '\n```', '// blocco di codice')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Blocco di codice"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('> ', '', 'Citazione')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Citazione"
            >
              <Quote className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => insertSnippet('$', '$', 'E = mc^2')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Formula LaTeX inline ($...$)"
            >
              <Sigma className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertSnippet('$$\n', '\n$$', '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}')
              }
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Blocco Formula LaTeX ($$...$$)"
            >
              <SquareFunction className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertSnippet('$\\textcolor{#2563eb}{', '}$', 'x^2 + y^2 = r^2')
              }
              className="p-1.5 rounded-lg hover:bg-gray-100 text-indigo-600 hover:text-indigo-900 transition-colors cursor-pointer"
              title="Formula LaTeX con Colore"
            >
              <Palette className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => insertSnippet('<span style="color: #2563eb">', '</span>', 'testo colorato')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-blue-600 hover:text-blue-900 transition-colors cursor-pointer"
              title="Testo colorato (HTML span)"
            >
              <span className="font-bold text-xs px-1 py-0.5 rounded bg-blue-50 border border-blue-200">Colore</span>
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('![', '](https://)', 'Descrizione immagine')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Inserisci Immagine"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('[', '](https://)', 'Testo del link')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Inserisci Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertSnippet(
                  '| Intestazione 1 | Intestazione 2 |\n|---|---|\n| Cella 1 | Cella 2 |\n'
                )
              }
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Tabella Markdown"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('\n---\n')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              title="Linea divisoria"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex bg-white">
          {/* Mode View: Reader View with Collapsible TOC Sidebar */}
          {mode === 'view' && (
            <div className="flex-1 flex overflow-hidden w-full h-full">
              {/* Dynamic Table of Contents Sidebar */}
              {isTocOpen && (
                <aside className="w-64 border-r border-gray-200 bg-gray-50/80 p-4 overflow-y-auto shrink-0 select-none custom-scrollbar hidden md:block no-print">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Indice ({headings.length})
                    </span>
                    <button
                      onClick={() => setIsTocOpen(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 cursor-pointer"
                      title="Nascondi indice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {headings.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nessun titolo nel documento.</p>
                  ) : (
                    <nav className="space-y-1">
                      {headings.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => {
                            const el = document.getElementById(h.id);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className={`w-full text-left truncate rounded-lg py-1 px-2 text-xs transition-colors hover:bg-gray-200/70 cursor-pointer ${
                            h.level === 1
                              ? 'font-bold text-gray-900'
                              : h.level === 2
                              ? 'pl-3.5 font-medium text-gray-700'
                              : 'pl-6 text-gray-500 text-[11px]'
                          }`}
                          title={h.text}
                        >
                          {h.text}
                        </button>
                      ))}
                    </nav>
                  )}
                </aside>
              )}

              {/* Reader Document Canvas */}
              <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full markdown-print-area">
                <article className="prose prose-slate max-w-none markdown-body text-gray-800">
                  {(() => {
                    let headingIndex = 0;
                    return (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                        components={{
                          h1: ({ node, children, ...props }) => {
                            const h = headings[headingIndex++];
                            return (
                              <h1
                                id={h?.id}
                                className="text-2xl md:text-3xl font-bold text-gray-900 pb-2 mb-4 border-b border-gray-200 mt-2 scroll-mt-6"
                                {...props}
                              >
                                {children}
                              </h1>
                            );
                          },
                          h2: ({ node, children, ...props }) => {
                            const h = headings[headingIndex++];
                            return (
                              <h2
                                id={h?.id}
                                className="text-xl md:text-2xl font-semibold text-gray-900 pb-1 mb-3 border-b border-gray-100 mt-6 scroll-mt-6"
                                {...props}
                              >
                                {children}
                              </h2>
                            );
                          },
                          h3: ({ node, children, ...props }) => {
                            const h = headings[headingIndex++];
                            return (
                              <h3
                                id={h?.id}
                                className="text-lg md:text-xl font-semibold text-gray-800 mb-2 mt-5 scroll-mt-6"
                                {...props}
                              >
                                {children}
                              </h3>
                            );
                          },
                          p: ({ node, ...props }) => (
                            <p className="text-sm md:text-base leading-relaxed text-gray-700 mb-4" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-6 space-y-1 text-sm md:text-base text-gray-700 mb-4" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-6 space-y-1 text-sm md:text-base text-gray-700 mb-4" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="leading-relaxed" {...props} />
                          ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-4 border-blue-500 bg-blue-50/50 pl-4 py-2 my-4 rounded-r-lg text-gray-700 italic text-sm md:text-base" {...props} />
                          ),
                          code: ({ node, inline, className, children, ...props }: any) => {
                            if (inline) {
                              return (
                                <code className="px-1.5 py-0.5 rounded-md bg-gray-100 text-pink-600 font-mono text-xs font-semibold border border-gray-200" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            const match = /language-(\w+)/.exec(className || '');
                            const lang = match ? match[1] : '';
                            const rawCode = String(children).replace(/\n$/, '');
                            const grammar = lang && Prism.languages[lang] ? Prism.languages[lang] : null;
                            let highlighted = escapeHtml(rawCode);
                            if (grammar) {
                              try {
                                highlighted = Prism.highlight(rawCode, grammar, lang);
                              } catch {
                                highlighted = escapeHtml(rawCode);
                              }
                            }

                        return (
                          <div className="relative my-4 rounded-xl overflow-hidden border border-gray-700 bg-gray-900 text-gray-100 shadow-sm font-mono text-xs md:text-sm">
                            <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800/90 border-b border-gray-700 text-gray-400 text-xs select-none">
                              <span className="font-mono uppercase text-[10px] tracking-wider text-blue-400 font-semibold">
                                {lang || 'Codice'}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(rawCode);
                                }}
                                className="hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
                                title="Copia codice"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copia</span>
                              </button>
                            </div>
                            <pre className="p-4 overflow-x-auto font-mono text-xs md:text-sm leading-relaxed !bg-transparent !m-0 !text-gray-100">
                              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                            </pre>
                          </div>
                        );
                      },
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 rounded-xl border border-gray-200 shadow-xs">
                          <table className="w-full text-left text-sm text-gray-700 divide-y divide-gray-200" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-900 uppercase tracking-wider" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th className="px-4 py-3 border-b border-gray-200" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2.5 border-b border-gray-100" {...props} />
                      ),
                      hr: ({ node, ...props }) => (
                        <hr className="my-6 border-gray-200" {...props} />
                      ),
                      a: ({ node, href, children, ...props }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-medium inline-flex items-center gap-0.5"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      img: ({ node, src, alt, ...props }: any) => (
                        <span className="block my-5 text-center">
                          <img
                            src={src}
                            alt={alt || 'Immagine'}
                            className="max-h-96 max-w-full mx-auto rounded-xl border border-gray-200 shadow-sm object-contain"
                            loading="lazy"
                            {...props}
                          />
                          {alt && alt !== 'immagine' && (
                            <span className="block text-xs text-gray-500 mt-1.5 italic">{alt}</span>
                          )}
                        </span>
                      ),
                      input: ({ node, ...props }) => (
                        <input
                          type="checkbox"
                          disabled
                          className="mr-2 rounded text-blue-600 focus:ring-blue-500 cursor-default"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {content || '*Nessun contenuto nel file.*'}
                  </ReactMarkdown>
                    );
                  })()}
                </article>
              </div>
            </div>
          )}

          {/* Mode Edit: Split or Single View */}
          {mode === 'edit' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Textarea Editor */}
              {(editorLayout === 'split' || editorLayout === 'edit-only') && (
                <div
                  className={`flex-1 flex flex-col h-full bg-white ${
                    editorLayout === 'split' ? 'border-r border-gray-200' : ''
                  }`}
                >
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scrivi qui in Markdown..."
                    className="w-full h-full p-5 font-mono text-sm leading-relaxed text-gray-900 bg-white resize-none outline-hidden overflow-y-auto selection:bg-blue-100"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Live Preview Panel */}
              {(editorLayout === 'split' || editorLayout === 'preview-only') && (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200 flex items-center justify-between">
                    <span>Anteprima in tempo reale</span>
                    <span className="text-[11px] font-normal text-gray-500">Formattato GFM + LaTeX</span>
                  </div>
                  <article className="prose prose-slate max-w-none text-gray-800">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, rehypeKatex]}
                      components={{
                        h1: ({ node, ...props }) => (
                          <h1 className="text-xl md:text-2xl font-bold text-gray-900 pb-2 mb-3 border-b border-gray-200 mt-2" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2 className="text-lg md:text-xl font-semibold text-gray-900 pb-1 mb-2 border-b border-gray-100 mt-5" {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2 mt-4" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="text-sm leading-relaxed text-gray-700 mb-3" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 mb-3" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700 mb-3" {...props} />
                        ),
                        blockquote: ({ node, ...props }) => (
                          <blockquote className="border-l-4 border-blue-500 bg-blue-50/50 pl-3 py-1.5 my-3 rounded-r-lg text-gray-700 italic text-sm" {...props} />
                        ),
                        code: ({ node, inline, className, children, ...props }: any) => {
                          if (inline) {
                            return (
                              <code className="px-1.5 py-0.5 rounded-md bg-gray-100 text-pink-600 font-mono text-xs font-semibold border border-gray-200" {...props}>
                                {children}
                              </code>
                            );
                          }
                          const match = /language-(\w+)/.exec(className || '');
                          const lang = match ? match[1] : '';
                          const rawCode = String(children).replace(/\n$/, '');
                          const grammar = lang && Prism.languages[lang] ? Prism.languages[lang] : null;
                          let highlighted = escapeHtml(rawCode);
                          if (grammar) {
                            try {
                              highlighted = Prism.highlight(rawCode, grammar, lang);
                            } catch {
                              highlighted = escapeHtml(rawCode);
                            }
                          }

                          return (
                            <pre className="p-3 my-3 rounded-xl bg-gray-900 text-gray-100 overflow-x-auto font-mono text-xs border border-gray-800 leading-relaxed">
                              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                            </pre>
                          );
                        },
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-3 rounded-lg border border-gray-200">
                            <table className="w-full text-left text-xs text-gray-700 divide-y divide-gray-200" {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }) => (
                          <th className="px-3 py-2 bg-gray-50 font-semibold text-gray-900 border-b border-gray-200" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="px-3 py-2 border-b border-gray-100" {...props} />
                        ),
                        hr: ({ node, ...props }) => (
                          <hr className="my-4 border-gray-200" {...props} />
                        ),
                        a: ({ node, href, children, ...props }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                            {...props}
                          >
                            {children}
                          </a>
                        ),
                        img: ({ node, src, alt, ...props }: any) => (
                          <span className="block my-3 text-center">
                            <img
                              src={src}
                              alt={alt || 'Immagine'}
                              className="max-h-72 max-w-full mx-auto rounded-lg border border-gray-200 shadow-xs object-contain"
                              loading="lazy"
                              {...props}
                            />
                            {alt && alt !== 'immagine' && (
                              <span className="block text-xs text-gray-500 mt-1 italic">{alt}</span>
                            )}
                          </span>
                        ),
                        input: ({ node, ...props }) => (
                          <input
                            type="checkbox"
                            disabled
                            className="mr-2 rounded text-blue-600"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {content || '*Inizia a digitare per vedere l\'anteprima...*'}
                    </ReactMarkdown>
                  </article>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 shrink-0 select-none no-print">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <span>{stats.words} parole</span>
            </span>
            <span>{stats.chars} caratteri</span>
            <span>{stats.lines} righe</span>
            <span className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3 h-3" />
              <span>~{stats.readingTimeMinutes} min lettura</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-amber-600 font-medium">Modifiche non salvate</span>
            )}
            <span className="text-gray-400">
              Scorciatoia: <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded-sm font-mono text-[10px] text-gray-600 shadow-2xs">Ctrl+S</kbd> per salvare
            </span>
          </div>
        </div>
      </div>
  );
};


export default MarkdownModal;
