import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DriveItem,
  BreadcrumbItem,
  StorageStats,
  ExamDateItem,
  PassedExamItem,
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
  CreateExamDate,
  ListExamDates,
  DeleteExamDate,
  ListPassedExams,
  CreatePassedExam,
  UpdatePassedExam,
  DeletePassedExam,
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
  CreateMarkdownFile,
  GetFileContent,
  SaveMarkdownFile,
} from '../wailsjs/go/main/App';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { GridView } from './components/GridView';
import { ListView } from './components/ListView';
import { CareerView } from './components/CareerView';
import { ContextMenu } from './components/ContextMenu';
import { ToastContainer } from './components/ToastContainer';
import { DropOverlay } from './components/DropOverlay';

import { NewFolderModal } from './components/Modals/NewFolderModal';
import { NewLinkModal } from './components/Modals/NewLinkModal';
import { NewExamModal } from './components/Modals/NewExamModal';
import { PassedExamModal } from './components/Modals/PassedExamModal';
import { RenameModal } from './components/Modals/RenameModal';
import { ConfirmModal } from './components/Modals/ConfirmModal';
import { DetailsModal } from './components/Modals/DetailsModal';
import { StorageModal } from './components/Modals/StorageModal';
import { MarkdownModal } from './components/Modals/MarkdownModal';
import { Trash2, Info } from 'lucide-react';



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

  // Exam Dates State
  const [examDates, setExamDates] = useState<ExamDateItem[]>([]);
  const [isNewExamModalOpen, setIsNewExamModalOpen] = useState(false);

  // Passed Exams (Career & Booklet) State
  const [passedExams, setPassedExams] = useState<PassedExamItem[]>([]);
  const [isPassedExamModalOpen, setIsPassedExamModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<PassedExamItem | null>(null);

  // Modal States
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false);
  const [renameModalItem, setRenameModalItem] = useState<DriveItem | null>(null);
  const [detailsModalItem, setDetailsModalItem] = useState<DriveItem | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isMarkdownModalOpen, setIsMarkdownModalOpen] = useState(false);
  const [markdownItem, setMarkdownItem] = useState<DriveItem | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
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

  // Fetch Exam Dates
  const loadExamDates = useCallback(async () => {
    try {
      const dates = await ListExamDates();
      setExamDates(dates || []);
    } catch (err: any) {
      console.error('Failed to load exam dates:', err);
    }
  }, []);

  // Fetch Passed Exams
  const loadPassedExams = useCallback(async () => {
    try {
      const exams = await ListPassedExams();
      setPassedExams(exams || []);
    } catch (err: any) {
      console.error('Failed to load passed exams:', err);
    }
  }, []);

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
      await Promise.all([
        refreshStorageStats(),
        loadExamDates(),
        loadPassedExams(),
      ]);
    } catch (err: any) {
      console.error('Error loading data:', err);
      addToast('error', 'Errore nel caricamento', err?.toString() || 'Impossibile caricare i file');
    } finally {
      setIsLoading(false);
    }
  }, [currentFolderId, viewMode, searchQuery, refreshStorageStats, loadExamDates, loadPassedExams, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Search Input Change with Debounce
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSelectedItem(null);
  };

  // Navigate into Folder or Open File / Link / Markdown Document
  const handleOpenItem = async (item: DriveItem) => {
    if (item.isFolder) {
      setSearchQuery('');
      setCurrentFolderId(item.id);
      setViewMode('drive');
      setSelectedItem(null);
    } else if (item.mimeType === 'url') {
      try {
        await OpenFileLocally(item.id);
        addToast('info', 'Apertura link...', `Apertura di "${item.name}" nel browser predefinito.`);
      } catch (err: any) {
        addToast('error', "Errore nell'apertura", err?.toString() || 'Impossibile aprire il link.');
      }
    } else if (
      item.mimeType === 'text/markdown' ||
      item.name.toLowerCase().endsWith('.md') ||
      item.name.toLowerCase().endsWith('.markdown')
    ) {
      try {
        const fileContent = await GetFileContent(item.id);
        setMarkdownItem(item);
        setMarkdownContent(fileContent || '');
        setIsMarkdownModalOpen(true);
      } catch (err: any) {
        console.error('Failed to load markdown content:', err);
        addToast('error', 'Errore nella lettura', err?.toString() || 'Impossibile leggere il file Markdown.');
      }
    } else {
      try {
        await OpenFileLocally(item.id);
        addToast('info', 'Apertura in corso...', `Apertura di "${item.name}" con l'applicazione di sistema.`);
      } catch (err: any) {
        addToast('error', "Errore nell'apertura", err?.toString() || 'Impossibile aprire il file.');
      }
    }
  };

  // Open File with System Application (Explicit)
  const handleOpenWithSystemApp = async (item: DriveItem) => {
    try {
      await OpenFileLocally(item.id);
      addToast('info', 'Apertura con app di sistema...', `Apertura di "${item.name}".`);
    } catch (err: any) {
      addToast('error', "Errore nell'apertura", err?.toString() || 'Impossibile aprire il file.');
    }
  };

  // Start New Markdown Document
  const handleNewMarkdown = () => {
    setMarkdownItem(null);
    setMarkdownContent('');
    setIsMarkdownModalOpen(true);
  };

  // Save or Create Markdown Document
  const handleSaveMarkdown = async (name: string, content: string, id?: string) => {
    try {
      if (id) {
        await SaveMarkdownFile(id, content);
        addToast('success', 'Documento salvato', `Le modifiche a "${name}" sono state salvate.`);
      } else {
        await CreateMarkdownFile(name, content, currentFolderId);
        addToast('success', 'Documento creato', `Il file "${name}" è stato creato con successo.`);
      }
      loadData();
    } catch (err: any) {
      addToast('error', 'Errore nel salvataggio', err?.toString() || 'Impossibile salvare il documento.');
      throw err;
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

  // Create Exam Date
  const handleCreateExamDate = async (subject: string, examDate: string) => {
    try {
      await CreateExamDate(subject, examDate);
      addToast('success', 'Data esame creata', `L'esame per "${subject}" è stato aggiunto ai promemoria.`);
      loadExamDates();
    } catch (err: any) {
      addToast('error', 'Errore nel salvataggio', err?.toString() || 'Impossibile salvare la data esame.');
    }
  };

  // Delete Exam Date
  const handleDeleteExamDate = async (id: string) => {
    try {
      await DeleteExamDate(id);
      addToast('info', 'Data esame rimossa', 'La data d\'esame è stata rimossa.');
      loadExamDates();
    } catch (err: any) {
      addToast('error', 'Errore nella cancellazione', err?.toString() || 'Impossibile eliminare la data esame.');
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

  // Save Passed Exam (Create or Update)
  const handleSavePassedExam = async (data: {
    id?: string;
    subject: string;
    grade: number;
    isHonors: boolean;
    cfu: number;
    examDate: string;
  }) => {
    try {
      if (data.id) {
        await UpdatePassedExam(
          data.id,
          data.subject,
          data.grade,
          data.isHonors,
          data.cfu,
          data.examDate
        );
        addToast('success', 'Esame aggiornato', `"${data.subject}" è stato modificato con successo.`);
      } else {
        await CreatePassedExam(
          data.subject,
          data.grade,
          data.isHonors,
          data.cfu,
          data.examDate
        );
        addToast('success', 'Esame aggiunto', `"${data.subject}" è stato inserito nel libretto.`);
      }
      loadPassedExams();
    } catch (err: any) {
      addToast('error', "Errore nel salvataggio dell'esame", err?.toString() || 'Operazione non riuscita.');
    }
  };

  // Delete Passed Exam
  const handleDeletePassedExam = (exam: PassedExamItem) => {
    setConfirmModal({
      isOpen: true,
      title: 'Elimina Esame dal Libretto',
      message: `Sei sicuro di voler rimuovere "${exam.subject}" (${exam.isHonors ? '30L' : exam.grade} - ${exam.cfu} CFU) dal tuo libretto universitario?`,
      isDangerous: true,
      confirmText: 'Elimina esame',
      onConfirm: async () => {
        try {
          await DeletePassedExam(exam.id);
          addToast('success', 'Esame rimosso', `"${exam.subject}" è stato rimosso dal tuo libretto.`);
          loadPassedExams();
        } catch (err: any) {
          addToast('error', "Errore nell'eliminazione", err?.toString() || 'Impossibile eliminare');
        }
      },
    });
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
          onNewMarkdown={handleNewMarkdown}
          onUploadFiles={handleUploadFiles}
          onNewLink={() => setIsNewLinkModalOpen(true)}
          onNewExamDate={() => setIsNewExamModalOpen(true)}
          onDeleteExamDate={handleDeleteExamDate}
          onOpenStorageModal={() => setIsStorageModalOpen(true)}
          stats={storageStats}
          examDates={examDates}
          passedExamsCount={passedExams.length}
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

            {viewMode !== 'career' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium">
                  {items.length} {items.length === 1 ? 'elemento' : 'elementi'}
                </span>
                {viewMode === 'trash' && items.length > 0 && (
                  <button
                    onClick={handleEmptyTrash}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Svuota cestino</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Trash Information Banner inside Trash Section */}
          {viewMode === 'trash' && (
            <div className="mx-6 mt-4 p-3.5 bg-rose-50/50 border border-rose-200/70 rounded-2xl flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5 text-xs text-rose-900">
                <Info className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  Gli elementi presenti nel cestino non sono visibili nel Drive finché non vengono ripristinati o eliminati definitivamente.
                </span>
              </div>
              {items.length > 0 && (
                <button
                  onClick={handleEmptyTrash}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Svuota cestino</span>
                </button>
              )}
            </div>
          )}


          {/* Files / Folders List / Grid Area or Career / Booklet View */}
          {viewMode === 'career' ? (
            <CareerView
              passedExams={passedExams}
              onNewPassedExam={() => {
                setExamToEdit(null);
                setIsPassedExamModalOpen(true);
              }}
              onEditPassedExam={(exam) => {
                setExamToEdit(exam);
                setIsPassedExamModalOpen(true);
              }}
              onDeletePassedExam={handleDeletePassedExam}
            />
          ) : (
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
          )}
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
          onOpenWithSystemApp={handleOpenWithSystemApp}
          onExport={handleExportFile}
          onRename={(item) => setRenameModalItem(item)}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onDetails={(item) => setDetailsModalItem(item)}
        />
      )}

      {/* Modals */}
      <MarkdownModal
        isOpen={isMarkdownModalOpen}
        item={markdownItem}
        initialContent={markdownContent}
        onClose={() => setIsMarkdownModalOpen(false)}
        onSave={handleSaveMarkdown}
        onExport={handleExportFile}
        onOpenExternally={handleOpenWithSystemApp}
      />

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

      <NewExamModal
        isOpen={isNewExamModalOpen}
        onClose={() => setIsNewExamModalOpen(false)}
        onCreate={handleCreateExamDate}
      />

      <PassedExamModal
        isOpen={isPassedExamModalOpen}
        examToEdit={examToEdit}
        onClose={() => {
          setIsPassedExamModalOpen(false);
          setExamToEdit(null);
        }}
        onSave={handleSavePassedExam}
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
