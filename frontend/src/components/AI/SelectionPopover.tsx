import React, { useEffect, useRef } from 'react';
import { Sparkles, Lightbulb, Compass, MessageSquarePlus, X } from 'lucide-react';

export interface SelectionPopoverProps {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  onExplain: (text: string, actionPrompt?: string) => void;
  onClose: () => void;
}

export const SelectionPopover: React.FC<SelectionPopoverProps> = ({
  visible,
  x,
  y,
  selectedText,
  onExplain,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer adding the listener so the mouseup that made the selection does not immediately close it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible || !selectedText.trim()) return null;

  // Clamp coordinates within the viewport
  const popoverWidth = 360;
  const popoverHeight = 44;
  const clampedX = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, x - popoverWidth / 2));
  // Position above the selection if possible, otherwise below
  const clampedY = y - popoverHeight - 12 > 50 ? y - popoverHeight - 12 : y + 24;

  const handleAction = (promptText: string) => {
    onExplain(selectedText, promptText);
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        zIndex: 60,
      }}
      className="flex items-center gap-1 p-1 bg-white/95 backdrop-blur-md border border-indigo-200/80 rounded-2xl shadow-xl shadow-indigo-500/10 text-xs font-medium text-gray-700 animate-slide-up select-none"
    >
      {/* Primary Action: Spiega */}
      <button
        onClick={() => handleAction('Spiegami cosa significa e cosa spiega questo passaggio nel contesto del documento.')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer font-semibold"
        title="Spiega questo passaggio con l'assistente IA"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Spiega</span>
      </button>

      {/* Semplifica */}
      <button
        onClick={() => handleAction('Spiega questo passaggio in parole molto semplici e comprensibili, come se fossi uno studente al primo anno.')}
        className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 rounded-xl transition-colors cursor-pointer"
        title="Semplifica il concetto"
      >
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <span className="hidden sm:inline">Semplifica</span>
      </button>

      {/* Esempio */}
      <button
        onClick={() => handleAction('Fai uno o piu esempi pratici per chiarire il significato e l\'applicazione di questo passaggio.')}
        className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 rounded-xl transition-colors cursor-pointer"
        title="Richiedi un esempio concreto"
      >
        <Compass className="w-3.5 h-3.5 text-blue-500" />
        <span className="hidden sm:inline">Esempio</span>
      </button>

      {/* Chiedi liberamente */}
      <button
        onClick={() => handleAction('')}
        className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 rounded-xl transition-colors cursor-pointer"
        title="Apri la chat con questo passaggio selezionato per fare una domanda specifica"
      >
        <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-600" />
        <span>Chiedi</span>
      </button>

      {/* Chiudi */}
      <button
        onClick={onClose}
        className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer ml-0.5"
        title="Chiudi popup"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
