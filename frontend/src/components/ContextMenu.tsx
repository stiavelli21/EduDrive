import React, { useEffect, useRef } from 'react';
import { DriveItem, ViewMode } from '../types';
import {
  ExternalLink,
  Download,
  Edit2,
  Trash2,
  RotateCcw,
  Info,
  FolderOpen,
  Eye,
  FileCode,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  item: DriveItem;
  viewMode: ViewMode;
  onClose: () => void;
  onOpen: (item: DriveItem) => void;
  onOpenWithSystemApp: (item: DriveItem) => void;
  onConvertToMarkdown: (item: DriveItem) => void;
  onOpenAsMarkdown: (item: DriveItem) => void;
  onExport: (item: DriveItem) => void;
  onRename: (item: DriveItem) => void;
  onDelete: (item: DriveItem, permanent: boolean) => void;
  onRestore: (item: DriveItem) => void;
  onDetails: (item: DriveItem) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  item,
  viewMode,
  onClose,
  onOpen,
  onOpenWithSystemApp,
  onConvertToMarkdown,
  onOpenAsMarkdown,
  onExport,
  onRename,
  onDelete,
  onRestore,
  onDetails,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust menu position if overflowing viewport
  const style: React.CSSProperties = {
    top: `${Math.min(y, window.innerHeight - 280)}px`,
    left: `${Math.min(x, window.innerWidth - 220)}px`,
  };

  const isConvertible =
    !item.isFolder &&
    item.mimeType !== 'url' &&
    (item.name.toLowerCase().endsWith('.pdf') ||
      item.mimeType === 'application/pdf' ||
      item.name.toLowerCase().endsWith('.docx') ||
      item.name.toLowerCase().endsWith('.doc') ||
      item.mimeType?.includes('word') ||
      item.mimeType?.includes('text'));

  if (viewMode === 'trash') {
    return (
      <div
        ref={menuRef}
        style={style}
        className="fixed z-50 w-52 bg-white rounded-2xl shadow-modal border border-gray-200 py-1.5 animate-fade-in text-sm"
      >
        <button
          onClick={() => {
            onClose();
            onRestore(item);
          }}
          className="w-full px-4 py-2 flex items-center gap-2.5 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-left"
        >
          <RotateCcw className="w-4 h-4 text-emerald-600" />
          <span>Ripristina</span>
        </button>

        <div className="my-1 border-t border-gray-100" />

        <button
          onClick={() => {
            onClose();
            onDelete(item, true);
          }}
          className="w-full px-4 py-2 flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left font-medium"
        >
          <Trash2 className="w-4 h-4" />
          <span>Elimina definitivamente</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed z-50 w-56 bg-white rounded-2xl shadow-modal border border-gray-200 py-1.5 animate-fade-in text-sm select-none"
    >
      {/* Open Primary (In-App Reader for PDF/DOCX/MD, Explorer for folder, Browser for link) */}
      <button
        onClick={() => {
          onClose();
          onOpen(item);
        }}
        className="w-full px-4 py-2 flex items-center gap-2.5 text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer text-left font-medium"
      >
        {item.isFolder ? (
          <FolderOpen className="w-4 h-4 text-amber-500" />
        ) : (
          <Eye className="w-4 h-4 text-blue-600" />
        )}
        <span>
          {item.isFolder
            ? 'Apri cartella'
            : item.mimeType === 'url'
            ? 'Apri link nel browser'
            : item.name.toLowerCase().endsWith('.md')
            ? 'Leggi / Modifica in .md'
            : 'Apri in EduDrive'}
        </span>
      </button>

      {/* Convert to Markdown and open in Editor */}
      {isConvertible && (
        <button
          onClick={() => {
            onClose();
            onConvertToMarkdown(item);
          }}
          className="w-full px-4 py-2 flex items-center gap-2.5 text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer text-left font-medium"
        >
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>Converti in Markdown</span>
        </button>
      )}

      {/* Open as Markdown (on the fly without creating a copy) */}
      {isConvertible && (
        <button
          onClick={() => {
            onClose();
            onOpenAsMarkdown(item);
          }}
          className="w-full px-4 py-2 flex items-center gap-2.5 text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer text-left"
        >
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span>Apri in Markdown</span>
        </button>
      )}

      {/* Open with default OS external app */}
      {!item.isFolder && item.mimeType !== 'url' && (
        <button
          onClick={() => {
            onClose();
            onOpenWithSystemApp(item);
          }}
          className="w-full px-4 py-2 flex items-center gap-2.5 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-left"
        >
          <ExternalLink className="w-4 h-4 text-gray-500" />
          <span>Apri con app di sistema</span>
        </button>
      )}

      {/* Export / Download */}
      {!item.isFolder && item.mimeType !== 'url' && (
        <button
          onClick={() => {
            onClose();
            onExport(item);
          }}
          className="w-full px-4 py-2 flex items-center gap-2.5 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-left"
        >
          <Download className="w-4 h-4 text-gray-500" />
          <span>Esporta copia...</span>
        </button>
      )}

      <div className="my-1 border-t border-gray-100" />

      {/* Rename */}
      <button
        onClick={() => {
          onClose();
          onRename(item);
        }}
        className="w-full px-4 py-2 flex items-center gap-2.5 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-left"
      >
        <Edit2 className="w-4 h-4 text-gray-500" />
        <span>Rinomina</span>
      </button>

      {/* Details */}
      <button
        onClick={() => {
          onClose();
          onDetails(item);
        }}
        className="w-full px-4 py-2 flex items-center gap-2.5 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-left"
      >
        <Info className="w-4 h-4 text-gray-500" />
        <span>Informazioni elemento</span>
      </button>

      <div className="my-1 border-t border-gray-100" />

      {/* Move to Trash */}
      <button
        onClick={() => {
          onClose();
          onDelete(item, false);
        }}
        className="w-full px-4 py-2 flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
      >
        <Trash2 className="w-4 h-4" />
        <span>Sposta nel Cestino</span>
      </button>
    </div>
  );
};
