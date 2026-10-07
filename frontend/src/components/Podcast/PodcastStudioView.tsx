import React, { useState, useEffect, useRef } from 'react';
import {
  DriveItem,
  PodcastEpisodeItem,
  PodcastTurnItem,
  PodcastProgressEventItem,
} from '../../types';
import {
  GeneratePodcast,
  ListPodcasts,
  DeletePodcast,
  GetPodcastAudioBase64,
  ExportPodcastAudio,
  ExportPodcastScript,
  SearchItems,
} from '../../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime';
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  FileText,
  Sparkles,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MessageSquareQuote,
  FileSpreadsheet,
  FileCode,
  File,
  AlertCircle,
  Loader2,
  Sliders,
  ChevronRight,
  Headphones,
  FileCheck,
} from 'lucide-react';

interface PodcastStudioViewProps {
  driveItems: DriveItem[];
  onOpenAISettings: () => void;
  addToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, description?: string) => void;
}

export const PodcastStudioView: React.FC<PodcastStudioViewProps> = ({
  driveItems,
  onOpenAISettings,
  addToast,
}) => {
  // Library of saved episodes
  const [episodes, setEpisodes] = useState<PodcastEpisodeItem[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<PodcastEpisodeItem | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(-1);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);

  // Generation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [customQuestions, setCustomQuestions] = useState('');
  const [tone, setTone] = useState<'colloquial' | 'academic'>('colloquial');
  const [length, setLength] = useState<'short' | 'standard' | 'deep'>('standard');
  const [fileSearchQuery, setFileSearchQuery] = useState('');

  // Generation Progress State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressEvent, setProgressEvent] = useState<PodcastProgressEventItem | null>(null);

  // Load episodes on mount
  useEffect(() => {
    loadEpisodes();
  }, []);

  // Listen to Wails progress event
  useEffect(() => {
    const handler = (evt: PodcastProgressEventItem) => {
      setProgressEvent(evt);
    };

    EventsOn('podcast:progress', handler);
    return () => {
      EventsOff('podcast:progress');
    };
  }, []);

  const loadEpisodes = async () => {
    try {
      setIsLoadingList(true);
      const list = await ListPodcasts();
      setEpisodes(list || []);
      if (list && list.length > 0 && !selectedEpisode) {
        handleSelectEpisode(list[0]);
      }
    } catch (err: any) {
      addToast('error', 'Errore caricamento podcast', err?.toString());
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectEpisode = async (ep: PodcastEpisodeItem) => {
    setSelectedEpisode(ep);
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveTurnIndex(-1);

    try {
      const dataUrl = await GetPodcastAudioBase64(ep.id);
      setAudioSrc(dataUrl);
    } catch (err: any) {
      addToast('error', 'Errore caricamento audio', err?.toString());
    }
  };

  // Audio element time updates and active speaker turn tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      if (selectedEpisode && selectedEpisode.turns) {
        const idx = selectedEpisode.turns.findIndex(
          (t) => cur >= t.startTime && cur < t.endTime
        );
        if (idx !== -1 && idx !== activeTurnIndex) {
          setActiveTurnIndex(idx);

          // Scroll active card into view smoothly
          const activeEl = document.getElementById(`turn-card-${idx}`);
          if (activeEl && transcriptContainerRef.current) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || selectedEpisode?.durationSeconds || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setActiveTurnIndex(-1);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [selectedEpisode, activeTurnIndex]);

  const togglePlay = () => {
    if (!audioRef.current || !audioSrc) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const handleSeek = (newTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    audioRef.current.currentTime = target;
  };

  const handleSpeedChange = (speed: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    setPlaybackRate(speed);
  };

  const handleVolumeChange = (vol: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handleJumpToTurn = (turn: PodcastTurnItem, idx: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = turn.startTime;
    setCurrentTime(turn.startTime);
    setActiveTurnIndex(idx);
    if (!isPlaying) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo episodio e il suo file audio?')) return;
    try {
      await DeletePodcast(id);
      addToast('success', 'Episodio eliminato', 'Il podcast è stato rimosso.');
      const updated = episodes.filter((e) => e.id !== id);
      setEpisodes(updated);
      if (selectedEpisode?.id === id) {
        if (updated.length > 0) {
          handleSelectEpisode(updated[0]);
        } else {
          setSelectedEpisode(null);
          setAudioSrc('');
        }
      }
    } catch (err: any) {
      addToast('error', 'Errore eliminazione', err?.toString());
    }
  };

  const handleExportAudio = async (id: string) => {
    try {
      await ExportPodcastAudio(id);
      addToast('success', 'Esportazione completata', 'Traccia audio salvata correttamente.');
    } catch (err: any) {
      addToast('error', 'Errore esportazione audio', err?.toString());
    }
  };

  const handleExportScript = async (id: string) => {
    try {
      await ExportPodcastScript(id);
      addToast('success', 'Esportazione completata', 'Sceneggiatura salvata correttamente.');
    } catch (err: any) {
      addToast('error', 'Errore esportazione copione', err?.toString());
    }
  };

  // Start Generation
  const handleStartGeneration = async () => {
    if (selectedItemIds.length === 0) {
      addToast('warning', 'Nessuna fonte selezionata', 'Seleziona almeno un documento dal tuo Drive.');
      return;
    }

    try {
      setIsGenerating(true);
      setProgressEvent({
        stage: 'init',
        percent: 5,
        message: 'Inizializzazione dello studio podcast...',
        currentTurn: 0,
        totalTurns: 0,
      });

      const newEpisode = await GeneratePodcast({
        itemIds: selectedItemIds,
        customQuestions: customQuestions.trim(),
        tone,
        length,
      });

      addToast('success', 'Podcast generato!', 'La puntata con Marco ed Elena è pronta per l\'ascolto.');
      setIsModalOpen(false);
      setSelectedItemIds([]);
      setCustomQuestions('');
      setProgressEvent(null);

      // Refresh list and select new episode
      const list = await ListPodcasts();
      setEpisodes(list || []);
      if (newEpisode) {
        handleSelectEpisode(newEpisode);
      }
    } catch (err: any) {
      const msg = err?.toString() || 'Errore sconosciuto';
      addToast('error', 'Errore generazione podcast', msg);
      if (msg.includes('API key') || msg.includes('Google Gemini')) {
        onOpenAISettings();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter available documents for selection
  const selectableFiles = driveItems.filter(
    (item) => !item.isFolder && !item.isTrash && item.mimeType !== 'url'
  );

  const filteredSelectableFiles = selectableFiles.filter((item) =>
    item.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  const toggleSelectFile = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Helper formatters
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Filtered turns for transcript search
  const filteredTurns = selectedEpisode?.turns
    ? selectedEpisode.turns.map((turn, index) => ({ turn, index })).filter(({ turn }) => {
        if (!transcriptSearch.trim()) return true;
        const q = transcriptSearch.toLowerCase();
        return turn.text.toLowerCase().includes(q) || turn.speaker.toLowerCase().includes(q);
      })
    : [];

  const currentSpeaker = activeTurnIndex >= 0 && selectedEpisode?.turns?.[activeTurnIndex]
    ? selectedEpisode.turns[activeTurnIndex].speaker
    : null;

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-gradient-to-br from-slate-50 via-purple-50/20 to-indigo-50/30">
      {/* Hidden native HTML5 Audio element */}
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Studio Top Bar */}
        <div className="px-6 py-4 bg-white/80 backdrop-blur-md border-b border-purple-100 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">Studio Podcast</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  Stile NotebookLM
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Dialogo accademico tra Marco ed Elena sintetizzato con voci neurali realistiche
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-2xl shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-500/30 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>Crea Nuovo Podcast</span>
            </button>
          </div>
        </div>

        {/* Studio Body */}
        {selectedEpisode ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 gap-6">
            {/* Left: Active Episode Stage & Audio Controller */}
            <div className="w-full md:w-5/12 flex flex-col gap-6 overflow-y-auto pr-1">
              {/* Hosts Stage Card */}
              <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Conduttori in Onda</span>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-1 leading-snug">
                  {selectedEpisode.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Durata totale: {formatTime(selectedEpisode.durationSeconds)}</span>
                  <span>•</span>
                  <span>{selectedEpisode.turns.length} scambi di dialogo</span>
                </div>

                {/* Hosts Interactive Avatars */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Host Marco */}
                  <div
                    className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${
                      currentSpeaker === 'Marco'
                        ? 'bg-blue-50/80 border-2 border-blue-400 shadow-md scale-102'
                        : 'bg-gray-50/70 border border-gray-100 opacity-85'
                    }`}
                  >
                    <div className="relative mb-2">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                          currentSpeaker === 'Marco'
                            ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 text-white ring-4 ring-blue-300 ring-offset-2 shadow-lg shadow-blue-500/30'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        M
                      </div>
                      {currentSpeaker === 'Marco' && (
                        <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-800">Marco</span>
                    <span className="text-[11px] text-gray-500 text-center leading-tight">
                      Curioso & Analogie
                    </span>
                    <span className="text-[9px] font-medium text-blue-600 bg-blue-100/70 px-1.5 py-0.5 rounded-md mt-1.5">
                      Diego Neural
                    </span>
                  </div>

                  {/* Host Elena */}
                  <div
                    className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${
                      currentSpeaker === 'Elena'
                        ? 'bg-purple-50/80 border-2 border-purple-400 shadow-md scale-102'
                        : 'bg-gray-50/70 border border-gray-100 opacity-85'
                    }`}
                  >
                    <div className="relative mb-2">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                          currentSpeaker === 'Elena'
                            ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white ring-4 ring-purple-300 ring-offset-2 shadow-lg shadow-purple-500/30'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        E
                      </div>
                      {currentSpeaker === 'Elena' && (
                        <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-800">Elena</span>
                    <span className="text-[11px] text-gray-500 text-center leading-tight">
                      Analisi & Focus Esame
                    </span>
                    <span className="text-[9px] font-medium text-purple-600 bg-purple-100/70 px-1.5 py-0.5 rounded-md mt-1.5">
                      Elsa Neural
                    </span>
                  </div>
                </div>

                {/* Sources & Custom Topics details */}
                <div className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-100">
                  <div>
                    <span className="font-semibold text-gray-700">Documenti di origine: </span>
                    <span className="text-gray-600">
                      {selectedEpisode.sourceItemNames.join(', ')}
                    </span>
                  </div>
                  {selectedEpisode.topic && (
                    <div>
                      <span className="font-semibold text-purple-700">Domande di focus: </span>
                      <span className="text-gray-600 italic">"{selectedEpisode.topic}"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Media Player Controls Card */}
              <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-sm flex flex-col gap-4">
                {/* Audio Progress Scrubber */}
                <div className="space-y-1.5">
                  <div className="relative flex items-center group">
                    <input
                      type="range"
                      min={0}
                      max={duration || selectedEpisode.durationSeconds || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={(e) => handleSeek(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration || selectedEpisode.durationSeconds)}</span>
                  </div>
                </div>

                {/* Main Player Buttons */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleSkip(-10)}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                    title="Indietro di 10 secondi"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                  </button>

                  <button
                    onClick={() => handleSkip(10)}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                    title="Avanti di 10 secondi"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-controls: Speed, Volume, Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                  {/* Speed buttons */}
                  <div className="flex items-center gap-1">
                    {[1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          playbackRate === speed
                            ? 'bg-purple-100 text-purple-700'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="text-gray-500 hover:text-purple-600 cursor-pointer"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 text-rose-500" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-16 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                  {/* Export and Delete actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleExportAudio(selectedEpisode.id)}
                      className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                      title="Esporta file audio .mp3"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportScript(selectedEpisode.id)}
                      className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                      title="Esporta sceneggiatura in Markdown"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedEpisode.id)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Elimina podcast"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Synchronized Interactive Transcript */}
            <div className="flex-1 flex flex-col bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
              {/* Transcript Header with Search */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="w-5 h-5 text-purple-600" />
                  <span className="font-bold text-gray-900 text-sm">
                    Sceneggiatura & Trascrizione Interattiva
                  </span>
                  <span className="text-xs text-gray-400">
                    ({selectedEpisode.turns.length} battute)
                  </span>
                </div>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cerca nella trascrizione..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Transcript Scroll Area */}
              <div
                ref={transcriptContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {filteredTurns.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-12">
                    <Search className="w-8 h-8 text-gray-300 mb-2" />
                    <p>Nessuna battuta trovata per "{transcriptSearch}"</p>
                  </div>
                ) : (
                  filteredTurns.map(({ turn, index }) => {
                    const isActive = index === activeTurnIndex;
                    const isMarco = turn.speaker === 'Marco';

                    return (
                      <div
                        key={index}
                        id={`turn-card-${index}`}
                        onClick={() => handleJumpToTurn(turn, index)}
                        className={`p-4 rounded-2xl transition-all cursor-pointer group ${
                          isActive
                            ? isMarco
                              ? 'bg-blue-50/90 border-2 border-blue-400 shadow-md transform translate-x-1'
                              : 'bg-purple-50/90 border-2 border-purple-400 shadow-md transform translate-x-1'
                            : 'bg-white hover:bg-slate-50/80 border border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isMarco
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-purple-600 text-white'
                              }`}
                            >
                              {isMarco ? 'M' : 'E'}
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                isMarco ? 'text-blue-900' : 'text-purple-900'
                              }`}
                            >
                              {turn.speaker}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full animate-pulse">
                                In riproduzione
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-gray-400 group-hover:text-purple-600 transition-colors">
                            {formatTime(turn.startTime)}
                          </span>
                        </div>

                        <p
                          className={`text-sm leading-relaxed ${
                            isActive
                              ? 'text-gray-950 font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          {turn.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty Studio State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-purple-100 flex items-center justify-center text-purple-600 mb-4 shadow-inner">
              <Radio className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Nessun podcast presente</h2>
            <p className="text-sm text-gray-500 max-w-md mb-6">
              Carica o seleziona i tuoi appunti, slide o libri universitari da EduDrive per creare la tua prima discussione audio guidata con Marco ed Elena.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-2xl shadow-md shadow-purple-500/25 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>Crea il tuo primo podcast</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Drawer / Sidebar: Archive of Episodes */}
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Clock className="w-4 h-4 text-purple-600" />
            <span>Puntate Salvate</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {episodes.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs">Caricamento episodi...</span>
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs px-4">
              Nessuna puntata creata finora.
            </div>
          ) : (
            episodes.map((ep) => {
              const isSelected = selectedEpisode?.id === ep.id;
              return (
                <div
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-purple-50/80 border-purple-300 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3
                      className={`text-xs font-bold line-clamp-2 leading-tight ${
                        isSelected ? 'text-purple-950' : 'text-gray-800'
                      }`}
                    >
                      {ep.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{formatTime(ep.durationSeconds)}</span>
                    <span className="text-gray-300">•</span>
                    <span>{new Date(ep.createdAt).toLocaleDateString()}</span>
                  </div>

                  {ep.sourceItemNames && ep.sourceItemNames.length > 0 && (
                    <div className="mt-2 text-[10px] text-gray-500 bg-gray-100/70 px-2 py-1 rounded-lg truncate">
                      {ep.sourceItemNames[0]}
                      {ep.sourceItemNames.length > 1 && ` +${ep.sourceItemNames.length - 1}`}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Generation Wizard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-white to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Crea Nuovo Podcast</h3>
                  <p className="text-xs text-gray-500">
                    Seleziona le fonti e inserisci le domande da discutere nella puntata
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

            {/* Modal Content */}
            {isGenerating ? (
              /* Generating Progress View */
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin flex items-center justify-center" />
                  <Radio className="w-8 h-8 text-purple-600 absolute inset-0 m-auto animate-pulse" />
                </div>

                <div className="space-y-2 max-w-md">
                  <h4 className="text-lg font-bold text-gray-900">
                    {progressEvent?.message || 'Elaborazione del podcast...'}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Gemini sta componendo il dialogo e le voci neurali Edge-TTS stanno sintetizzando le battute audio per Marco ed Elena.
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-md space-y-1.5">
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${progressEvent?.percent || 10}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 font-semibold">
                    <span>{progressEvent?.stage || 'Inizio'}</span>
                    <span>{progressEvent?.percent || 10}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 px-4 py-2 rounded-2xl border border-purple-100">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Attendi qualche istante, la qualità audio richiede pochi secondi...</span>
                </div>
              </div>
            ) : (
              /* Configuration View */
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Step 1: Select Source Documents */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>1. Seleziona i documenti di origine</span>
                      <span className="text-purple-600 font-normal">({selectedItemIds.length} selezionati)</span>
                    </label>
                  </div>

                  {/* Filter Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cerca tra i tuoi file del Drive..."
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Documents List */}
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white">
                    {filteredSelectableFiles.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">
                        Nessun documento trovato. Carica file nel tuo Drive prima di creare un podcast.
                      </div>
                    ) : (
                      filteredSelectableFiles.map((file) => {
                        const isSelected = selectedItemIds.includes(file.id);
                        return (
                          <div
                            key={file.id}
                            onClick={() => toggleSelectFile(file.id)}
                            className={`px-3 py-2.5 flex items-center justify-between hover:bg-purple-50/50 cursor-pointer transition-colors ${
                              isSelected ? 'bg-purple-50/80' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by parent div
                                className="w-4 h-4 rounded text-purple-600 accent-purple-600 focus:ring-0 cursor-pointer"
                              />
                              <File className="w-4 h-4 text-gray-400 shrink-0" />
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

                {/* Step 2: Custom Questions / Topics (Requested feature) */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-900 flex items-center justify-between">
                    <span>2. Domande di approfondimento o temi specifici (Opzionale)</span>
                    <span className="text-[11px] text-purple-600 font-normal">I conduttori risponderanno a queste domande!</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Esempio: Spiega con particolare enfasi la differenza tra il primo e il secondo teorema, fai un esempio concreto e simula una domanda d'esame..."
                    value={customQuestions}
                    onChange={(e) => setCustomQuestions(e.target.value)}
                    className="w-full p-3 text-xs bg-slate-50 border border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all resize-none"
                  />

                  {/* Quick suggestion chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Spiega i punti più difficili con analogie semplici',
                      'Simula una domanda tipica d\'esame con risposta',
                      'Fai un riassunto finale dei concetti da memorizzare',
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setCustomQuestions((prev) =>
                            prev ? `${prev}\n- ${chip}` : `- ${chip}`
                          )
                        }
                        className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1 rounded-lg border border-purple-200/60 transition-colors cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3: Tone & Length Settings */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Tone selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-800">Tono della conversazione</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTone('colloquial')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          tone === 'colloquial'
                            ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>Colloquiale</span>
                        <span className="text-[10px] font-normal text-gray-400">Vivace & Accessibile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTone('academic')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          tone === 'academic'
                            ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>Accademico</span>
                        <span className="text-[10px] font-normal text-gray-400">Rigoroso & Formale</span>
                      </button>
                    </div>
                  </div>

                  {/* Length selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-800">Durata puntata</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'short', label: 'Breve', turns: '~6 battute' },
                        { id: 'standard', label: 'Standard', turns: '~14 battute' },
                        { id: 'deep', label: 'Estesa', turns: '~20 battute' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setLength(item.id as any)}
                          className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                            length === item.id
                              ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-[9px] font-normal text-gray-400">{item.turns}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            {!isGenerating && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {selectedItemIds.length > 0
                    ? `${selectedItemIds.length} documento/i pronto/i per l'analisi`
                    : 'Seleziona almeno una fonte per procedere'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    disabled={selectedItemIds.length === 0}
                    onClick={handleStartGeneration}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-purple-200" />
                    <span>Genera Podcast con l'IA</span>
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
