import React, { useState, useRef, useEffect } from 'react';
import { ViewMode, StorageStats, ExamDateItem } from '../types';
import { formatBytes, formatDate, getExamUrgencyInfo } from '../utils/formatters';
import {
  FolderPlus,
  Upload,
  HardDrive,
  Clock,
  Trash2,
  PieChart,
  Trash,
  Globe,
  GraduationCap,
  Plus,
  X,
} from 'lucide-react';

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewFolder: () => void;
  onUploadFiles: () => void;
  onNewLink: () => void;
  onNewExamDate: () => void;
  onDeleteExamDate: (id: string) => void;
  onEmptyTrash: () => void;
  onOpenStorageModal: () => void;
  stats: StorageStats | null;
  examDates: ExamDateItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  onViewModeChange,
  onNewFolder,
  onUploadFiles,
  onNewLink,
  onNewExamDate,
  onDeleteExamDate,
  onEmptyTrash,
  onOpenStorageModal,
  stats,
  examDates,
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4 shrink-0 select-none z-20 overflow-hidden">
      {/* "+ Nuovo" Primary Button with Dropdown */}
      <div className="relative mb-5" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-2xl shadow-drive hover:shadow-drive-lg transition-all cursor-pointer group"
        >
          <div className="w-7 h-7 flex items-center justify-center shrink-0 text-blue-600">
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-sm font-semibold text-gray-700">Nuovo</span>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-modal border border-gray-200 py-2 z-50 animate-fade-in divide-y divide-gray-100">
            <div className="py-1">
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onNewFolder();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left text-sm text-gray-700 transition-colors cursor-pointer"
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
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left text-sm text-gray-700 transition-colors font-medium text-blue-600 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Carica file...</span>
              </button>
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  onNewLink();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-100 text-left text-sm text-gray-700 transition-colors font-medium text-cyan-600 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-cyan-600" />
                <span>Nuovo link web</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="space-y-1 shrink-0">
        <button
          onClick={() => onViewModeChange('drive')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
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
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
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
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
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
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Trash className="w-3.5 h-3.5 text-rose-600" />
              <span>Svuota cestino</span>
            </button>
          </div>
        )}
      </nav>

      {/* Exam Deadlines Section */}
      <div className="my-4 pt-3 border-t border-gray-100 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-1 mb-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5 text-violet-600" />
            <span>Date Esami</span>
            {examDates.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                {examDates.length}
              </span>
            )}
          </div>
          <button
            onClick={onNewExamDate}
            title="Aggiungi data esame"
            className="p-1 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {examDates.length === 0 ? (
          <div
            onClick={onNewExamDate}
            className="p-3 rounded-xl border border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 text-center cursor-pointer transition-all group"
          >
            <p className="text-xs text-gray-400 group-hover:text-violet-600 font-medium">
              + Aggiungi data esame
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto space-y-2 pr-1 flex-1">
            {examDates.map((exam) => {
              const urgency = getExamUrgencyInfo(exam.examDate);
              return (
                <div
                  key={exam.id}
                  className="p-2.5 rounded-xl bg-gray-50/90 hover:bg-gray-100/90 border border-gray-200/70 transition-all group relative"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-xs font-semibold text-gray-800 truncate flex-1" title={exam.subject}>
                      {exam.subject}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteExamDate(exam.id);
                      }}
                      title="Elimina esame"
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-600 p-0.5 rounded transition-all cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                    <span>{formatDate(exam.examDate)}</span>
                    <span className={`font-medium ${urgency.textClass}`}>
                      {urgency.statusLabel}
                    </span>
                  </div>

                  {/* Urgency Colored Line */}
                  <div className="w-full h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${urgency.barColorClass} rounded-full transition-all duration-300`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Storage Gauge Card */}
      <div className="mt-auto pt-3 border-t border-gray-100 shrink-0">
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
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
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

