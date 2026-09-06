import React, { useState, useEffect, useMemo } from 'react';
import { FolderSymlink, Folder, HardDrive, X, Check, Loader2 } from 'lucide-react';
import { DriveItem } from '../../types';

interface MoveItemModalProps {
  isOpen: boolean;
  item: DriveItem | null;
  folders: DriveItem[];
  onClose: () => void;
  onMove: (itemId: string, targetFolderId: string) => Promise<void>;
}

interface FolderNode {
  item: DriveItem;
  level: number;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  item,
  folders,
  onClose,
  onMove,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // When modal opens, default selected folder to item's parent or root
  useEffect(() => {
    if (isOpen && item) {
      setSelectedFolderId(item.parentId || '');
      setIsSubmitting(false);
    }
  }, [isOpen, item]);

  // If the moved item is a folder, find all its descendant IDs to disable them (prevent cycles)
  const disabledFolderIds = useMemo(() => {
    if (!item || !item.isFolder) return new Set<string>();

    const disabled = new Set<string>([item.id]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parentId && disabled.has(f.parentId) && !disabled.has(f.id)) {
          disabled.add(f.id);
          added = true;
        }
      }
    }
    return disabled;
  }, [item, folders]);

  // Build hierarchical folder list for intuitive indented tree view
  const hierarchicalFolders = useMemo(() => {
    const result: FolderNode[] = [];
    const childrenMap = new Map<string, DriveItem[]>();
    const visited = new Set<string>();

    folders.forEach((f) => {
      const p = f.parentId || '';
      if (!childrenMap.has(p)) {
        childrenMap.set(p, []);
      }
      childrenMap.get(p)!.push(f);
    });

    const traverse = (parentId: string, level: number) => {
      const list = childrenMap.get(parentId) || [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      for (const folder of list) {
        if (visited.has(folder.id)) continue;
        visited.add(folder.id);
        result.push({ item: folder, level });
        traverse(folder.id, level + 1);
      }
    };

    traverse('', 0);

    // Safeguard: Append any orphaned folders that could not be reached from root
    for (const f of folders) {
      if (!visited.has(f.id)) {
        visited.add(f.id);
        result.push({ item: f, level: 0 });
        traverse(f.id, 1);
      }
    }

    return result;
  }, [folders]);

  if (!isOpen || !item) return null;

  const currentParentId = item.parentId || '';
  const isTargetSameAsCurrent = selectedFolderId === currentParentId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTargetSameAsCurrent || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onMove(item.id, selectedFolderId);
      onClose();
    } catch (err) {
      console.error('Failed to move item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <FolderSymlink className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Sposta elemento</h3>
              <p className="text-xs text-gray-500 truncate max-w-xs" title={item.name}>
                {item.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Folder Tree */}
        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
            Seleziona la cartella di destinazione
          </label>

          <div className="space-y-1">
            {/* Root: Il mio Drive */}
            <div
              onClick={() => setSelectedFolderId('')}
              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                selectedFolderId === ''
                  ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                  : 'hover:bg-gray-50 text-gray-800 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <HardDrive className={`w-4 h-4 ${selectedFolderId === '' ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="text-sm truncate">Il mio Drive (Radice)</span>
                {currentParentId === '' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-normal">
                    Attuale
                  </span>
                )}
              </div>
              {selectedFolderId === '' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
            </div>

            {/* Folders List with Indentation */}
            {hierarchicalFolders.map(({ item: f, level }) => {
              const isDisabled = disabledFolderIds.has(f.id);
              const isSelected = selectedFolderId === f.id;
              const isCurrent = currentParentId === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => !isDisabled && setSelectedFolderId(f.id)}
                  style={{ paddingLeft: `${Math.max(level * 16 + 10, 10)}px` }}
                  className={`flex items-center justify-between py-2 pr-2.5 rounded-xl transition-colors ${
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed text-gray-400 bg-gray-50/50'
                      : isSelected
                      ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200 cursor-pointer'
                      : 'hover:bg-gray-50 text-gray-800 border border-transparent cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder
                      className={`w-4 h-4 shrink-0 ${
                        isDisabled
                          ? 'text-gray-400 fill-gray-300'
                          : isSelected
                          ? 'text-blue-600 fill-blue-200'
                          : 'text-amber-500 fill-amber-300'
                      }`}
                    />
                    <span className="text-sm truncate" title={f.name}>
                      {f.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-normal shrink-0">
                        Attuale
                      </span>
                    )}
                    {isDisabled && f.id === item.id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-normal shrink-0">
                        Questo elemento
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isTargetSameAsCurrent || isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Sposta qui</span>
          </button>
        </div>
      </div>
    </div>
  );
};
