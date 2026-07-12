// =============================================================================
// EduDrive — Download Format Selection Modal ("Convertitore alla Rovescia")
// =============================================================================
// Prompts the user to choose the download format (.md, .docx, .txt) when
// downloading a Markdown document. If .docx or .txt is chosen, the backend
// reverse-converts the Markdown into the chosen format while keeping highlighted
// words and formatting intact.
// =============================================================================

import { useState, useEffect } from 'react';
import { X, Download, FileText, BookOpen, AlignLeft, Check, Loader2 } from 'lucide-react';
import api from '../services/api.js';

export default function DownloadFormatModal({ node, onClose }) {
  const [selectedFormat, setSelectedFormat] = useState('md');
  const [downloading, setDownloading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !downloading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, downloading]);

  const handleConfirmDownload = async () => {
    if (!node?.id) return;
    setDownloading(true);
    setError(null);

    try {
      const response = await api.get(`/nodes/${node.id}/export?format=${selectedFormat}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const baseName = (node.name || 'documento.md').replace(/\.md$/i, '');
      const extension = selectedFormat === 'docx' ? '.docx' : selectedFormat === 'txt' ? '.txt' : '.md';
      a.download = `${baseName}${extension}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Download error:', err);
      setError('Si è verificato un errore durante la conversione o il download del file.');
      setDownloading(false);
    }
  };

  const formats = [
    {
      id: 'md',
      label: 'Markdown (.md)',
      Icon: BookOpen,
      colorClass: 'text-brand-400 bg-brand-500/15 border-brand-500/30',
      activeClass: 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10',
    },
    {
      id: 'docx',
      label: 'Documento Word (.docx)',
      Icon: FileText,
      colorClass: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
      activeClass: 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10',
    },
    {
      id: 'txt',
      label: 'Testo Semplice (.txt)',
      Icon: AlignLeft,
      colorClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
      activeClass: 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-surface-100/95 border border-surface-300/80 rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 flex flex-col gap-6 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-300/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
              <Download className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                Scegli Formato di Scaricamento
              </h3>
              <p className="text-xs text-text-muted truncate max-w-[280px] sm:max-w-[340px]">
                {node?.name || 'documento.md'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={downloading}
            className="p-2 rounded-xl hover:bg-surface-300 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Grid */}
        <div className="flex flex-col gap-3">
          {formats.map((fmt) => {
            const isSelected = selectedFormat === fmt.id;
            const { Icon, colorClass, activeClass } = fmt;
            return (
              <div
                key={fmt.id}
                onClick={() => !downloading && setSelectedFormat(fmt.id)}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                  isSelected
                    ? `${activeClass} ring-1 ring-brand-500`
                    : 'bg-surface-200/50 border-surface-300 hover:bg-surface-200 hover:border-surface-400'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm sm:text-base text-text-primary block">
                    {fmt.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-error/15 border border-error/30 text-error text-xs font-medium flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-300/60">
          <button
            onClick={onClose}
            disabled={downloading}
            className="px-4 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirmDownload}
            disabled={downloading || success}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg ${
              success
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'btn-primary'
            }`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Conversione in corso...</span>
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                <span>Scaricato!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Scarica in .{selectedFormat}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
