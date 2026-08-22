import React from 'react';
import { BreadcrumbItem, ViewMode } from '../types';
import { ChevronRight, HardDrive, Clock, Trash2, Home, BookOpen } from 'lucide-react';

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  viewMode: ViewMode;
  searchQuery: string;
  onNavigateFolder: (folderId: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  breadcrumbs,
  viewMode,
  searchQuery,
  onNavigateFolder,
}) => {
  if (searchQuery.trim()) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-1">
        <span className="font-semibold text-gray-900">Risultati di ricerca:</span>
        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
          "{searchQuery}"
        </span>
      </div>
    );
  }

  if (viewMode === 'recent') {
    return (
      <div className="flex items-center gap-2 text-base font-semibold text-gray-800 py-1">
        <Clock className="w-5 h-5 text-blue-600" />
        <span>File Recenti</span>
      </div>
    );
  }

  if (viewMode === 'trash') {
    return (
      <div className="flex items-center gap-2 text-base font-semibold text-gray-800 py-1">
        <Trash2 className="w-5 h-5 text-rose-600" />
        <span>Cestino</span>
      </div>
    );
  }

  if (viewMode === 'career') {
    return (
      <div className="flex items-center gap-2 text-base font-semibold text-gray-800 py-1">
        <BookOpen className="w-5 h-5 text-emerald-600" />
        <span>Libretto</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isRoot = index === 0;

        return (
          <React.Fragment key={crumb.id || 'root'}>
            {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
            <button
              onClick={() => onNavigateFolder(crumb.id)}
              disabled={isLast}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                isLast
                  ? 'font-semibold text-gray-900 bg-gray-100/60 cursor-default'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100 cursor-pointer'
              }`}
            >
              {isRoot && <Home className="w-3.5 h-3.5" />}
              <span className="truncate max-w-[160px]">{crumb.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
