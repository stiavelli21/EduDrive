import React from 'react';
import { StorageStats } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { HardDrive, Folder, File, Trash2, X, Database, CheckCircle2 } from 'lucide-react';

interface StorageModalProps {
  isOpen: boolean;
  stats: StorageStats | null;
  storagePath: string;
  onClose: () => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({
  isOpen,
  stats,
  storagePath,
  onClose,
}) => {
  if (!isOpen) return null;

  const totalBytes = stats?.totalSizeBytes || 0;
  const trashBytes = stats?.trashSizeBytes || 0;
  const totalFiles = stats?.totalFiles || 0;
  const totalFolders = stats?.totalFolders || 0;
  const trashItems = stats?.trashItems || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <HardDrive className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Spazio di archiviazione</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Main Space Usage Card */}
          <div className="p-4 rounded-xl bg-linear-to-br from-blue-50/70 to-indigo-50/40 border border-blue-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Spazio totale occupato</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{formatBytes(totalBytes)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Memoria fisica locale gestita da EduDrive</p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="w-7 h-7 mx-auto rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-1.5">
                <File className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-gray-900">{totalFiles}</p>
              <p className="text-xs text-gray-500">File attivi</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="w-7 h-7 mx-auto rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-1.5">
                <Folder className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-gray-900">{totalFolders}</p>
              <p className="text-xs text-gray-500">Cartelle</p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
              <div className="w-7 h-7 mx-auto rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center mb-1.5">
                <Trash2 className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-gray-900">{trashItems}</p>
              <p className="text-xs text-gray-500">Nel cestino ({formatBytes(trashBytes)})</p>
            </div>
          </div>

          {/* Physical Storage Location */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-gray-700 mb-1">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Percorso archivio su disco:</span>
            </div>
            <p className="font-mono text-gray-600 break-all bg-white p-2 rounded-lg border border-gray-200">
              {storagePath || 'Caricamento...'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>I tuoi file sono conservati localmente in modo sicuro e privato sul tuo computer.</span>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
};
