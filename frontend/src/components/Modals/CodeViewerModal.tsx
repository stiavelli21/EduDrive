import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Code2,
  X,
  Save,
  Edit3,
  Eye,
  Copy,
  Check,
  Download,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
} from 'lucide-react';
import { DriveItem } from '../../types';
import { formatBytes, formatDate, escapeHtml } from '../../utils/formatters';

interface CodeViewerModalProps {
  isOpen: boolean;
  item: DriveItem | null;
  initialContent: string;
  onClose: () => void;
  onSave: (id: string, content: string) => Promise<void>;
  onOpenExternally: (item: DriveItem) => void;
  onExport: (item: DriveItem) => void;
}

// Map file extension to Prism language key
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'tsx':
      return 'tsx';
    case 'py':
      return 'python';
    case 'sql':
      return 'sql';
    case 'json':
      return 'json';
    case 'html':
    case 'xml':
    case 'svg':
      return 'markup';
    case 'css':
    case 'scss':
      return 'css';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'cpp';
    case 'java':
      return 'java';
    case 'sh':
    case 'bash':
      return 'bash';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
      return 'markdown';
    default:
      return 'plain';
  }
}

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  isOpen,
  item,
  initialContent,
  onClose,
  onSave,
  onOpenExternally,
  onExport,
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const viewContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens or item changes
  useEffect(() => {
    if (isOpen && item) {
      setContent(initialContent);
      setOriginalContent(initialContent);
      setMode('view');
      setIsCopied(false);
      setIsSearchOpen(false);
      setSearchQuery('');
      setCurrentMatchIndex(0);
    }
  }, [isOpen, item, initialContent]);

  const hasUnsavedChanges = content !== originalContent;
  const langKey = useMemo(() => (item ? getLanguageFromFilename(item.name) : 'plain'), [item]);

  // Split lines for line numbers
  const lines = useMemo(() => {
    return content.split('\n');
  }, [content]);

  // Syntax highlighted HTML in view mode with plain text and safety fallback
  const highlightedCode = useMemo(() => {
    const grammar = Prism.languages[langKey];
    if (!grammar) {
      return escapeHtml(content);
    }
    try {
      return Prism.highlight(content, grammar, langKey);
    } catch {
      return escapeHtml(content);
    }
  }, [content, langKey]);

  // Search matches calculation
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const matches: { line: number; index: number }[] = [];
    lines.forEach((lineText, lineIdx) => {
      let startIndex = 0;
      const lowerLine = lineText.toLowerCase();
      while (startIndex < lowerLine.length) {
        const found = lowerLine.indexOf(query, startIndex);
        if (found === -1) break;
        matches.push({ line: lineIdx + 1, index: found });
        startIndex = found + query.length;
      }
    });
    return matches;
  }, [searchQuery, lines]);

  // Navigate to current search match
  useEffect(() => {
    if (!isSearchOpen || searchMatches.length === 0 || !searchQuery.trim()) return;
    const match = searchMatches[currentMatchIndex];
    if (!match) return;

    if (mode === 'edit' && textareaRef.current) {
      let charOffset = 0;
      for (let i = 0; i < match.line - 1; i++) {
        charOffset += lines[i].length + 1;
      }
      charOffset += match.index;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charOffset, charOffset + searchQuery.length);
      const lineHeight = 24;
      textareaRef.current.scrollTop = Math.max(0, (match.line - 4) * lineHeight);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    } else if (mode === 'view') {
      const lineEl = document.getElementById(`code-gutter-line-${match.line}`);
      lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, searchMatches, isSearchOpen, searchQuery, mode, lines]);

  // Search navigation
  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else {
          handleRequestClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSearchOpen, content, hasUnsavedChanges]);

  // Save handler
  const handleSave = async () => {
    if (!item) return;
    setIsSaving(true);
    try {
      await onSave(item.id, content);
      setOriginalContent(content);
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy code
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Tab indentation in edit mode
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
  };

  const handleRequestClose = () => {
    if (hasUnsavedChanges && mode === 'edit') {
      if (window.confirm('Hai delle modifiche non salvate. Sei sicuro di voler uscire?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden animate-fade-in select-text">
      {/* Header Toolbar */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0 select-none">
        {/* Left: Info */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold truncate max-w-md text-slate-100" title={item.name}>
                {item.name}
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-md font-mono uppercase tracking-wider bg-slate-800 text-blue-400 border border-slate-700">
                {langKey}
              </span>
              {hasUnsavedChanges && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                  Non salvato
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{lines.length} righe</span>
              <span>•</span>
              <span>{content.length} caratteri</span>
              <span>•</span>
              <span>{formatBytes(item.sizeBytes)}</span>
              <span>•</span>
              <span>Modificato: {formatDate(item.updatedAt)}</span>
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-800/90 p-0.5 rounded-xl border border-slate-700/60 mr-1">
            <button
              onClick={() => setMode('view')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mode === 'view' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visualizza</span>
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                mode === 'edit' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modifica</span>
            </button>
          </div>

          {/* Search Toggle */}
          <button
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (!isSearchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }
            }}
            className={`p-2 rounded-xl transition-colors border cursor-pointer ${
              isSearchOpen
                ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-300'
            }`}
            title="Cerca nel codice (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Save button in Edit mode */}
          {mode === 'edit' && (
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Salva modifiche (Ctrl+S)"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Salva</span>
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors cursor-pointer"
            title="Copia tutto il codice"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Open Externally */}
          <button
            onClick={() => onOpenExternally(item)}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors cursor-pointer"
            title="Apri con app predefinita di sistema"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Export */}
          <button
            onClick={() => onExport(item)}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors cursor-pointer"
            title="Esporta copia su disco"
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Close */}
          <button
            onClick={handleRequestClose}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Chiudi editor (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Search Bar Floating Dropdown */}
      {isSearchOpen && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 text-xs text-slate-200 z-20 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentMatchIndex(0);
            }}
            placeholder="Cerca nel codice..."
            className="px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 focus:outline-hidden focus:border-blue-500 w-64 text-slate-100 placeholder:text-slate-500"
          />

          <span className="text-slate-400 font-mono text-[11px] min-w-[70px]">
            {searchMatches.length > 0
              ? `${currentMatchIndex + 1} di ${searchMatches.length}`
              : searchQuery.trim()
              ? 'Nessun risultato'
              : ''}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMatch}
              disabled={searchMatches.length === 0}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
              title="Corrispondenza precedente"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={searchMatches.length === 0}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
              title="Corrispondenza successiva"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-200 ml-auto cursor-pointer"
            title="Chiudi ricerca (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor / Viewer Body */}
      <div className="flex-1 flex overflow-hidden bg-slate-950 font-mono text-xs md:text-sm">
        {mode === 'view' ? (
          /* View Mode with Syntax Highlighting and Line Numbers */
          <div ref={viewContainerRef} className="flex-1 flex overflow-auto custom-scrollbar">
            {/* Gutter */}
            <div className="py-4 px-3 select-none text-right text-slate-600 bg-slate-900/60 border-r border-slate-800/80 font-mono text-xs leading-6 shrink-0 min-w-[48px]">
              {lines.map((_, i) => {
                const isMatchLine = isSearchOpen && searchMatches[currentMatchIndex]?.line === i + 1;
                return (
                  <div
                    key={i}
                    id={`code-gutter-line-${i + 1}`}
                    className={isMatchLine ? 'text-blue-400 font-bold bg-blue-500/20 rounded px-1' : ''}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {/* Code Content */}
            <div className="flex-1 py-4 px-4 overflow-x-auto">
              <pre className="!bg-transparent !p-0 !m-0 !font-mono text-xs md:text-sm leading-6 whitespace-pre">
                <code
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                  className={`language-${langKey}`}
                />
              </pre>
            </div>
          </div>
        ) : (
          /* Edit Mode with Live Textarea and Line Numbers Gutter */
          <div className="flex-1 flex overflow-hidden">
            {/* Line Numbers Gutter (Synchronized with textarea scroll) */}
            <div
              ref={gutterRef}
              className="py-4 px-3 select-none text-right text-slate-600 bg-slate-900/60 border-r border-slate-800/80 font-mono text-xs leading-6 shrink-0 min-w-[48px] overflow-hidden"
            >
              {lines.map((_, i) => {
                const isMatchLine = isSearchOpen && searchMatches[currentMatchIndex]?.line === i + 1;
                return (
                  <div
                    key={i}
                    className={isMatchLine ? 'text-blue-400 font-bold bg-blue-500/20 rounded px-1' : ''}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {/* Editable Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              onScroll={(e) => {
                if (gutterRef.current) {
                  gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              wrap="off"
              spellCheck={false}
              placeholder="Inserisci il codice qui..."
              className="flex-1 p-4 bg-transparent font-mono text-xs md:text-sm leading-6 text-slate-100 resize-none outline-hidden overflow-auto selection:bg-blue-600/40 custom-scrollbar whitespace-pre"
            />
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <footer className="flex items-center justify-between px-5 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 select-none shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>{lines.length} righe</span>
          </span>
          <span>{content.length} caratteri</span>
          <span>Codifica: UTF-8</span>
        </div>

        <div className="flex items-center gap-4">
          {mode === 'edit' && (
            <span className="text-slate-400">
              Scorciatoia: <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Ctrl+S</kbd> per salvare
            </span>
          )}
          <span>
            <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Ctrl+F</kbd> per cercare
          </span>
        </div>
      </footer>
    </div>
  );
};
