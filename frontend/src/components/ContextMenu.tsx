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
  Globe,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  item: DriveItem;
  viewMode: ViewMode;
  onClose: () => void;
  onOpen: (item: DriveItem) => void;
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
  onExport,
  onRename,
  onDelete,
  onRestore,
  onDetails,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
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

  // Adjust coordinates if menu overflows window
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 260);

  const isInTrash = item.isTrash || viewMode === 'trash';
  const isWebLink = item.mimeType === 'url';

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 text-sm text-gray-700 animate-fade-in divide-y divide-gray-100 select-none"
    >
      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            onOpen(item);
          }}
          className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-gray-100 text-left transition-colors font-medium text-gray-800"
        >
          {item.isFolder ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : isWebLink ? (
            <Globe className="w-4 h-4 text-cyan-600" />
          ) : (
            <ExternalLink className="w-4 h-4 text-blue-600" />
          )}
          <span>
            {item.isFolder
              ? 'Apri cartella'
              : isWebLink
              ? 'Apri nel browser'
              : 'Apri con app di sistema'}
          </span>
        </button>

        {!item.isFolder && !isInTrash && (
          <button
            onClick={() => {
              onClose();
              onExport(item);
            }}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-gray-100 text-left transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{isWebLink ? 'Esporta collegamento (.url)...' : 'Salva copia con nome...'}</span>
          </button>
        )}
      </div>

      {!isInTrash && (
        <div className="py-1">
          <button
            onClick={() => {
              onClose();
              onRename(item);
            }}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-gray-100 text-left transition-colors"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
            <span>Rinomina</span>
          </button>
        </div>
      )}

      <div className="py-1">
        {isInTrash ? (
          <>
            <button
              onClick={() => {
                onClose();
                onRestore(item);
              }}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-gray-100 text-left transition-colors text-emerald-700 font-medium"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Ripristina</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onDelete(item, true);
              }}
              className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-red-50 text-left transition-colors text-red-600 font-medium"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Elimina definitivamente</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              onClose();
              onDelete(item, false);
            }}
            className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-red-50 text-left transition-colors text-red-600"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Sposta nel Cestino</span>
          </button>
        )}
      </div>

      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            onDetails(item);
          }}
          className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-gray-100 text-left transition-colors text-gray-600"
        >
          <Info className="w-4 h-4 text-gray-400" />
          <span>Informazioni & Dettagli</span>
        </button>
      </div>
    </div>
  );
};
