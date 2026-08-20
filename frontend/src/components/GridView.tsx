import React from 'react';
import { DriveItem } from '../types';
import { formatBytes, formatDate, getFileTypeInfo } from '../utils/formatters';
import { Folder, MoreVertical, UploadCloud, FolderPlus, FileQuestion } from 'lucide-react';

interface GridViewProps {
  items: DriveItem[];
  selectedId: string | null;
  onSelect: (item: DriveItem) => void;
  onOpen: (item: DriveItem) => void;
  onContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
  onUpload: () => void;
  onCreateFolder: () => void;
}

export const GridView: React.FC<GridViewProps> = ({
  items,
  selectedId,
  onSelect,
  onOpen,
  onContextMenu,
  onUpload,
  onCreateFolder,
}) => {
  const folders = items.filter((item) => item.isFolder);
  const files = items.filter((item) => !item.isFolder);

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
          <UploadCloud className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Questa cartella è vuota</h3>
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          Trascina qui i tuoi file da Windows oppure usa i pulsanti in basso per iniziare ad organizzare i tuoi documenti.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onUpload}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-xs transition-colors flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Carica file</span>
          </button>
          <button
            onClick={onCreateFolder}
            className="px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Nuova cartella</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Folders Section */}
      {folders.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">
            Cartelle ({folders.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {folders.map((folder) => {
              const isSelected = selectedId === folder.id;
              return (
                <div
                  key={folder.id}
                  onClick={() => onSelect(folder)}
                  onDoubleClick={() => onOpen(folder)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSelect(folder);
                    onContextMenu(e, folder);
                  }}
                  className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-100 shadow-xs'
                      : 'bg-white hover:bg-gray-50/80 border-gray-200 hover:border-gray-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Folder className="w-4 h-4 fill-amber-400 text-amber-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 truncate" title={folder.name}>
                      {folder.name}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(folder);
                      onContextMenu(e, folder);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Altre opzioni"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">
            File ({files.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {files.map((file) => {
              const isSelected = selectedId === file.id;
              const typeInfo = getFileTypeInfo(file.name, file.isFolder, file.mimeType);

              return (
                <div
                  key={file.id}
                  onClick={() => onSelect(file)}
                  onDoubleClick={() => onOpen(file)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSelect(file);
                    onContextMenu(e, file);
                  }}
                  className={`group relative flex flex-col p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-100 shadow-sm'
                      : 'bg-white hover:bg-gray-50/80 border-gray-200 hover:border-gray-300 hover:shadow-xs'
                  }`}
                >
                  {/* Top Bar with Icon and Action button */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-gray-50 border border-gray-100">
                      {typeInfo.icon}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(file);
                        onContextMenu(e, file);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Altre opzioni"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* File Name */}
                  <p
                    className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2 min-h-[2.5rem] break-words"
                    title={file.name}
                  >
                    {file.name}
                  </p>

                  {/* Footer with size and date */}
                  <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>{formatBytes(file.sizeBytes)}</span>
                    <span>{formatDate(file.updatedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
