import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DriveItem,
  BreadcrumbItem,
  StorageStats,
  ViewMode,
  LayoutMode,
  ToastMessage,
  ContextMenuState,
} from './types';
import {
  ListItems,
  GetBreadcrumbs,
  CreateFolder,
  CreateWebLink,
  ImportFiles,
  ImportFileByPath,
  SaveFileFromBase64,
  ExportFile,
  OpenFileLocally,
  RenameItem,
  DeleteItem,
  RestoreItem,
  EmptyTrash,
  SearchItems,
  GetStorageStats,
  GetAppStoragePath,
} from '../wailsjs/go/main/App';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { GridView } from './components/GridView';
import { ListView } from './components/ListView';
import { ContextMenu } from './components/ContextMenu';
import { ToastContainer } from './components/ToastContainer';
import { DropOverlay } from './components/DropOverlay';

import { NewFolderModal } from './components/Modals/NewFolderModal';
import { NewLinkModal } from './components/Modals/NewLinkModal';
import { RenameModal } from './components/Modals/RenameModal';
import { ConfirmModal } from './components/Modals/ConfirmModal';
import { DetailsModal } from './components/Modals/DetailsModal';
import { StorageModal } from './components/Modals/StorageModal';

export const App: React.FC = () => {
  // Navigation & View State
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('drive');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [items, setItems] = useState<DriveItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Storage Stats & Data Path
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [appStoragePath, setAppStoragePath] = useState<string>('');

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragCounter = useRef<number>(0);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => {
      const id = Date.now().toString() + Math.random().toString();
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  // Modal States
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false);
  const [renameModalItem, setRenameModalItem] = useState<DriveItem | null>(null);
  const [detailsModalItem, setDetailsModalItem] = useState<DriveItem | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDangerous: boolean;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDangerous: false,
    onConfirm: () => {},
  });

  // Fetch Storage Stats
  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await GetStorageStats();
      setStorageStats(stats);
      const path = await GetAppStoragePath();
      setAppStoragePath(path);
    } catch (err: any) {
      console.error('Failed to get storage stats:', err);
    }
  }, []);

  // Fetch items & breadcrumbs
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await SearchItems(searchQuery.trim());
        setItems(results || []);
      } else {
        const [fetchedItems, fetchedCrumbs] = await Promise.all([
          ListItems(currentFolderId, viewMode),
          viewMode === 'drive' ? GetBreadcrumbs(currentFolderId) : Promise.resolve([]),
        ]);
        setItems(fetchedItems || []);
        if (viewMode === 'drive') {
          setBreadcrumbs(fetchedCrumbs || []);
        }
      }
      await refreshStorageStats();
    } catch (err: any) {
      console.error('Error loading data:', err);
      addToast('error', 'Errore nel caricamento', err?.toString() || 'Impossibile caricare i file');
    } finally {
      setIsLoading(false);
    }
  }, [currentFolderId, viewMode, searchQuery, refreshStorageStats, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Search Input Change with Debounce
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSelectedItem(null);
  };

  // Navigate into Folder or Open File / Link
  const handleOpenItem = async (item: DriveItem) => {
    if (item.isFolder) {
      setSearchQuery('');
      setCurrentFolderId(item.id);
      setViewMode('drive');
      setSelectedItem(null);
    } else {
      try {
        await OpenFileLocally(item.id);
        if (item.mimeType === 'url') {
          addToast('info', 'Apertura link...', `Apertura di "${item.name}" nel browser predefinito.`);
        } else {
          addToast('info', 'Apertura in corso...', `Apertura di "${item.name}" con l'applicazione di sistema.`);
        }
      } catch (err: any) {
        addToast('error', "Errore nell'apertura", err?.toString() || 'Impossibile aprire il file.');
      }
    }
  };

  // Navigate via Breadcrumb
  const handleNavigateBreadcrumb = (folderId: string) => {
    setSearchQuery('');
    setCurrentFolderId(folderId);
    setSelectedItem(null);
  };

  // Change Sidebar View Mode
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchQuery('');
    setSelectedItem(null);
    if (mode !== 'drive') {
      setCurrentFolderId('');
    }
  };

  // Create Folder
  const handleCreateFolder = async (name: string) => {
    try {
      await CreateFolder(name, currentFolderId);
      addToast('success', 'Cartella creata', `La cartella "${name}" è stata creata con successo.`);
      loadData();
    } catch (err: any) {
      addToast('error', 'Errore nella creazione', err?.toString() || 'Impossibile creare la cartella.');
    }
  };

  // Create Web Link
  const handleCreateWebLink = async (name: string, url: string) => {
    try {
      await CreateWebLink(name, url, currentFolderId);
      addToast('success', 'Collegamento creato', `Il collegamento "${name}" è stato aggiunto con successo.`);
      loadData();
    } catch (err: any) {
      addToast('error', 'Errore nella creazione', err?.toString() || 'Impossibile creare il collegamento web.');
    }
  };

  // Upload Files via Native Dialog
  const handleUploadFiles = async () => {
    try {
      const imported = await ImportFiles(currentFolderId);
      if (imported && imported.length > 0) {
        addToast(
          'success',
          'File caricati',
          `${imported.length} file ${imported.length === 1 ? 'importato' : 'importati'} con successo.`
        );
        loadData();
      }
    } catch (err: any) {
      addToast('error', "Errore nell'importazione", err?.toString() || 'Impossibile importare i file.');
    }
  };

  // Export / Download File
  const handleExportFile = async (item: DriveItem) => {
    try {
      await ExportFile(item.id);
      addToast('success', 'File esportato', `Copia di "${item.name}" salvata con successo.`);
    } catch (err: any) {
      if (err) {
        addToast('error', "Errore nell'esportazione", err?.toString() || 'Impossibile esportare il file.');
      }
    }
  };

  // Rename File / Folder
  const handleRename = async (id: string, newName: string) => {
    try {
      await RenameItem(id, newName);
      addToast('success', 'Elemento rinominato', `Rinominato in "${newName}".`);
      loadData();
    } catch (err: any) {
      addToast('error', 'Errore nella rinomina', err?.toString() || 'Impossibile rinominare.');
    }
  };

  // Move to Trash or Permanent Delete
  const handleDelete = (item: DriveItem, permanent: boolean) => {
    if (permanent) {
      setConfirmModal({
        isOpen: true,
        title: 'Eliminazione definitiva',
        message: `Sei sicuro di voler eliminare definitivamente "${item.name}"? L'operazione rimuoverà fisicamente il file dal disco e non potrà essere annullata.`,
        isDangerous: true,
        confirmText: 'Elimina per sempre',
        onConfirm: async () => {
          try {
            await DeleteItem(item.id, true);
            addToast('success', 'Elemento eliminato', `"${item.name}" eliminato definitivamente.`);
            setSelectedItem(null);
            loadData();
          } catch (err: any) {
            addToast('error', "Errore nell'eliminazione", err?.toString());
          }
        },
      });
    } else {
      // Soft delete to trash
      (async () => {
        try {
          await DeleteItem(item.id, false);
          addToast('success', 'Spostato nel Cestino', `"${item.name}" è stato spostato nel cestino.`);
          setSelectedItem(null);
          loadData();
        } catch (err: any) {
          addToast('error', 'Errore', err?.toString());
        }
      })();
    }
  };

  // Restore from Trash
  const handleRestore = async (item: DriveItem) => {
    try {
      await RestoreItem(item.id);
      addToast('success', 'Elemento ripristinato', `"${item.name}" è stato ripristinato nel tuo Drive.`);
      setSelectedItem(null);
      loadData();
    } catch (err: any) {
      addToast('error', 'Errore nel ripristino', err?.toString());
    }
  };

  // Empty Trash completely
  const handleEmptyTrash = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Svuota Cestino',
      message:
        'Tutti gli elementi presenti nel cestino verranno eliminati permanentemente dal computer. Questa operazione non può essere annullata.',
      isDangerous: true,
      confirmText: 'Svuota tutto',
      onConfirm: async () => {
        try {
          await EmptyTrash();
          addToast('success', 'Cestino svuotato', 'Tutti i file sono stati rimossi definitivamente.');
          loadData();
        } catch (err: any) {
          addToast('error', 'Errore nello svuotamento', err?.toString());
        }
      },
    });
  };

  // Right Click Context Menu Handler
  const handleContextMenu = (e: React.MouseEvent, item: DriveItem) => {
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  // Drag and Drop Event Listeners
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let importedCount = 0;

    for (const file of files) {
      try {
        // Try direct file path if available in Webview
        const filePath = (file as any).path;
        if (filePath) {
          await ImportFileByPath(filePath, currentFolderId);
          importedCount++;
        } else {
          // Fallback: Read as base64 and send to Go backend
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const res = reader.result as string;
              const base64 = res.split(',')[1];
              resolve(base64);
            };
            reader.onerror = (err) => reject(err);
          });
          reader.readAsDataURL(file);
          const base64Data = await base64Promise;
          await SaveFileFromBase64(file.name, base64Data, currentFolderId);
          importedCount++;
        }
      } catch (err: any) {
        console.error('Error importing dropped file:', file.name, err);
        addToast('error', `Errore per ${file.name}`, err?.toString() || 'Impossibile importare il file.');
      }
    }

    if (importedCount > 0) {
      addToast(
        'success',
        'File importati con successo',
        `${importedCount} file ${importedCount === 1 ? 'salvato' : 'salvati'} in EduDrive.`
      );
      loadData();
    }
  };

  // Keyboard Shortcuts (Delete key, Esc key, Ctrl+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedItem && !contextMenu.visible) {
        handleDelete(selectedItem, viewMode === 'trash');
      }
      if (e.key === 'Escape') {
        setSelectedItem(null);
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, viewMode, contextMenu.visible]);

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#f8fafd] overflow-hidden text-gray-900 select-none"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        onRefresh={loadData}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        isLoading={isLoading}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onNewFolder={() => setIsNewFolderModalOpen(true)}
          onUploadFiles={handleUploadFiles}
          onNewLink={() => setIsNewLinkModalOpen(true)}
          onEmptyTrash={handleEmptyTrash}
          onOpenStorageModal={() => setIsStorageModalOpen(true)}
          stats={storageStats}
        />

        {/* Center Content Workspace */}
        <main
          className="flex-1 flex flex-col bg-white rounded-tl-3xl border-t border-l border-gray-200 overflow-hidden shadow-xs"
          onClick={() => setSelectedItem(null)}
        >
          {/* Breadcrumb & Sub-header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-xs">
            <Breadcrumbs
              breadcrumbs={breadcrumbs}
              viewMode={viewMode}
              searchQuery={searchQuery}
              onNavigateFolder={handleNavigateBreadcrumb}
            />

            <div className="text-xs text-gray-400 font-medium">
              {items.length} {items.length === 1 ? 'elemento' : 'elementi'}
            </div>
          </div>

          {/* Files / Folders List / Grid Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {layoutMode === 'grid' ? (
              <GridView
                items={items}
                selectedId={selectedItem?.id || null}
                onSelect={(item) => setSelectedItem(item)}
                onOpen={handleOpenItem}
                onContextMenu={handleContextMenu}
                onUpload={handleUploadFiles}
                onCreateFolder={() => setIsNewFolderModalOpen(true)}
              />
            ) : (
              <ListView
                items={items}
                selectedId={selectedItem?.id || null}
                onSelect={(item) => setSelectedItem(item)}
                onOpen={handleOpenItem}
                onContextMenu={handleContextMenu}
                onUpload={handleUploadFiles}
                onCreateFolder={() => setIsNewFolderModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Drag & Drop Visual Overlay */}
      <DropOverlay isDragging={isDragging} />

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.item && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          viewMode={viewMode}
          onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
          onOpen={handleOpenItem}
          onExport={handleExportFile}
          onRename={(item) => setRenameModalItem(item)}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onDetails={(item) => setDetailsModalItem(item)}
        />
      )}

      {/* Modals */}
      <NewFolderModal
        isOpen={isNewFolderModalOpen}
        onClose={() => setIsNewFolderModalOpen(false)}
        onCreate={handleCreateFolder}
      />

      <NewLinkModal
        isOpen={isNewLinkModalOpen}
        onClose={() => setIsNewLinkModalOpen(false)}
        onCreate={handleCreateWebLink}
      />

      <RenameModal
        isOpen={!!renameModalItem}
        item={renameModalItem}
        onClose={() => setRenameModalItem(null)}
        onRename={handleRename}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDangerous={confirmModal.isDangerous}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      <DetailsModal
        isOpen={!!detailsModalItem}
        item={detailsModalItem}
        onClose={() => setDetailsModalItem(null)}
      />

      <StorageModal
        isOpen={isStorageModalOpen}
        stats={storageStats}
        storagePath={appStoragePath}
        onClose={() => setIsStorageModalOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
