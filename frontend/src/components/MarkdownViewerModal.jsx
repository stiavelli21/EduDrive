// =============================================================================
// EduDrive — Built-in Markdown Reader Modal
// =============================================================================
// Displays .md files directly within the application with premium aesthetics:
//   - Rich GitHub-flavored Markdown rendering (tables, code blocks, checklists)
//   - Toggle between Preview Mode and Raw Source Code
//   - Document statistics (word count, character count, estimated reading time)
//   - Quick copy to clipboard & direct file download
//   - Glassmorphism & smooth animations
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DownloadFormatModal from './DownloadFormatModal.jsx';
import api from '../services/api.js';
import {
  X,
  FileText,
  BookOpen,
  Code,
  Copy,
  Check,
  Download,
  Loader2,
  Eye,
  Clock,
  AlignLeft,
  AlertCircle,
} from 'lucide-react';
import { getMarkdownColor } from '../utils/colors.js';

export default function MarkdownViewerModal({ node, onClose }) {
  const customColor = getMarkdownColor(node?.color);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('preview'); // 'preview' | 'raw'
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const codeBlockCounter = useRef(0);

  // --- Fetch Markdown Content -----------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!node?.id && !node?.storageKey && !node?.downloadUrl && !node?.url && !node?.key) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadMarkdownContent() {
      // 1. Prova prima tramite ID se disponibile
      if (node?.id) {
        try {
          const res = await api.get(`/nodes/${node.id}/content?inline=true`, { responseType: 'text' });
          const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
          if (typeof res.data !== 'string' || (!res.data.trim().startsWith('<!DOCTYPE html>') && !res.data.trim().startsWith('<html'))) {
            if (isMounted) {
              setContent(text);
              setLoading(false);
            }
            return;
          }
        } catch (_) {
          // Fallback a passaggi successivi in caso di errore (es. file locale o non in cloud)
        }
      }

      // 2. Prova tramite local-download se e' disponibile una storageKey o key (file locale su disco)
      const storageOrKey = node?.storageKey || node?.key;
      if (storageOrKey) {
        try {
          const resContent = await api.get(`/nodes/local-download?key=${encodeURIComponent(storageOrKey)}&inline=true`, { responseType: 'text' });
          const text = typeof resContent.data === 'string' ? resContent.data : JSON.stringify(resContent.data, null, 2);
          if (typeof resContent.data !== 'string' || (!resContent.data.trim().startsWith('<!DOCTYPE html>') && !resContent.data.trim().startsWith('<html'))) {
            if (isMounted) {
              setContent(text);
              setLoading(false);
            }
            return;
          }
        } catch (_) {
          // Passa al tentativo successivo se fallisce
        }
      }

      // 3. Fallback finale via downloadUrl o url del nodo
      try {
        let dlUrl = node?.downloadUrl || node?.url;
        if (!dlUrl && node?.id) {
          const { data } = await api.get(`/nodes/${node.id}`);
          if (data?.node?.downloadUrl) {
            dlUrl = data.node.downloadUrl;
          }
        }

        if (dlUrl) {
          if (dlUrl.startsWith('/api/') || dlUrl.startsWith('/')) {
            const cleanPath = dlUrl.replace(/^\/api\/?/, '/');
            const resContent = await api.get(`${cleanPath}${cleanPath.includes('?') ? '&' : '?'}inline=true`, { responseType: 'text' });
            const text = typeof resContent.data === 'string' ? resContent.data : JSON.stringify(resContent.data, null, 2);
            if (typeof resContent.data !== 'string' || (!resContent.data.trim().startsWith('<!DOCTYPE html>') && !resContent.data.trim().startsWith('<html'))) {
              if (isMounted) {
                setContent(text);
                setLoading(false);
              }
              return;
            }
          } else {
            const resp = await fetch(dlUrl);
            if (resp.ok) {
              const text = await resp.text();
              if (!text.trim().startsWith('<!DOCTYPE html>') && !text.trim().startsWith('<html')) {
                if (isMounted) {
                  setContent(text);
                  setLoading(false);
                }
                return;
              }
            }
          }
        }
      } catch (_) {
        // Fallimento di tutte le procedure
      }

      if (isMounted) {
        setError('Impossibile caricare il contenuto del file Markdown locale.');
        setLoading(false);
      }
    }

    loadMarkdownContent();

    return () => { isMounted = false; };
  }, [node]);

  // --- Statistics -----------------------------------------------------------
  const wordCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // --- Actions --------------------------------------------------------------
  const handleCopyText = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCodeBlock = (text, index) => {
    navigator.clipboard.writeText(text);
    setCodeCopied(index);
    setTimeout(() => setCodeCopied(null), 2000);
  };

  const handleDownload = () => {
    setShowDownloadModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="bg-surface-100/95 border border-surface-300/80 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- Header -------------------------------------------------------- */}
        <div className="px-5 py-4 border-b border-surface-300/60 bg-surface-200/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${customColor.bg} flex items-center justify-center shrink-0 border ${customColor.border}`}>
              <BookOpen className={`w-5 h-5 ${customColor.text}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary truncate">
                {node?.name || 'File Markdown'}
              </h2>
              {!loading && !error && (
                <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                  <span className="flex items-center gap-1">
                    <AlignLeft className="w-3 h-3 text-brand-400" />
                    {wordCount} {wordCount === 1 ? 'parola' : 'parole'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    ~{readingTimeMin} min lettura
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Controls & Mode Switch */}
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <>
                {/* Preview vs Raw Switch */}
                <div className="flex bg-surface-300/80 p-1 rounded-xl border border-surface-400/50">
                  <button
                    onClick={() => setMode('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${mode === 'preview'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                      }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Anteprima
                  </button>
                  <button
                    onClick={() => setMode('raw')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${mode === 'raw'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                      }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Sorgente
                  </button>
                </div>

                {/* Copy Button */}
                <button
                  onClick={handleCopyText}
                  title="Copia l'intero testo markdown"
                  className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-text-secondary hover:text-text-primary border border-surface-300 transition-colors flex items-center gap-1 text-xs font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="hidden sm:inline text-emerald-400">Copiato!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="hidden sm:inline">Copia</span>
                    </>
                  )}
                </button>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  title="Scarica il file .md"
                  className={`group p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium ${downloading
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 scale-105 shadow-sm'
                      : 'bg-surface-200 hover:bg-surface-300 text-text-secondary hover:text-text-primary border-surface-300'
                    }`}
                >
                  {downloading ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
                      <span className="hidden sm:inline font-semibold">Scaricato!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-brand-400 transition-transform group-hover:-translate-y-0.5" />
                      <span className="hidden sm:inline">Scarica</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-300 text-text-muted hover:text-text-primary transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* --- Body ---------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar bg-surface-100/40">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 animate-pulse">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
              <p className="text-sm font-medium text-text-primary">
                Caricamento file Markdown in corso...
              </p>
              <p className="text-xs text-text-muted mt-1">
                Decodifica e formattazione dell'anteprima
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-error" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">
                Errore di lettura
              </h3>
              <p className="text-sm text-text-secondary max-w-md mb-6">
                {error}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-surface-300 hover:bg-surface-400 text-text-primary rounded-xl text-sm font-medium transition-colors"
              >
                Chiudi
              </button>
            </div>
          )}

          {!loading && !error && mode === 'preview' && (
            <div className="max-w-4xl mx-auto py-2">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    mark: ({ children }) => (
                      <mark className="bg-amber-300 dark:bg-amber-400/85 text-slate-900 px-1.5 py-0.5 rounded font-medium shadow-sm border border-amber-400/60 not-italic">
                        {children}
                      </mark>
                    ),
                    h1: ({ children }) => (
                      <h1 className={`text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${customColor.gradient} pb-3 mb-6 border-b border-surface-300/80 flex items-center gap-2`}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl sm:text-2xl font-bold text-text-primary pb-2 mt-8 mb-4 border-b border-surface-300/50">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className={`text-lg sm:text-xl font-semibold ${customColor.textAccent} mt-6 mb-3`}>
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-base sm:text-lg font-medium text-text-primary mt-5 mb-2">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-text-secondary leading-relaxed mb-4 text-sm sm:text-base">
                        {children}
                      </p>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${customColor.text} ${customColor.textHover} underline font-medium transition-colors`}
                      >
                        {children}
                      </a>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-4 space-y-2 text-text-secondary pl-2 text-sm sm:text-base">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-4 space-y-2 text-text-secondary pl-2 text-sm sm:text-base">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">
                        {children}
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className={`border-l-4 ${customColor.borderAccent} ${customColor.badgeBg} px-5 py-3.5 rounded-r-xl my-5 text-text-secondary italic shadow-inner`}>
                        {children}
                      </blockquote>
                    ),
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeText = String(children).replace(/\n$/, '');

                      // Inline code: no className means no language fence
                      if (!className) {
                        return (
                          <code className={`px-1.5 py-0.5 rounded-md bg-surface-300/90 ${customColor.textAccent} font-mono text-xs border border-surface-400/60`} {...props}>
                            {children}
                          </code>
                        );
                      }

                      // Block code: use a unique numeric index for copy state
                      const blockIdx = codeBlockCounter.current++;

                      return (
                        <div className="my-5 rounded-xl border border-surface-300/80 bg-surface-300/40 overflow-hidden shadow-lg">
                          <div className="px-4 py-2 bg-surface-300/80 border-b border-surface-400/40 flex items-center justify-between text-xs font-mono text-text-muted">
                            <span>{match ? match[1].toUpperCase() : 'CODICE'}</span>
                            <button
                              onClick={() => handleCopyCodeBlock(codeText, blockIdx)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-200 hover:bg-surface-400 text-text-secondary hover:text-text-primary transition-colors text-[11px]"
                            >
                              {codeCopied === blockIdx ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copiato</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copia</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 overflow-x-auto text-xs sm:text-sm font-mono text-text-primary leading-relaxed bg-surface-200/40">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-6 rounded-xl border border-surface-300 shadow-md">
                        <table className="w-full text-left border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-surface-300/90 border-b border-surface-400">
                        {children}
                      </thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-xs font-semibold text-text-primary uppercase tracking-wider">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2.5 text-sm text-text-secondary border-b border-surface-300/40">
                        {children}
                      </td>
                    ),
                    hr: () => (
                      <hr className="border-surface-300/80 my-8" />
                    ),
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt}
                        className="max-w-full h-auto rounded-xl shadow-lg my-5 border border-surface-300"
                      />
                    ),
                  }}
                >
                  {content.replace(/==([^=\r\n]+)==/g, '<mark>$1</mark>')}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {!loading && !error && mode === 'raw' && (
            <div className="max-w-4xl mx-auto py-2">
              <div className="bg-surface-200/70 border border-surface-300/80 rounded-xl p-5 overflow-x-auto shadow-inner">
                <pre className="font-mono text-xs sm:text-sm text-text-primary leading-relaxed whitespace-pre-wrap select-text">
                  {content}
                </pre>
              </div>
            </div>
          )}
        </div>

      </div>

      {showDownloadModal && (
        <DownloadFormatModal
          node={node}
          onClose={() => setShowDownloadModal(false)}
        />
      )}
    </div>
  );
}
