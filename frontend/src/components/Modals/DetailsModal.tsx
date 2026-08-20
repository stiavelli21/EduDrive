import React from 'react';
import { DriveItem } from '../../types';
import { formatBytes, formatDate, getFileTypeInfo } from '../../utils/formatters';
import { Info, X, HardDrive, Calendar, Clock, Tag } from 'lucide-react';

interface DetailsModalProps {
  isOpen: boolean;
  item: DriveItem | null;
  onClose: () => void;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({
  isOpen,
  item,
  onClose,
}) => {
  if (!isOpen || !item) return null;

  const typeInfo = getFileTypeInfo(item.name, item.isFolder, item.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Info className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Dettagli elemento</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="p-2.5 rounded-lg bg-white shadow-xs">
              {typeInfo.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate" title={item.name}>
                {item.name}
              </p>
              <span className={`inline-block px-2 py-0.5 mt-1 text-xs font-medium rounded-full border ${typeInfo.badgeBg}`}>
                {typeInfo.label}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-sm">
            {!item.isFolder && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" /> Dimensione
                </span>
                <span className="font-medium text-gray-800">{formatBytes(item.sizeBytes)}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Tipo MIME
              </span>
              <span className="font-mono text-xs text-gray-700 max-w-[200px] truncate" title={item.mimeType || '-'}>
                {item.mimeType || (item.isFolder ? 'Cartella' : 'Generico')}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Ultima modifica
              </span>
              <span className="font-medium text-gray-800">{formatDate(item.updatedAt)}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Creato il
              </span>
              <span className="font-medium text-gray-800">{formatDate(item.createdAt)}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500">Stato</span>
              <span className={`font-medium ${item.isTrash ? 'text-rose-600' : 'text-emerald-600'}`}>
                {item.isTrash ? 'Nel Cestino' : 'Attivo'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
