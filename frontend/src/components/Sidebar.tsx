import React, { useState, useRef, useEffect } from 'react';
import { ViewMode, StorageStats } from '../types';
import { formatBytes } from '../utils/formatters';
import {
  Plus,
  FolderPlus,
  Upload,
  HardDrive,
  Clock,
  Trash2,
  PieChart,
  Trash,
  Globe,
} from 'lucide-react';

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewFolder: () => void;
  onUploadFiles: () => void;
  onNewLink: () => void;
  onEmptyTrash: () => void;
  onOpenStorageModal: () => void;
  stats: StorageStats | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  onViewModeChange,
  onNewFolder,
  onUploadFiles,
  onNewLink,
  onEmptyTrash,
  onOpenStorageModal,
  stats,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalBytes = stats?.totalSizeBytes || 0;
  // Visual limit gauge (e.g. 50GB virtual scale for visual progress)
  const virtualMax = 50 * 1024 * 1024 * 1024;
  const percentage = Math.min(Math.round((totalBytes / virtualMax) * 100), 100);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 shrink-0 select-none z-20">
      {/* "+ Nuovo" Primary Button with Dropdown */}
      <div className="relative mb-6" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-2xl shadow-drive hover:shadow-drive-lg transition-all text-sm font-semibold text-gray-800"
        >
          <div className="w-6 h-6 rounded-full bg-linear-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
            <Plus className="w-4 h-4" />
          </div>
          <span>Nuovo</span>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-modal border border-gray-200 py-2 z-50 animate-fade-in divide-y divide-gray-100">
            <div className="py-1">
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onNewFolder();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left text-sm text-gray-700 transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>Nuova cartella</span>
              </button>
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onUploadFiles();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left text-sm text-gray-700 transition-colors font-medium text-blue-600"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Carica file...</span>
              </button>
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onNewLink();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left text-sm text-gray-700 transition-colors font-medium text-cyan-600"
              >
                <Globe className="w-4 h-4 text-cyan-600" />
                <span>Nuovo link web</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-1">
        <button
          onClick={() => onViewModeChange('drive')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'drive'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-100/80'
          }`}
        >
          <HardDrive className={`w-4 h-4 ${viewMode === 'drive' ? 'text-blue-600' : 'text-gray-500'}`} />
          <span>Il mio Drive</span>
        </button>

        <button
          onClick={() => onViewModeChange('recent')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'recent'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-100/80'
          }`}
        >
          <Clock className={`w-4 h-4 ${viewMode === 'recent' ? 'text-blue-600' : 'text-gray-500'}`} />
          <span>Recenti</span>
        </button>

        <button
          onClick={() => onViewModeChange('trash')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            viewMode === 'trash'
              ? 'bg-rose-50 text-rose-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-100/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <Trash2 className={`w-4 h-4 ${viewMode === 'trash' ? 'text-rose-600' : 'text-gray-500'}`} />
            <span>Cestino</span>
          </div>
          {stats && stats.trashItems > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
              {stats.trashItems}
            </span>
          )}
        </button>

        {viewMode === 'trash' && stats && stats.trashItems > 0 && (
          <div className="pt-2 px-2">
            <button
              onClick={onEmptyTrash}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors"
            >
              <Trash className="w-3.5 h-3.5 text-rose-600" />
              <span>Svuota cestino</span>
            </button>
          </div>
        )}
      </nav>

      {/* Storage Gauge Card */}
      <div className="mt-auto pt-4 border-t border-gray-100">
        <div
          onClick={onOpenStorageModal}
          className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200/60 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1.5 font-semibold text-gray-700">
              <PieChart className="w-3.5 h-3.5 text-blue-600" />
              <span>Spazio usato</span>
            </div>
            <span className="text-gray-500 font-mono">{formatBytes(totalBytes)}</span>
          </div>

          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-linear-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          </div>

          <p className="text-[11px] text-gray-500 text-center">
            {stats?.totalFiles || 0} file salvati in locale
          </p>
        </div>
      </div>
    </aside>
  );
};
