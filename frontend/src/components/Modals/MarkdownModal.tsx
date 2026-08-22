import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
} from 'lucide-react';
import { DriveItem } from '../../types';

interface MarkdownModalProps {
  isOpen: boolean;
  item?: DriveItem | null; // If null/undefined, mode is "create"
  initialContent?: string;
  onClose: () => void;
  onSave: (name: string, content: string, id?: string) => Promise<void>;
  onExport?: (item: DriveItem) => void;
  onOpenExternally?: (item: DriveItem) => void;
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize or reset state when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFileName(item.name);
        setContent(initialContent);
        setOriginalContent(initialContent);
        setMode('view');
      } else {
        setFileName('Nuovo documento.md');
        setContent('');
        setOriginalContent('');
        setMode('edit');
        setEditorLayout('split');
      }
      setIsCopied(false);
    }
  }, [isOpen, item, initialContent]);

  // Statistics calculation
  const stats = useMemo(() => {
    const text = content.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const lines = content.split('\n').length;
    const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { chars, words, lines, readingTimeMinutes };
  }, [content]);

  const hasUnsavedChanges = content !== originalContent || (isCreating && fileName !== 'Nuovo documento.md');

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
    <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex flex-col overflow-hidden animate-fade-in select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-gray-50/95 shrink-0">
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
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
                  title="Modifica questo documento"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modifica</span>
                </button>

                <button
                  onClick={handleCopyContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200 transition-colors cursor-pointer"
                  title="Copia testo negli appunti"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copiato!' : 'Copia'}</span>
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


        {/* Formatting Toolbar (Only in Edit Mode) */}
        {mode === 'edit' && editorLayout !== 'preview-only' && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white overflow-x-auto shrink-0 select-none">
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
          {/* Mode View: Pure Reader View */}
          {mode === 'view' && (
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              <article className="prose prose-slate max-w-none markdown-body text-gray-800">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 pb-2 mb-4 border-b border-gray-200 mt-2" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-xl md:text-2xl font-semibold text-gray-900 pb-1 mb-3 border-b border-gray-100 mt-6" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-2 mt-5" {...props} />
                    ),
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
                      return (
                        <div className="relative my-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-900 text-gray-100 shadow-sm font-mono text-xs md:text-sm">
                          <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800/80 border-b border-gray-700 text-gray-400 text-xs">
                            <span>Codice</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(String(children));
                              }}
                              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                              title="Copia codice"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copia</span>
                            </button>
                          </div>
                          <pre className="p-4 overflow-x-auto font-mono">
                            <code {...props}>{children}</code>
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
              </article>
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
                    <span className="text-[11px] font-normal text-gray-500">Formattato GFM</span>
                  </div>
                  <article className="prose prose-slate max-w-none text-gray-800">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
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
                          return (
                            <pre className="p-3 my-3 rounded-xl bg-gray-900 text-gray-100 overflow-x-auto font-mono text-xs border border-gray-800">
                              <code {...props}>{children}</code>
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
        <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 shrink-0 select-none">
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
