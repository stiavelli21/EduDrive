import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, Sparkles, MessageSquarePlus, X, RotateCcw } from 'lucide-react';

export interface ImageRegionSelectorProps {
  imageSrc: string;
  imageName: string;
  zoomLevel?: number;
  onCropSelected: (base64Png: string, prompt?: string) => void;
}

interface Rect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const ImageRegionSelector: React.FC<ImageRegionSelectorProps> = ({
  imageSrc,
  imageName,
  zoomLevel = 100,
  onCropSelected,
}) => {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [completedCrop, setCompletedCrop] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resetSelection = useCallback(() => {
    setRect(null);
    setCompletedCrop(null);
    setIsDragging(false);
  }, []);

  // Clear selection if mode is toggled off
  useEffect(() => {
    if (!isSelectMode) {
      resetSelection();
    }
  }, [isSelectMode, resetSelection]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelectMode || !imgRef.current) return;
    const bounds = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, e.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, e.clientY - bounds.top));

    setCompletedCrop(null);
    setRect({ startX: x, startY: y, currentX: x, currentY: y });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !rect || !imgRef.current) return;
    const bounds = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, e.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, e.clientY - bounds.top));

    setRect((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
  };

  const handleMouseUp = () => {
    if (!isDragging || !rect) return;
    setIsDragging(false);

    const x = Math.min(rect.startX, rect.currentX);
    const y = Math.min(rect.startY, rect.currentY);
    const width = Math.abs(rect.currentX - rect.startX);
    const height = Math.abs(rect.currentY - rect.startY);

    // Only register meaningful crops (at least 15x15 pixels)
    if (width > 15 && height > 15) {
      setCompletedCrop({ x, y, width, height });
    } else {
      resetSelection();
    }
  };

  // Extracts the image crop as a base64 string
  const handleExtractCrop = (promptText?: string) => {
    if (!completedCrop || !imgRef.current) return;
    const img = imgRef.current;

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const sourceX = completedCrop.x * scaleX;
    const sourceY = completedCrop.y * scaleY;
    const sourceWidth = completedCrop.width * scaleX;
    const sourceHeight = completedCrop.height * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth));
    canvas.height = Math.max(1, Math.round(sourceHeight));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];

    onCropSelected(base64Data, promptText);
    resetSelection();
    setIsSelectMode(false);
  };

  // Coordinates of the box being drawn or completed
  const activeBox = completedCrop || (rect ? {
    x: Math.min(rect.startX, rect.currentX),
    y: Math.min(rect.startY, rect.currentY),
    width: Math.abs(rect.currentX - rect.startX),
    height: Math.abs(rect.currentY - rect.startY),
  } : null);

  return (
    <div className="relative w-full h-full flex flex-col items-center overflow-auto p-4 select-none">
      {/* Selection Mode Toolbar Header */}
      <div className="sticky top-2 z-30 flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md text-xs mb-4">
        <button
          onClick={() => {
            setIsSelectMode(!isSelectMode);
            if (isSelectMode) resetSelection();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
            isSelectMode
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title="Attiva/disattiva la selezione rettangolare per chiedere spiegazioni su una parte dell'immagine"
        >
          <Crop className="w-3.5 h-3.5" />
          <span>{isSelectMode ? 'Modalita ritaglio attiva' : 'Seleziona area per IA'}</span>
        </button>

        {isSelectMode && (
          <span className="text-gray-500 text-[11px] hidden sm:inline">
            Trascina col mouse sull'immagine per selezionare una formula o appunto
          </span>
        )}

        {completedCrop && (
          <button
            onClick={resetSelection}
            className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Azzera rettangolo di selezione"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Azzera</span>
          </button>
        )}
      </div>

      {/* Image Container with Selection Overlay */}
      <div
        ref={containerRef}
        style={{
          transform: `scale(${zoomLevel / 100})`,
          transformOrigin: 'top center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
        className="relative inline-block max-w-full my-auto"
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt={imageName}
          draggable={false}
          className={`max-w-full max-h-[80vh] rounded-xl shadow-lg border border-gray-200 object-contain block ${
            isSelectMode ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

        {/* Dragging / Selected Box Visual Indicator */}
        {activeBox && (
          <div
            style={{
              position: 'absolute',
              left: `${activeBox.x}px`,
              top: `${activeBox.y}px`,
              width: `${activeBox.width}px`,
              height: `${activeBox.height}px`,
              pointerEvents: isDragging ? 'none' : 'auto',
            }}
            className="border-2 border-dashed border-indigo-600 bg-indigo-500/20 rounded-md backdrop-blur-2xs"
          >
            {/* Corner dots */}
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-xs" />
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-xs" />
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-xs" />
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-xs" />

            {/* Action Popup near the completed box */}
            {completedCrop && !isDragging && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: activeBox.y > 60 ? '100%' : 'auto',
                  top: activeBox.y > 60 ? 'auto' : '100%',
                  transform: 'translateX(-50%)',
                }}
                className="my-2 z-40 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border border-indigo-200 rounded-2xl shadow-xl whitespace-nowrap animate-slide-up text-xs select-none"
              >
                <button
                  onClick={() =>
                    handleExtractCrop('Cosa spiega o dimostra questa parte dell\'appunto?')
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Chiedi all'assistente IA di spiegare questa porzione dell'immagine"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Spiega questa parte</span>
                </button>

                <button
                  onClick={() => handleExtractCrop('')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-medium transition-colors cursor-pointer"
                  title="Allega quest'area alla chat per fare una domanda specifica"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Chiedi</span>
                </button>

                <button
                  onClick={resetSelection}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                  title="Annulla selezione"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
