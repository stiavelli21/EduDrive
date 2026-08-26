import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as docx from 'docx-preview';
import {
  FileText,
  X,
  Download,
  ExternalLink,
  BookOpen,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Printer,
  Sparkles,
  Loader2,
  AlertCircle,
  Info,
  Calendar,
  HardDrive,
} from 'lucide-react';
import { DriveItem } from '../../types';
import { GetFileBase64 } from '../../../wailsjs/go/main/App';
import { formatBytes, formatDate } from '../../utils/formatters';

interface DocumentViewerModalProps {
  isOpen: boolean;
  item: DriveItem | null;
  onClose: () => void;
  onConvertToMarkdown: (item: DriveItem) => void;
  onOpenAsMarkdown: (item: DriveItem) => void;
  onOpenExternally: (item: DriveItem) => void;
  onExport: (item: DriveItem) => void;
}

/**
 * Converts a base64 encoded string into a Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  item,
  onClose,
  onConvertToMarkdown,
  onOpenAsMarkdown,
  onOpenExternally,
  onExport,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const docxContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isPdf = useMemo(() => {
    if (!item) return false;
    const name = item.name.toLowerCase();
    return name.endsWith('.pdf') || item.mimeType === 'application/pdf';
  }, [item]);

  const isDocx = useMemo(() => {
    if (!item) return false;
    const name = item.name.toLowerCase();
    return (
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      item.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      item.mimeType === 'application/msword'
    );
  }, [item]);

  // Load and render document when modal opens or item changes
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    const loadDocument = async () => {
      if (!isOpen || !item) return;

      setIsLoading(true);
      setErrorMessage(null);
      setZoomLevel(100);

      // Clean up previous blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }

      try {
        const base64Data = await GetFileBase64(item.id);
        if (!active) return;

        if (!base64Data) {
          throw new Error('Contenuto del file non disponibile');
        }

        const uint8Data = base64ToUint8Array(base64Data);

        if (isPdf) {
          const pdfBlob = new Blob([uint8Data.buffer as ArrayBuffer], { type: 'application/pdf' });
          createdUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(createdUrl);
          setIsLoading(false);
        } else if (isDocx) {
          // Wait for container to be in DOM
          setTimeout(async () => {
            if (!active || !docxContainerRef.current) return;
            try {
              docxContainerRef.current.innerHTML = '';
              await docx.renderAsync(uint8Data.buffer as ArrayBuffer, docxContainerRef.current, undefined, {
                className: 'docx-viewer-content',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                ignoreFonts: false,
                breakPages: true,
                renderHeaders: true,
                renderFooters: true,
                renderFootnotes: true,
                renderEndnotes: true,
                useBase64URL: true,
              });
              setIsLoading(false);
            } catch (renderErr: any) {
              console.error('DOCX render error:', renderErr);
              if (active) {
                setErrorMessage(
                  'Impossibile visualizzare il layout di questo documento Word. Puoi comunque aprirlo come Markdown o con l\'applicazione di sistema.'
                );
                setIsLoading(false);
              }
            }
          }, 50);
        } else {
          // Fallback for other file types
          const fallbackBlob = new Blob([uint8Data.buffer as ArrayBuffer], { type: item.mimeType || 'application/octet-stream' });
          createdUrl = URL.createObjectURL(fallbackBlob);
          setBlobUrl(createdUrl);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load document:', err);
        if (active) {
          setErrorMessage(err?.toString() || 'Errore nel caricamento del file');
          setIsLoading(false);
        }
      }
    };

    if (isOpen && item) {
      loadDocument();
    } else {
      setIsLoading(false);
      setErrorMessage(null);
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, item, isPdf, isDocx]);

  // Keyboard shortcut listener (Esc to close, Ctrl+P to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Zoom helpers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 15, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 15, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  // Print handler
  const handlePrint = () => {
    if (isPdf && iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.print();
        return;
      } catch {
        // Fallback to window print
      }
    }
    window.print();
  };

  // Convert to Markdown with feedback
  const handleConvert = async () => {
    if (!item) return;
    setIsConverting(true);
    try {
      await onConvertToMarkdown(item);
    } finally {
      setIsConverting(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col w-full h-full bg-white overflow-hidden animate-fade-in ${
        isFullscreen ? 'p-0' : 'p-0'
      }`}
    >
      <div className="flex flex-col w-full h-full bg-white overflow-hidden">
        {/* Header Toolbar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-slate-50/90 backdrop-blur-xs select-none shrink-0">
          {/* Left: Document Info & Badge */}
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div
              className={`p-2 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isPdf
                  ? 'bg-red-500 text-white'
                  : isDocx
                  ? 'bg-blue-600 text-white'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  className="text-base font-semibold text-gray-900 truncate max-w-md"
                  title={item.name}
                >
                  {item.name}
                </h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-semibold tracking-wider uppercase shrink-0 ${
                    isPdf
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : isDocx
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {isPdf ? 'PDF' : isDocx ? 'Word DOCX' : 'Documento'}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <span>{formatBytes(item.sizeBytes)}</span>
                <span>•</span>
                <span>Modificato: {formatDate(item.updatedAt)}</span>
              </p>
            </div>
          </div>

          {/* Right: Actions Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {/* Convert to Markdown (.md) */}
            <button
              onClick={handleConvert}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Crea una copia convertita in formato Markdown (.md)"
            >
              {isConverting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              )}
              <span>Converti in .md</span>
            </button>

            {/* Open as Markdown (on the fly) */}
            <button
              onClick={() => {
                onClose();
                onOpenAsMarkdown(item);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Visualizza e modifica istantaneamente in formato Markdown con formule KaTeX"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Apri in .md</span>
            </button>

            {/* Open Externally */}
            <button
              onClick={() => onOpenExternally(item)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Apri con l'applicazione predefinita di Windows (es. Word, Acrobat)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden md:inline">App esterna</span>
            </button>

            {/* Export Copy */}
            <button
              onClick={() => onExport(item)}
              className="p-1.5 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Esporta copia su disco"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="p-1.5 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Stampa documento (Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Zoom Controls (Active for DOCX) */}
            {isDocx && (
              <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-xs px-1 py-0.5 ml-1">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 50}
                  className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 rounded hover:bg-gray-100 cursor-pointer"
                  title="Riduci zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer"
                  title="Reimposta zoom (100%)"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 200}
                  className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 rounded hover:bg-gray-100 cursor-pointer"
                  title="Aumenta zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-all shadow-xs active:scale-95 ml-1 cursor-pointer"
              title={isFullscreen ? 'Riduci finestra' : 'Schermo intero'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1 cursor-pointer"
              title="Chiudi lettore (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="relative flex-1 bg-slate-100 overflow-hidden flex flex-col items-center justify-center">
          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs gap-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                Caricamento e rendering del documento...
              </p>
            </div>
          )}

          {/* Error State */}
          {errorMessage ? (
            <div className="max-w-md p-6 bg-white rounded-2xl shadow-lg border border-red-200 text-center mx-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                Impossibile visualizzare l'anteprima
              </h3>
              <p className="text-sm text-gray-600">{errorMessage}</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenAsMarkdown(item);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Apri in .md</span>
                </button>
                <button
                  onClick={() => onOpenExternally(item)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Apri esternamente</span>
                </button>
              </div>
            </div>
          ) : isPdf ? (
            /* PDF Viewer (Chromium / WebView2 engine) */
            blobUrl ? (
              <iframe
                ref={iframeRef}
                src={`${blobUrl}#toolbar=1&navpanes=1&statusbar=1&view=FitH`}
                title={item.name}
                className="w-full h-full border-0 bg-slate-900"
              />
            ) : null
          ) : isDocx ? (
            /* DOCX Viewer (Paper Canvas with Zoom) */
            <div className="w-full h-full overflow-auto p-4 sm:p-8 flex justify-center bg-slate-200/80 custom-scrollbar">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="my-2"
              >
                <div
                  ref={docxContainerRef}
                  className="docx-render-host bg-white shadow-2xl rounded-xs min-h-[1056px] text-gray-900 select-text"
                />
              </div>
            </div>
          ) : (
            /* Generic Fallback Viewer */
            blobUrl && (
              <iframe
                src={blobUrl}
                title={item.name}
                className="w-full h-full border-0 bg-white"
              />
            )
          )}
        </div>

        {/* Footer Info Strip */}
        <footer className="flex items-center justify-between px-5 py-2 border-t border-gray-200 bg-white text-xs text-gray-500 select-none shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Lettore integrato EduDrive</span>
            <span>•</span>
            <span className="hidden sm:inline">
              Vuoi estrarre testo o formule matematiche in LaTeX? Clicca su{' '}
              <strong className="text-indigo-600 font-semibold cursor-pointer hover:underline" onClick={() => { onClose(); onOpenAsMarkdown(item); }}>
                "Apri in .md"
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline">Scorciatoie: Esc (Chiudi), Ctrl+P (Stampa)</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
