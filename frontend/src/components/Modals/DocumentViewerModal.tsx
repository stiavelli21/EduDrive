import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as docx from 'docx-preview';
import {
  FileText,
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Printer,
  FileCode,
  Loader2,
  AlertCircle,
  Video,
  Music,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { DriveItem } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { PdfViewer } from '../AI/PdfViewer';
import { ImageRegionSelector } from '../AI/ImageRegionSelector';
import { SelectionPopover } from '../AI/SelectionPopover';
import { AIPanel } from '../AI/AIPanel';
import { AISettingsModal } from './AISettingsModal';

interface DocumentViewerModalProps {
  isOpen: boolean;
  item: DriveItem | null;
  onClose: () => void;
  onConvertToMarkdown: (item: DriveItem) => void;
  onOpenAsMarkdown?: (item: DriveItem) => void;
  onOpenExternally: (item: DriveItem) => void;
  onExport: (item: DriveItem) => void;
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
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // AI Assistant Panel & Selection Popover State
  const [isAIPanelOpen, setIsAIPanelOpen] = useState<boolean>(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState<boolean>(false);
  const [popoverState, setPopoverState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

  const [aiExternalRequest, setAiExternalRequest] = useState<{
    question?: string;
    selectedText?: string;
    imageCropBase64?: string;
    imageCropMime?: string;
  } | null>(null);

  const docxContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fileUrl = useMemo(() => {
    if (!item || !item.storagePath) return '';
    return `/storage/${item.storagePath}`;
  }, [item]);

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
      item.mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      item.mimeType === 'application/msword'
    );
  }, [item]);

  const isVideo = useMemo(() => {
    if (!item) return false;
    const name = item.name.toLowerCase();
    return (
      item.mimeType.startsWith('video/') ||
      name.endsWith('.mp4') ||
      name.endsWith('.webm') ||
      name.endsWith('.ogg') ||
      name.endsWith('.mov') ||
      name.endsWith('.mkv')
    );
  }, [item]);

  const isAudio = useMemo(() => {
    if (!item) return false;
    const name = item.name.toLowerCase();
    return (
      item.mimeType.startsWith('audio/') ||
      name.endsWith('.mp3') ||
      name.endsWith('.wav') ||
      name.endsWith('.ogg') ||
      name.endsWith('.flac') ||
      name.endsWith('.m4a') ||
      name.endsWith('.aac')
    );
  }, [item]);

  const isImage = useMemo(() => {
    if (!item) return false;
    const name = item.name.toLowerCase();
    return (
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.webp') ||
      name.endsWith('.gif') ||
      item.mimeType?.startsWith('image/')
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
      setPdfBytes(null);
      setBlobUrl(null);
      setPopoverState({ visible: false, x: 0, y: 0, text: '' });
      setAiExternalRequest(null);

      try {
        if (isDocx) {
          // Fetch binary arrayBuffer directly from streaming endpoint without Base64 overhead
          const res = await fetch(`/storage/${item.storagePath}`);
          if (!res.ok) {
            throw new Error(`Impossibile scaricare il documento Word (${res.status})`);
          }
          const arrayBuffer = await res.arrayBuffer();
          if (!active) return;

          // Render DOCX into container
          setTimeout(async () => {
            if (!active || !docxContainerRef.current) return;
            try {
              docxContainerRef.current.innerHTML = '';
              await docx.renderAsync(arrayBuffer, docxContainerRef.current, undefined, {
                className: 'docx',
                inWrapper: false,
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
              if (active) setIsLoading(false);
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
        } else if (isPdf) {
          const res = await fetch(`/storage/${item.storagePath}`);
          if (!res.ok) {
            throw new Error(`Impossibile scaricare il documento PDF (${res.status})`);
          }
          const arrayBuffer = await res.arrayBuffer();
          if (!active) return;
          setPdfBytes(new Uint8Array(arrayBuffer));
          setIsLoading(false);
        } else if (isImage) {
          const res = await fetch(`/storage/${item.storagePath}`);
          if (!res.ok) {
            throw new Error(`Impossibile scaricare l'immagine (${res.status})`);
          }
          const blob = await res.blob();
          if (!active) return;
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
          setIsLoading(false);
        } else {
          // For Video, Audio and generic fallbacks, the streaming endpoint is used directly
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load document:', err);
        if (active) {
          setErrorMessage(err?.message || err?.toString() || 'Errore nel caricamento del file');
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
  }, [isOpen, item, isPdf, isDocx, isImage, isVideo, isAudio]);

  // Keyboard shortcut listener (Esc to close, Ctrl+P to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isAISettingsOpen) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isAISettingsOpen]);

  // Zoom helpers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 50));
  const handleResetZoom = () => setZoomLevel(100);

  // Print handler
  const handlePrint = () => {
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

  // Handle selection in DOCX container
  const handleDocxMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setPopoverState((p) => ({ ...p, visible: false }));
      return;
    }
    const text = sel.toString().trim();
    if (text.length > 0) {
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setPopoverState({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top,
          text,
        });
      } catch {
        // Fallback
      }
    }
  };

  // Triggered when an action is selected from the SelectionPopover
  const handleExplainSelection = (text: string, promptText?: string) => {
    setIsAIPanelOpen(true);
    setAiExternalRequest({
      question: promptText,
      selectedText: text,
    });
  };

  // Triggered when an image area is cropped from ImageRegionSelector
  const handleImageCropSelected = (base64Png: string, promptText?: string) => {
    setIsAIPanelOpen(true);
    setAiExternalRequest({
      question: promptText,
      imageCropBase64: base64Png,
      imageCropMime: 'image/png',
    });
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full bg-white overflow-hidden animate-fade-in select-none">
      <div className="flex flex-col w-full h-full bg-white overflow-hidden">
        {/* Header Toolbar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-slate-50/95 backdrop-blur-xs select-none shrink-0">
          {/* Left: Document Info & Badge */}
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div
              className={`p-2 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isPdf
                  ? 'bg-red-500 text-white'
                  : isDocx
                  ? 'bg-blue-600 text-white'
                  : isVideo
                  ? 'bg-purple-600 text-white'
                  : isAudio
                  ? 'bg-emerald-600 text-white'
                  : isImage
                  ? 'bg-amber-600 text-white'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              {isVideo ? (
                <Video className="w-5 h-5" />
              ) : isAudio ? (
                <Music className="w-5 h-5" />
              ) : isImage ? (
                <ImageIcon className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
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
                      : isVideo
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : isAudio
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : isImage
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {isPdf
                    ? 'PDF'
                    : isDocx
                    ? 'Word DOCX'
                    : isVideo
                    ? 'Video'
                    : isAudio
                    ? 'Audio'
                    : isImage
                    ? 'Immagine / Note'
                    : 'Documento'}
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
            {/* AI Assistant Toggle Button */}
            <button
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer ${
                isAIPanelOpen
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-500/20'
                  : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
              title="Apri / chiudi l'assistente IA per questo appunto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assistente IA</span>
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block" />

            {/* Convert to Markdown (.md) - Only for Word DOCX */}
            {isDocx && (
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Crea una copia convertita in formato Markdown (.md)"
              >
                {isConverting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-600" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-gray-600" />
                )}
                <span>Converti in .md</span>
              </button>
            )}

            {/* Open Externally */}
            <button
              onClick={() => onOpenExternally(item)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Apri con l'applicazione predefinita di Windows"
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

            {/* Zoom Controls (Only for DOCX or Image) */}
            {(isDocx || isImage) && (
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 ml-1">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 50}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                  title="Riduci zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-white rounded-md transition-colors cursor-pointer"
                  title="Reimposta zoom al 100%"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 200}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                  title="Aumenta zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="h-4 w-px bg-gray-200 mx-1" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              title="Chiudi visualizzatore (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Viewer Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Visualizer Area */}
          <div className="flex-1 flex overflow-hidden relative">
            {isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-50">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-gray-600">
                  Elaborazione e caricamento documento in corso...
                </p>
              </div>
            ) : errorMessage ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Errore di visualizzazione
                </h3>
                <p className="text-sm text-gray-500 max-w-md mb-6">{errorMessage}</p>
                <div className="flex items-center gap-3">
                  {isDocx && (
                    <button
                      onClick={() => {
                        onClose();
                        onConvertToMarkdown(item);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileCode className="w-4 h-4" />
                      <span>Converti in .md</span>
                    </button>
                  )}
                  <button
                    onClick={() => onOpenExternally(item)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Apri esternamente</span>
                  </button>
                </div>
              </div>
            ) : isPdf && pdfBytes ? (
              /* PDF Viewer with pdf.js and TextLayer selection */
              <PdfViewer
                data={pdfBytes}
                onTextSelect={(text, x, y) =>
                  setPopoverState({ visible: true, x, y, text })
                }
                onClearSelection={() =>
                  setPopoverState((p) => ({ ...p, visible: false }))
                }
              />
            ) : isImage && blobUrl ? (
              /* Image / Handwritten Notes with Bounding Box Region Selector */
              <ImageRegionSelector
                imageSrc={blobUrl}
                imageName={item.name}
                zoomLevel={zoomLevel}
                onCropSelected={handleImageCropSelected}
              />
            ) : isDocx ? (
              /* DOCX Viewer with Paper Canvas & Text Selection */
              <div
                className="w-full h-full overflow-auto p-4 sm:p-8 flex justify-center bg-slate-100/90 custom-scrollbar"
                onMouseUp={handleDocxMouseUp}
              >
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
                    style={{
                      '--docx-selection-color':
                        localStorage.getItem('edudrive_highlighter_tint') === 'yellow'
                          ? 'rgba(234, 179, 8, 0.38)'
                          : localStorage.getItem('edudrive_highlighter_tint') === 'sky'
                          ? 'rgba(14, 165, 233, 0.35)'
                          : localStorage.getItem('edudrive_highlighter_tint') === 'emerald'
                          ? 'rgba(16, 185, 129, 0.35)'
                          : localStorage.getItem('edudrive_highlighter_tint') === 'rose'
                          ? 'rgba(244, 63, 94, 0.35)'
                          : 'rgba(99, 102, 241, 0.35)',
                    } as React.CSSProperties}
                    className="docx-render-host text-gray-900 select-text"
                  />
                </div>
              </div>
            ) : isVideo ? (
              /* Video Streaming Player with Range Support */
              <div className="w-full h-full flex items-center justify-center p-6 bg-black">
                <video
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  src={fileUrl}
                >
                  Il tuo browser non supporta la riproduzione video.
                </video>
              </div>
            ) : isAudio ? (
              /* Audio Streaming Player with Range Support */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-900 gap-6">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
                  <Music className="w-12 h-12" />
                </div>
                <p className="text-white text-base font-medium max-w-md truncate">{item.name}</p>
                <audio
                  controls
                  autoPlay
                  className="w-full max-w-md shadow-lg"
                  src={fileUrl}
                >
                  Il tuo browser non supporta la riproduzione audio.
                </audio>
              </div>
            ) : (
              /* Generic Fallback Viewer */
              <iframe
                ref={iframeRef}
                src={fileUrl}
                title={item.name}
                className="w-full h-full border-0 bg-white"
              />
            )}
          </div>

          {/* AI Chat Assistant Sidebar */}
          <AIPanel
            isOpen={isAIPanelOpen}
            onClose={() => setIsAIPanelOpen(false)}
            onOpenSettings={() => setIsAISettingsOpen(true)}
            itemId={item.id}
            documentName={item.name}
            externalRequest={aiExternalRequest}
            onClearExternalRequest={() => setAiExternalRequest(null)}
          />
        </div>

        {/* Footer Info Strip */}
        <footer className="flex items-center justify-between px-5 py-2 border-t border-gray-200 bg-white text-xs text-gray-500 select-none shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Lettore integrato EduDrive con Assistente IA</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline">
              Seleziona il testo o un'area per farti spiegare il concetto dall'IA
            </span>
          </div>
        </footer>
      </div>

      {/* Floating Selection Popover */}
      <SelectionPopover
        visible={popoverState.visible}
        x={popoverState.x}
        y={popoverState.y}
        selectedText={popoverState.text}
        onExplain={handleExplainSelection}
        onClose={() => setPopoverState((p) => ({ ...p, visible: false }))}
      />

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
      />
    </div>
  );
};

export default DocumentViewerModal;
