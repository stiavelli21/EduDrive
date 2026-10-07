import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  DriveItem,
  StudyHandoutItem,
  StudyHandoutProgressEventItem,
} from '../../types';
import {
  GenerateStudyHandout,
  ListStudyHandouts,
  GetStudyHandout,
  UpdateStudyHandout,
  DeleteStudyHandout,
  SaveStudyHandoutToDrive,
  ExportStudyHandoutMarkdown,
} from '../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime';
import {
  Sparkles,
  BookOpen,
  Plus,
  Search,
  Trash2,
  Save,
  Download,
  Copy,
  Check,
  Edit3,
  Eye,
  FileText,
  FileCheck,
  FolderOpen,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Layers,
  GraduationCap,
  Lightbulb,
  Cpu,
  Target,
  ArrowRight,
  HelpCircle,
  FileCode,
  FileSpreadsheet,
  File,
  HardDrive,
} from 'lucide-react';

interface HandoutStudioViewProps {
  driveItems: DriveItem[];
  onOpenAISettings: () => void;
  addToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => void;
}

// Mode definition metadata
const STUDY_MODES = [
  {
    id: 'reasoned_handout',
    title: 'Dispensa Ragionata',
    badge: 'Discorsiva',
    icon: BookOpen,
    color: 'indigo',
    bgLight: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    activeRing: 'ring-indigo-500',
    description: 'Fonde slide frammentate e appunti in un testo discorsivo, fluido e rigoroso, con un filo logico coerente.',
  },
  {
    id: 'didactic_simplification',
    title: 'Semplificazione Didattica',
    badge: 'Metodo Feynman',
    icon: Lightbulb,
    color: 'amber',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    activeRing: 'ring-amber-500',
    description: 'Spiega concetti astratti e ostici con parole semplici, analogie del mondo reale e passaggi graduali.',
  },
  {
    id: 'technical_deep_dive',
    title: 'Approfondimento & Esempi',
    badge: 'Formule & Codice',
    icon: Cpu,
    color: 'cyan',
    bgLight: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    activeRing: 'ring-cyan-500',
    description: 'Colma i salti logici delle slide, esplicita tutte le derivazioni in KaTeX e fornisce codice ed esempi pratici.',
  },
  {
    id: 'exam_prep',
    title: 'Schemi & Focus Esame',
    badge: 'Pronto per il 30L',
    icon: Target,
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    activeRing: 'ring-emerald-500',
    description: 'Mappa concettuale dei topic chiave, domande probabili con risposte modello perfette e trabocchetti d’esame.',
  },
];

export const HandoutStudioView: React.FC<HandoutStudioViewProps> = ({
  driveItems,
  onOpenAISettings,
  addToast,
}) => {
  // Library of saved handouts
  const [handouts, setHandouts] = useState<StudyHandoutItem[]>([]);
  const [selectedHandout, setSelectedHandout] = useState<StudyHandoutItem | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listSearchQuery, setListSearchQuery] = useState('');

  // Reader / Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedMarkdown, setEditedMarkdown] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);

  // Generation Modal Wizard State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [modeInput, setModeInput] = useState<string>('reasoned_handout');
  const [detailLevelInput, setDetailLevelInput] = useState<string>('standard');
  const [customInstructionsInput, setCustomInstructionsInput] = useState('');
  const [saveToDriveInput, setSaveToDriveInput] = useState(true);
  const [fileSearchQuery, setFileSearchQuery] = useState('');

  // Generation Progress & Streaming State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressEvent, setProgressEvent] = useState<StudyHandoutProgressEventItem | null>(null);
  const [streamingPreview, setStreamingPreview] = useState<string>('');
  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  // Load existing handouts on mount
  useEffect(() => {
    loadHandouts();
  }, []);

  // Listen to Wails progress and streaming chunk events
  useEffect(() => {
    const handleProgress = (evt: StudyHandoutProgressEventItem) => {
      setProgressEvent(evt);
    };

    const handleChunk = (data: { requestId: string; chunk: string }) => {
      if (data && data.chunk) {
        setStreamingPreview((prev) => prev + data.chunk);
        if (previewScrollRef.current) {
          previewScrollRef.current.scrollTop = previewScrollRef.current.scrollHeight;
        }
      }
    };

    EventsOn('handout:progress', handleProgress);
    EventsOn('handout:chunk', handleChunk);

    return () => {
      EventsOff('handout:progress');
      EventsOff('handout:chunk');
    };
  }, []);

  const loadHandouts = async () => {
    try {
      setIsLoadingList(true);
      const list = await ListStudyHandouts();
      setHandouts(list || []);
      if (list && list.length > 0 && !selectedHandout) {
        handleSelectHandout(list[0]);
      }
    } catch (err: any) {
      addToast('error', 'Errore caricamento dispense', err?.toString());
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectHandout = (item: StudyHandoutItem) => {
    setSelectedHandout(item);
    setIsEditing(false);
    setEditedTitle(item.title);
    setEditedMarkdown(item.contentMarkdown);
  };

  const handleSaveEdit = async () => {
    if (!selectedHandout) return;
    try {
      setIsSavingEdit(true);
      await UpdateStudyHandout(selectedHandout.id, editedTitle, editedMarkdown);

      const updated = {
        ...selectedHandout,
        title: editedTitle,
        contentMarkdown: editedMarkdown,
        updatedAt: new Date().toISOString(),
      };
      setSelectedHandout(updated);
      setHandouts((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
      setIsEditing(false);
      addToast('success', 'Dispensa salvata', 'Le modifiche al testo sono state salvate con successo.');
    } catch (err: any) {
      addToast('error', 'Errore salvataggio', err?.toString());
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteHandout = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questa dispensa?')) return;

    try {
      await DeleteStudyHandout(id);
      const remaining = handouts.filter((h) => h.id !== id);
      setHandouts(remaining);
      if (selectedHandout?.id === id) {
        setSelectedHandout(remaining.length > 0 ? remaining[0] : null);
        if (remaining.length > 0) {
          handleSelectHandout(remaining[0]);
        }
      }
      addToast('info', 'Dispensa eliminata', 'La dispensa è stata rimossa dall\'archivio.');
    } catch (err: any) {
      addToast('error', 'Errore eliminazione', err?.toString());
    }
  };

  const handleSaveToDrive = async () => {
    if (!selectedHandout) return;
    try {
      setIsSavingToDrive(true);
      const createdItem = await SaveStudyHandoutToDrive(selectedHandout.id, '');
      if (createdItem) {
        const updated = {
          ...selectedHandout,
          driveItemId: createdItem.id,
        };
        setSelectedHandout(updated);
        setHandouts((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
        addToast('success', 'Salvato nel tuo Drive', `File "${createdItem.name}" salvato tra i tuoi documenti.`);
      }
    } catch (err: any) {
      addToast('error', 'Errore salvataggio Drive', err?.toString());
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const handleExportMarkdown = async () => {
    if (!selectedHandout) return;
    try {
      await ExportStudyHandoutMarkdown(selectedHandout.id);
      addToast('success', 'File esportato', 'La dispensa in formato Markdown è stata esportata sul computer.');
    } catch (err: any) {
      addToast('error', 'Errore esportazione', err?.toString());
    }
  };

  const handleCopyMarkdown = () => {
    if (!selectedHandout) return;
    const textToCopy = isEditing ? editedMarkdown : selectedHandout.contentMarkdown;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    addToast('info', 'Copiato!', 'Contenuto Markdown copiato negli appunti.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Open modal with fresh state
  const openNewHandoutModal = () => {
    setSelectedItemIds([]);
    setTitleInput('');
    setTopicInput('');
    setModeInput('reasoned_handout');
    setDetailLevelInput('standard');
    setCustomInstructionsInput('');
    setSaveToDriveInput(true);
    setFileSearchQuery('');
    setStreamingPreview('');
    setProgressEvent(null);
    setIsModalOpen(true);
  };

  // Toggle selection of file in modal
  const toggleSelectFile = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter selectable files from drive
  const selectableFiles = driveItems.filter((i) => !i.isFolder && !i.isTrash && i.mimeType !== 'url');
  const filteredSelectableFiles = selectableFiles.filter((i) =>
    i.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  const handleSelectAllFiles = () => {
    if (selectedItemIds.length === filteredSelectableFiles.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredSelectableFiles.map((f) => f.id));
    }
  };

  // Start generation process
  const handleStartGenerate = async () => {
    if (selectedItemIds.length === 0) {
      addToast('warning', 'Nessun file selezionato', 'Seleziona almeno una slide o documento per iniziare.');
      return;
    }

    try {
      setIsGenerating(true);
      setStreamingPreview('');
      setProgressEvent({
        stage: 'sources',
        percent: 10,
        message: 'Inizializzazione e lettura dei file...',
      });

      const newHandout = await GenerateStudyHandout({
        title: titleInput,
        topic: topicInput,
        itemIds: selectedItemIds,
        mode: modeInput,
        detailLevel: detailLevelInput,
        customInstructions: customInstructionsInput,
        saveToDrive: saveToDriveInput,
        targetFolderId: '',
      } as any);

      if (newHandout) {
        setHandouts((prev) => [newHandout, ...prev]);
        handleSelectHandout(newHandout);
        setIsModalOpen(false);
        addToast('success', 'Dispensa creata!', 'La tua nuova dispensa integrata è pronta per lo studio.');
      }
    } catch (err: any) {
      const errStr = err?.toString() || '';
      if (errStr.includes('API key')) {
        addToast('error', 'API Key Mancante', 'Configura la tua API key di Gemini nelle impostazioni IA.');
        onOpenAISettings();
      } else {
        addToast('error', 'Generazione non riuscita', errStr);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper for mode UI info
  const getModeInfo = (modeKey: string) => {
    return STUDY_MODES.find((m) => m.id === modeKey) || STUDY_MODES[0];
  };

  // Filter list of handouts
  const filteredHandouts = handouts.filter(
    (h) =>
      h.title.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
      h.topic.toLowerCase().includes(listSearchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-50 select-none">
      {/* LEFT COLUMN: Library of Saved Handouts */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0">
        {/* Header with Title and "Nuova Dispensa" button */}
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">Studio Dispense</h2>
                <p className="text-[11px] text-gray-500">Sintesi & ragionamento slide</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              AI Tutor
            </span>
          </div>

          <button
            onClick={openNewHandoutModal}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer group"
          >
            <Sparkles className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
            <span>+ Nuova Dispensa da File</span>
          </button>

          {/* Search bar for handouts */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca dispense create..."
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Handouts List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {isLoadingList ? (
            <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Caricamento archivio dispense...</span>
            </div>
          ) : filteredHandouts.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center gap-2 mt-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center mb-1">
                <BookOpen className="w-6 h-6" />
              </div>
              <p className="font-semibold text-gray-600">Nessuna dispensa presente</p>
              <p className="text-[11px] leading-relaxed max-w-[200px]">
                Seleziona slide, PDF o note per fonderle in un discorso logico e chiaro.
              </p>
            </div>
          ) : (
            filteredHandouts.map((handout) => {
              const isSelected = selectedHandout?.id === handout.id;
              const modeInfo = getModeInfo(handout.mode);
              const ModeIcon = modeInfo.icon;

              return (
                <div
                  key={handout.id}
                  onClick={() => handleSelectHandout(handout)}
                  className={`p-3 rounded-2xl cursor-pointer transition-all border text-left group ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-200 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`p-1 rounded-lg ${modeInfo.bgLight} ${modeInfo.text} shrink-0`}>
                        <ModeIcon className="w-3.5 h-3.5" />
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 truncate">
                        {handout.title}
                      </h4>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHandout(handout.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-600 rounded-md hover:bg-white/80 transition-all cursor-pointer"
                      title="Elimina dispensa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {handout.topic && (
                    <p className="text-[11px] text-gray-500 truncate mt-1 pl-6">
                      {handout.topic}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2 pl-6">
                    <span className="font-medium text-gray-500">
                      {handout.sourceItemNames?.length || 1} fonti
                    </span>
                    <span>{new Date(handout.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Handout Reader / Editor */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {selectedHandout ? (
          <>
            {/* Top Toolbar */}
            <div className="px-6 py-3.5 border-b border-gray-200 bg-white flex items-center justify-between gap-4 shrink-0 shadow-2xs">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-base font-bold text-gray-900 w-full px-2 py-1 bg-slate-50 border border-indigo-300 rounded-lg focus:outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-2.5 truncate">
                    <h1 className="text-base font-bold text-gray-900 truncate">
                      {selectedHandout.title}
                    </h1>
                    {(() => {
                      const modeInfo = getModeInfo(selectedHandout.mode);
                      return (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${modeInfo.bgLight} ${modeInfo.text} border ${modeInfo.border} shrink-0`}>
                          {modeInfo.badge}
                        </span>
                      );
                    })()}
                  </div>
                )}

                {/* Sources pill list */}
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 overflow-x-auto">
                  <span className="font-medium text-gray-400 shrink-0">Fonti usate:</span>
                  {selectedHandout.sourceItemNames && selectedHandout.sourceItemNames.length > 0 ? (
                    selectedHandout.sourceItemNames.map((name, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.2 rounded-md bg-slate-100 text-gray-700 text-[10px] truncate max-w-[160px] border border-gray-200 shrink-0"
                        title={name}
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="italic text-gray-400">Materiali aggregati</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle View / Edit */}
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    isEditing
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white hover:bg-slate-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                  <span>{isEditing ? 'Visualizza' : 'Modifica'}</span>
                </button>

                {isEditing && (
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Salva</span>
                  </button>
                )}

                {/* Save to Drive */}
                <button
                  onClick={handleSaveToDrive}
                  disabled={isSavingToDrive}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    selectedHandout.driveItemId
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white hover:bg-slate-50 text-gray-700 border-gray-200'
                  }`}
                  title={selectedHandout.driveItemId ? 'Aggiorna file nel tuo Drive' : 'Salva come file Markdown nel Drive'}
                >
                  {isSavingToDrive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  ) : selectedHandout.driveItemId ? (
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span>{selectedHandout.driveItemId ? 'Nel Drive' : 'Salva nel Drive'}</span>
                </button>

                {/* Export Markdown */}
                <button
                  onClick={handleExportMarkdown}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-gray-700 border border-gray-200 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Esporta file .md su disco"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Esporta</span>
                </button>

                {/* Copy Markdown */}
                <button
                  onClick={handleCopyMarkdown}
                  className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-slate-100 border border-gray-200 transition-colors cursor-pointer"
                  title="Copia Markdown negli appunti"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Content Area: Markdown View or Text Editor */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              {isEditing ? (
                <div className="h-full flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                    <span>Editor Markdown con supporto formule KaTeX ($...$ e $$...$$)</span>
                    <span>{editedMarkdown.length} caratteri</span>
                  </div>
                  <textarea
                    value={editedMarkdown}
                    onChange={(e) => setEditedMarkdown(e.target.value)}
                    className="flex-1 w-full p-4 font-mono text-xs bg-slate-50/70 border border-gray-200 rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-white resize-none leading-relaxed"
                    placeholder="Scrivi o modifica la dispensa in Markdown..."
                  />
                </div>
              ) : (
                <article className="prose prose-slate max-w-none text-gray-800 leading-relaxed font-sans select-text">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-black text-gray-900 border-b border-gray-200 pb-2 mb-6 mt-2" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3 flex items-center gap-2" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-base font-bold text-gray-800 mt-6 mb-2" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-4 leading-relaxed text-sm text-gray-700" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-5 space-y-1.5 mb-4 text-sm text-gray-700" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-5 space-y-1.5 mb-4 text-sm text-gray-700" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="leading-relaxed" {...props} />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/60 pl-4 py-2 my-4 rounded-r-xl text-indigo-900 text-sm font-medium" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-6 rounded-2xl border border-gray-200">
                          <table className="w-full text-xs text-left border-collapse" {...props} />
                        </div>
                      ),
                      th: ({ node, ...props }) => (
                        <th className="bg-slate-100 px-4 py-2.5 font-bold text-gray-800 border-b border-gray-200" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700" {...props} />
                      ),
                      code: ({ node, inline, children, ...props }: any) => {
                        if (inline) {
                          return (
                            <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-indigo-700 font-mono text-xs font-semibold border border-slate-200" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return (
                          <pre className="p-4 my-4 rounded-2xl bg-gray-900 text-gray-100 overflow-x-auto font-mono text-xs leading-relaxed border border-gray-800 shadow-xs">
                            <code {...props}>{children}</code>
                          </pre>
                        );
                      },
                    }}
                  >
                    {selectedHandout.contentMarkdown}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          </>
        ) : (
          /* Empty State when no handout is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-100 via-violet-100 to-purple-100 text-indigo-600 flex items-center justify-center mb-6 shadow-xs">
              <BookOpen className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Trasforma Slide ed Appunti in Dispense Strutturate
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-8">
              Le slide dei docenti sono frammentate e piene di elenchi puntati. EduDrive unifica i tuoi file, colma le lacune logiche, semplifica i concetti e scrive una dispensa completa pronta per l'esame.
            </p>

            <button
              onClick={openNewHandoutModal}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
              <span>Crea la tua prima dispensa ora</span>
            </button>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-3 mt-10 w-full text-left">
              {STUDY_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <div key={mode.id} className="p-3.5 bg-slate-50 border border-gray-200/80 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`p-1 rounded-lg ${mode.bgLight} ${mode.text}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <h4 className="text-xs font-bold text-gray-900">{mode.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* GENERATION WIZARD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-white to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Crea Nuova Dispensa da File</h3>
                  <p className="text-xs text-gray-500">
                    Unisci e sintetizza slide, note e documenti in un discorso logico
                  </p>
                </div>
              </div>
              {!isGenerating && (
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Body */}
            {isGenerating ? (
              /* Generating Progress View */
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin flex items-center justify-center" />
                  <GraduationCap className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                </div>

                <div className="space-y-1.5 max-w-md">
                  <h4 className="text-lg font-bold text-gray-900">
                    {progressEvent?.message || 'Elaborazione della dispensa in corso...'}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Gemini sta analizzando le slide, collegando le definizioni e redigendo il testo accademico.
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-md space-y-1.5">
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-300"
                      style={{ width: `${progressEvent?.percent || 15}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 font-semibold">
                    <span>{progressEvent?.stage || 'Inizio'}</span>
                    <span>{progressEvent?.percent || 15}%</span>
                  </div>
                </div>

                {/* Live Streamed Preview Box */}
                {streamingPreview && (
                  <div
                    ref={previewScrollRef}
                    className="w-full max-h-48 overflow-y-auto p-4 bg-slate-900 text-gray-200 font-mono text-[11px] rounded-2xl text-left border border-slate-800 shadow-inner leading-relaxed"
                  >
                    <div className="text-[10px] text-indigo-400 font-bold mb-1 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Anteprima generazione in tempo reale...</span>
                    </div>
                    {streamingPreview}
                  </div>
                )}
              </div>
            ) : (
              /* Configuration View */
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step 1: Select Files */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>1. Seleziona le slide e i documenti di origine</span>
                      <span className="text-indigo-600 font-semibold">({selectedItemIds.length} selezionati)</span>
                    </label>
                    {filteredSelectableFiles.length > 0 && (
                      <button
                        onClick={handleSelectAllFiles}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        {selectedItemIds.length === filteredSelectableFiles.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                      </button>
                    )}
                  </div>

                  {/* Search Filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cerca file tra le tue cartelle..."
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Files List */}
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white">
                    {filteredSelectableFiles.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">
                        Nessun documento trovato. Carica file nel tuo Drive per iniziare.
                      </div>
                    ) : (
                      filteredSelectableFiles.map((file) => {
                        const isSelected = selectedItemIds.includes(file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleSelectFile(file.id)}
                            className={`px-3 py-2 flex items-center justify-between hover:bg-indigo-50/40 cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50/70' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 focus:ring-0 cursor-pointer"
                              />
                              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="text-xs font-medium text-gray-800 truncate">
                                {file.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                              {(file.sizeBytes / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Step 2: Choose Study Mode */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-900 block">
                    2. Scegli la modalità di elaborazione
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    {STUDY_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = modeInput === mode.id;
                      return (
                        <div
                          key={mode.id}
                          onClick={() => setModeInput(mode.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? `${mode.bgLight} ${mode.border} ring-2 ${mode.activeRing} shadow-2xs`
                              : 'bg-white hover:bg-slate-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`p-1 rounded-lg ${mode.bgLight} ${mode.text}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs font-bold text-gray-900">{mode.title}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-relaxed">
                            {mode.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Granularity & Title */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Livello di dettaglio
                    </label>
                    <select
                      value={detailLevelInput}
                      onChange={(e) => setDetailLevelInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="concise">Sintetico (focus essenziale)</option>
                      <option value="standard">Standard (equilibrato e completo)</option>
                      <option value="exhaustive">Esaustivo (approfondito e dettagliato)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Titolo personalizzato (opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Dispensa di Calcolo Numerico"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Step 4: Special Instructions */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Istruzioni speciali o focus tematico (opzionale)
                  </label>
                  <textarea
                    placeholder="Es. 'Focalizzati in particolare sulla parte relativa agli algoritmi di routing', 'Spiega la dimostrazione della pagina 8 passo passo'..."
                    value={customInstructionsInput}
                    onChange={(e) => setCustomInstructionsInput(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* Option: Save to Drive */}
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="saveToDriveCheck"
                    checked={saveToDriveInput}
                    onChange={(e) => setSaveToDriveInput(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="saveToDriveCheck" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                    Salva automaticamente una copia in formato <code className="text-indigo-600 font-mono text-[11px]">.md</code> anche nella cartella principale del mio Drive
                  </label>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            {!isGenerating && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs text-gray-500">
                  {selectedItemIds.length === 0
                    ? 'Seleziona almeno un file per procedere'
                    : `${selectedItemIds.length} documenti pronti per l'elaborazione`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleStartGenerate}
                    disabled={selectedItemIds.length === 0}
                    className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Genera Dispensa</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
