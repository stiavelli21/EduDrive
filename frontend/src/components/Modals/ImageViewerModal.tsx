import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { DriveItem } from '../../types';
import { formatBytes, formatDate, isImageFile } from '../../utils/formatters';

interface ImageViewerModalProps {
  isOpen: boolean;
  item: DriveItem | null;
  allItems?: DriveItem[];
  onClose: () => void;
  onNavigateItem?: (item: DriveItem) => void;
  onOpenExternally: (item: DriveItem) => void;
  onExport: (item: DriveItem) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  item,
  allItems = [],
  onClose,
  onNavigateItem,
  onOpenExternally,
  onExport,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter only images in current list for gallery navigation
  const imageItems = useMemo(() => {
    return allItems.filter((i) => !i.isFolder && isImageFile(i.name, i.mimeType));
  }, [allItems]);

  const currentIndex = useMemo(() => {
    if (!item) return -1;
    return imageItems.findIndex((i) => i.id === item.id);
  }, [imageItems, item]);

  // Reset zoom, rotation and pan when item changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setNaturalDimensions(null);
    }
  }, [isOpen, item?.id]);

  // Navigate to previous image
  const handlePrev = useCallback(() => {
    if (currentIndex > 0 && onNavigateItem) {
      onNavigateItem(imageItems[currentIndex - 1]);
    }
  }, [currentIndex, imageItems, onNavigateItem]);

  // Navigate to next image
  const handleNext = useCallback(() => {
    if (currentIndex < imageItems.length - 1 && onNavigateItem) {
      onNavigateItem(imageItems[currentIndex + 1]);
    }
  }, [currentIndex, imageItems, onNavigateItem]);

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 400));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 25, 25);
      if (next <= 100) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const next = e.deltaY < 0 ? Math.min(prev + 15, 400) : Math.max(prev - 15, 25);
      if (next <= 100) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Double click toggle zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom === 100) {
      setZoom(200);
    } else {
      handleResetZoom();
    }
  };

  // Drag to pan image when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || zoom <= 100) return; // Only pan when zoomed in
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Window-level mouseup listener to avoid stuck dragging state
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Listen for fullscreen change to keep state synced (Esc, F11, etc.)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation listener (Left, Right, Esc, +, -, 0, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || !item) return null;

  const imageUrl = `/storage/${item.storagePath}`;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < imageItems.length - 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-slate-950/95 backdrop-blur-md overflow-hidden animate-fade-in select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header Bar */}
      <header className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 text-white z-10 shrink-0">
        {/* Left: Image Info */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold truncate max-w-md text-slate-100" title={item.name}>
                {item.name}
              </h2>
              {imageItems.length > 1 && currentIndex !== -1 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {currentIndex + 1} / {imageItems.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{formatBytes(item.sizeBytes)}</span>
              {naturalDimensions && (
                <>
                  <span>•</span>
                  <span>
                    {naturalDimensions.width} × {naturalDimensions.height} px
                  </span>
                </>
              )}
              <span>•</span>
              <span>{formatDate(item.updatedAt)}</span>
            </p>
          </div>
        </div>

        {/* Right: Actions Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 mr-1">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              title="Riduci zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 text-xs font-mono font-medium text-slate-200 hover:text-white cursor-pointer"
              title="Reimposta zoom (100%) [0]"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 400}
              className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
              title="Aumenta zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors cursor-pointer"
            title="Ruota di 90° in senso orario (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-xl transition-colors cursor-pointer"
            title="Schermo intero (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Chiudi visualizzatore (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <div
        className={`relative flex-1 flex items-center justify-center overflow-hidden ${
          isDragging ? 'cursor-grabbing' : zoom > 100 ? 'cursor-grab' : 'cursor-default'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDoubleClick={handleDoubleClick}
      >
        {/* Previous Button */}
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-5 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-sm border border-slate-700/50 transition-all shadow-lg hover:scale-105 cursor-pointer"
            title="Immagine precedente (Freccia sinistra)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Container with Transform */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className="max-w-[90%] max-h-[90%] flex items-center justify-center pointer-events-none"
        >
          <img
            src={imageUrl}
            alt={item.name}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }}
            className="max-h-[82vh] max-w-[85vw] object-contain rounded-lg shadow-2xl transition-all"
            draggable={false}
          />
        </div>

        {/* Next Button */}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-5 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-sm border border-slate-700/50 transition-all shadow-lg hover:scale-105 cursor-pointer"
            title="Immagine successiva (Freccia destra)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Info Strip */}
      <footer className="flex items-center justify-between px-5 py-2 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-400 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <span>Scorciatoie: ← / → (Naviga), +/- (Zoom), 0 (Reset), R (Ruota), Esc (Chiudi)</span>
        </div>
        <div>
          <span>Trascina con il mouse per esplorare l'immagine ingrandita</span>
        </div>
      </footer>
    </div>
  );
};
