import React from 'react';
import { LayoutMode } from '../types';
import {
  Search,
  X,
  LayoutGrid,
  List,
  RotateCw,
  HardDrive,
  FolderSync,
} from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onRefresh: () => void;
  onOpenStorageModal: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  layoutMode,
  onLayoutChange,
  onRefresh,
  onOpenStorageModal,
  isLoading,
}) => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between gap-4 shrink-0 z-30">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3 w-56 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-lg">
          <FolderSync className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg text-gray-900 tracking-tight">EduDrive</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
              Locale
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-medium -mt-0.5">Desktop Storage</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-2xl">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca file o cartelle in EduDrive..."
            className="w-full pl-10 pr-10 py-2.5 rounded-full bg-gray-100/90 focus:bg-white border border-transparent focus:border-blue-400 focus:ring-3 focus:ring-blue-100 outline-hidden text-sm text-gray-800 transition-all placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Actions & Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className={`p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors ${
            isLoading ? 'animate-spin text-blue-600' : ''
          }`}
          title="Aggiorna contenuti"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Storage Quick Info */}
        <button
          onClick={onOpenStorageModal}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          title="Visualizza statistiche memoria"
        >
          <HardDrive className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        {/* View Mode Toggles */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => onLayoutChange('grid')}
            className={`p-1.5 rounded-lg transition-all ${
              layoutMode === 'grid'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Vista a griglia"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onLayoutChange('list')}
            className={`p-1.5 rounded-lg transition-all ${
              layoutMode === 'list'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
            title="Vista ad elenco"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
