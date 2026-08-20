import React from 'react';
import { DriveItem } from '../types';
import { formatBytes, formatDate, getFileTypeInfo } from '../utils/formatters';
import { MoreVertical, UploadCloud, FolderPlus } from 'lucide-react';

interface ListViewProps {
  items: DriveItem[];
  selectedId: string | null;
  onSelect: (item: DriveItem) => void;
  onOpen: (item: DriveItem) => void;
  onContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
  onUpload: () => void;
  onCreateFolder: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  items,
  selectedId,
  onSelect,
  onOpen,
  onContextMenu,
  onUpload,
  onCreateFolder,
}) => {
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
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 text-xs font-semibold uppercase text-gray-500 tracking-wider border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 min-w-[280px]">Nome</th>
              <th className="px-4 py-3 min-w-[120px]">Tipo</th>
              <th className="px-4 py-3 min-w-[120px]">Dimensione</th>
              <th className="px-4 py-3 min-w-[150px]">Ultima modifica</th>
              <th className="px-4 py-3 w-12 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              const typeInfo = getFileTypeInfo(item.name, item.isFolder, item.mimeType);

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  onDoubleClick={() => onOpen(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSelect(item);
                    onContextMenu(e, item);
                  }}
                  className={`group cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-950 font-medium'
                      : 'hover:bg-gray-50/80 text-gray-800'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        {typeInfo.icon}
                      </div>
                      <span className="truncate max-w-md font-medium text-gray-900" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${typeInfo.badgeBg}`}>
                      {typeInfo.label}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {item.isFolder || item.mimeType === 'url' ? '-' : formatBytes(item.sizeBytes)}
                  </td>

                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(item.updatedAt)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(item);
                        onContextMenu(e, item);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Altre opzioni"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
