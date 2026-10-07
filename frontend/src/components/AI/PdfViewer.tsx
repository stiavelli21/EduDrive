import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  Highlighter,
  Check,
} from 'lucide-react';

// Configure the worker URL for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface HighlightPreset {
  id: string;
  name: string;
  color: string;
  dotClass: string;
}

export const HIGHLIGHT_PRESETS: HighlightPreset[] = [
  {
    id: 'indigo',
    name: 'Indaco Elegante',
    color: 'rgba(99, 102, 241, 0.35)',
    dotClass: 'bg-indigo-500',
  },
  {
    id: 'yellow',
    name: 'Giallo Evidenziatore',
    color: 'rgba(234, 179, 8, 0.38)',
    dotClass: 'bg-amber-400',
  },
  {
    id: 'sky',
    name: 'Azzurro Docente',
    color: 'rgba(14, 165, 233, 0.35)',
    dotClass: 'bg-sky-500',
  },
  {
    id: 'emerald',
    name: 'Verde Smeraldo',
    color: 'rgba(16, 185, 129, 0.35)',
    dotClass: 'bg-emerald-500',
  },
  {
    id: 'rose',
    name: 'Rosa Studio',
    color: 'rgba(244, 63, 94, 0.35)',
    dotClass: 'bg-rose-500',
  },
];

export interface PdfViewerProps {
  data: Uint8Array;
  onTextSelect?: (selectedText: string, clientX: number, clientY: number) => void;
  onClearSelection?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  data,
  onTextSelect,
  onClearSelection,
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [zoomLevel, setZoomLevel] = useState<number>(115);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPageRendering, setIsPageRendering] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Digital highlighter tint selection (persisted in localStorage)
  const [highlightId, setHighlightId] = useState<string>(() => {
    return localStorage.getItem('edudrive_highlighter_tint') || 'indigo';
  });
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // Explicit integer page dimensions to eliminate subpixel rounding drift
  const [pageDims, setPageDims] = useState<{ width: number; height: number; scale: number }>({
    width: 0,
    height: 0,
    scale: 1,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentRenderTaskRef = useRef<any>(null);

  const activePreset =
    HIGHLIGHT_PRESETS.find((p) => p.id === highlightId) || HIGHLIGHT_PRESETS[0];

  const handleSelectHighlightColor = (id: string) => {
    setHighlightId(id);
    localStorage.setItem('edudrive_highlighter_tint', id);
    setShowColorPicker(false);
  };

  // Close highlighter popover on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handleOutside = () => setShowColorPicker(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [showColorPicker]);

  // Load PDF Document from binary Uint8Array
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setErrorMessage(null);

    const loadingTask = pdfjsLib.getDocument({
      data: data.slice(0), // Provide a copy to avoid neutered ArrayBuffer issues
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/',
      cMapPacked: true,
    });

    loadingTask.promise
      .then((doc) => {
        if (!active) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setIsLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load PDF document:', err);
        setErrorMessage(err?.message || 'Impossibile leggere il file PDF.');
        setIsLoading(false);
      });

    return () => {
      active = false;
      loadingTask.destroy();
    };
  }, [data]);

  // Render current page onto Canvas and overlay pixel-perfect TextLayer
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

    // Cancel any ongoing render task before starting a new one
    if (currentRenderTaskRef.current) {
      try {
        currentRenderTaskRef.current.cancel();
      } catch {
        // Ignored
      }
      currentRenderTaskRef.current = null;
    }

    setIsPageRendering(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const textLayerDiv = textLayerRef.current;
      const pageContainer = pageContainerRef.current;
      if (!canvas || !textLayerDiv) return;

      const baseScale = 1.33; // Default visual scale matching typical 96dpi documents
      const scale = (zoomLevel / 100) * baseScale;
      const viewport = page.getViewport({ scale });

      const pixelWidth = Math.floor(viewport.width);
      const pixelHeight = Math.floor(viewport.height);

      setPageDims({ width: pixelWidth, height: pixelHeight, scale: viewport.scale });

      // Synchronize parent page container styling & required PDF.js variables
      if (pageContainer) {
        pageContainer.style.width = `${pixelWidth}px`;
        pageContainer.style.height = `${pixelHeight}px`;
        pageContainer.style.setProperty('--scale-factor', String(viewport.scale));
        pageContainer.style.setProperty('--total-scale-factor', String(viewport.scale));
        pageContainer.style.setProperty('--user-unit', '1');
        pageContainer.style.setProperty('--scale-round-x', '1px');
        pageContainer.style.setProperty('--scale-round-y', '1px');
        pageContainer.style.setProperty('--pdf-selection-color', activePreset.color);
      }

      // Configure high-DPI rendering for sharp text and graphics
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext = {
        canvasContext: ctx,
        transform,
        viewport,
      };

      const renderTask = page.render(renderContext);
      currentRenderTaskRef.current = renderTask;

      await renderTask.promise;
      currentRenderTaskRef.current = null;

      // Crucial step: wait for browser font-faces registered during canvas render to be parsed.
      // This prevents PDF.js from using fallback font metrics in measureText, which causes vertical baseline drift.
      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // Ignored
        }
      }

      // Setup Text Layer dimensions and properties with identical dimensions
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${pixelWidth}px`;
      textLayerDiv.style.height = `${pixelHeight}px`;
      textLayerDiv.style.setProperty('--scale-factor', String(viewport.scale));
      textLayerDiv.style.setProperty('--total-scale-factor', String(viewport.scale));
      textLayerDiv.style.setProperty('--user-unit', '1');
      textLayerDiv.style.setProperty('--scale-round-x', '1px');
      textLayerDiv.style.setProperty('--scale-round-y', '1px');
      textLayerDiv.style.setProperty('--pdf-selection-color', activePreset.color);

      // Prefer streamTextContent with marked content support for enhanced layout fidelity
      const textContentSource =
        typeof (page as any).streamTextContent === 'function'
          ? (page as any).streamTextContent({
              includeMarkedContent: true,
              disableNormalization: true,
            })
          : await page.getTextContent();

      const textLayer = new pdfjsLib.TextLayer({
        textContentSource,
        container: textLayerDiv,
        viewport,
      });

      await textLayer.render();

      // Guarantee locked pixel dimensions after PDF.js TextLayer layout calculations
      textLayerDiv.style.width = `${pixelWidth}px`;
      textLayerDiv.style.height = `${pixelHeight}px`;

      // End-of-content marker to support smooth drag-selections
      const endOfContent = document.createElement('div');
      endOfContent.className = 'endOfContent';
      textLayerDiv.appendChild(endOfContent);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    } finally {
      setIsPageRendering(false);
    }
  }, [pdfDoc, currentPage, zoomLevel, activePreset.color]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Handle selection inside Text Layer
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (onClearSelection) onClearSelection();
      return;
    }

    const text = sel.toString().trim();
    if (text.length > 0 && onTextSelect) {
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        onTextSelect(text, rect.left + rect.width / 2, rect.top);
      } catch {
        // Fallback
      }
    }
  };

  // Page Navigation Handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      setPageInput(String(next));
      if (onClearSelection) onClearSelection();
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      setPageInput(String(next));
      if (onClearSelection) onClearSelection();
    }
  };

  const handlePageInputCommit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
      setCurrentPage(parsed);
      if (onClearSelection) onClearSelection();
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(200, z + 15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(50, z - 15));
  const handleResetZoom = () => setZoomLevel(115);

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          Impossibile leggere il documento PDF
        </h3>
        <p className="text-xs text-gray-600">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden bg-slate-200/90 select-none">
      {/* Floating Toolbar: Page navigation, Highlighter tint, and Zoom */}
      <div className="sticky top-2 z-30 flex items-center justify-between gap-2 px-4 py-2 mx-auto my-2 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md text-xs max-w-3xl select-none">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Pagina precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form onSubmit={handlePageInputCommit} className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs hidden sm:inline">Pagina</span>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-10 px-1.5 py-0.5 text-center font-semibold text-gray-800 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 focus:bg-white"
            />
            <span className="text-gray-500 text-xs">di {numPages || 1}</span>
          </form>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            className="p-1.5 text-gray-600 hover:text-gray-900 disabled:opacity-30 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Pagina successiva"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center: rendering status & hint */}
        <div className="flex items-center gap-2 text-gray-500 text-[11px]">
          {isPageRendering ? (
            <span className="flex items-center gap-1 text-indigo-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Rendering pagina...</span>
            </span>
          ) : (
            <span className="hidden md:inline">
              Trascina per sottolineare il testo e attivare l'IA
            </span>
          )}
        </div>

        {/* Right: Highlighter Tint Palette & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Highlighter Tint Switcher */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1.5 px-2 py-1 text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer text-xs"
              title="Colore sottolineatura / evidenziatore"
            >
              <Highlighter className="w-3.5 h-3.5 text-indigo-600" />
              <span className={`w-3 h-3 rounded-full ${activePreset.dotClass} shadow-xs border border-white`} />
            </button>

            {showColorPicker && (
              <div className="absolute right-0 top-full mt-2 p-2 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col gap-1.5 z-50 min-w-[170px] animate-slide-up">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1">
                  Colore Evidenziatore
                </span>
                {HIGHLIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectHighlightColor(preset.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      preset.id === highlightId
                        ? 'bg-indigo-50 font-semibold text-indigo-900'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full ${preset.dotClass} shadow-xs`} />
                      <span>{preset.name}</span>
                    </div>
                    {preset.id === highlightId && (
                      <Check className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 hover:bg-white rounded-lg transition-colors cursor-pointer"
              title="Riduci zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 text-xs font-semibold text-gray-700 hover:text-gray-900 cursor-pointer"
              title="Reimposta zoom predefinito"
            >
              {zoomLevel}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 hover:bg-white rounded-lg transition-colors cursor-pointer"
              title="Aumenta zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Scroll Canvas with scoped PDF.js page architecture */}
      <div
        ref={containerRef}
        className="pdfViewer flex-1 overflow-auto p-4 sm:p-8 flex justify-center custom-scrollbar"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 my-auto">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-medium text-gray-600">Caricamento PDF...</p>
          </div>
        ) : (
          <div
            ref={pageContainerRef}
            className="page relative my-2 bg-white rounded-lg shadow-2xl shadow-slate-900/15 overflow-hidden"
            style={
              {
                width: pageDims.width > 0 ? `${pageDims.width}px` : undefined,
                height: pageDims.height > 0 ? `${pageDims.height}px` : undefined,
                '--scale-factor': String(pageDims.scale),
                '--total-scale-factor': String(pageDims.scale),
                '--user-unit': '1',
                '--scale-round-x': '1px',
                '--scale-round-y': '1px',
                '--pdf-selection-color': activePreset.color,
              } as React.CSSProperties
            }
            onMouseUp={handleMouseUp}
          >
            {/* The canvasWrapper contains the high-DPI rendered bitmap */}
            <div className="canvasWrapper absolute inset-0 pointer-events-none">
              <canvas ref={canvasRef} className="block w-full h-full" />
            </div>

            {/* The pdf.js textLayer is overlayed with pixel-perfect baseline alignment */}
            <div
              ref={textLayerRef}
              className="textLayer select-text"
            />
          </div>
        )}
      </div>
    </div>
  );
};
