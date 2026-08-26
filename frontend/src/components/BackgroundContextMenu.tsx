import React, { useEffect, useRef } from 'react';
import { FolderPlus, Upload, FileCode, Globe, FileUp } from 'lucide-react';

interface BackgroundContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onNewFolder: () => void;
  onUploadFiles: () => void;
  onImportAndConvertToMarkdown?: () => void;
  onNewMarkdown: () => void;
  onNewLink: () => void;
}

export const BackgroundContextMenu: React.FC<BackgroundContextMenuProps> = ({
  x,
  y,
  onClose,
  onNewFolder,
  onUploadFiles,
  onImportAndConvertToMarkdown,
  onNewMarkdown,
  onNewLink,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or Escape key press
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates if menu would overflow window edges
  const menuWidth = 210;
  const menuHeight = 180;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 12);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 12);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-52 bg-white rounded-2xl shadow-modal border border-gray-200 py-1.5 text-sm text-gray-700 animate-fade-in divide-y divide-gray-100 select-none"
    >
      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            onNewFolder();
          }}
          className="w-full px-3.5 py-2 flex items-center gap-3 hover:bg-gray-100 text-left transition-colors text-gray-700 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-medium">Nuova cartella</span>
        </button>
      </div>

      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            onUploadFiles();
          }}
          className="w-full px-3.5 py-2 flex items-center gap-3 hover:bg-gray-100 text-left transition-colors text-gray-700 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Carica file...</span>
        </button>
        {onImportAndConvertToMarkdown && (
          <button
            onClick={() => {
              onClose();
              onImportAndConvertToMarkdown();
            }}
            className="w-full px-3.5 py-2 flex items-center gap-3 hover:bg-gray-100 text-left transition-colors text-gray-700 cursor-pointer"
          >
            <FileUp className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Importa in .md</span>
          </button>
        )}
        <button
          onClick={() => {
            onClose();
            onNewMarkdown();
          }}
          className="w-full px-3.5 py-2 flex items-center gap-3 hover:bg-gray-100 text-left transition-colors text-gray-700 cursor-pointer"
        >
          <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Nuovo File .md</span>
        </button>
        <button
          onClick={() => {
            onClose();
            onNewLink();
          }}
          className="w-full px-3.5 py-2 flex items-center gap-3 hover:bg-gray-100 text-left transition-colors text-gray-700 cursor-pointer"
        >
          <Globe className="w-4 h-4 text-cyan-600 shrink-0" />
          <span>Nuovo link web</span>
        </button>
      </div>
    </div>
  );
};
