import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  Sparkles,
  X,
  Send,
  Square,
  RotateCcw,
  Copy,
  Check,
  Settings,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  Loader2,
  Quote,
} from 'lucide-react';
import {
  AskAI,
  CancelAIRequest,
  GetAISettings,
} from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { AIChatMessageItem } from '../../types';

export interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  itemId?: string;
  documentName: string;
  documentText?: string;
  // External prompt or selection passed from DocumentViewerModal or MarkdownModal
  externalRequest?: {
    question?: string;
    selectedText?: string;
    imageCropBase64?: string;
    imageCropMime?: string;
  } | null;
  onClearExternalRequest?: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  itemId = '',
  documentName,
  documentText = '',
  externalRequest,
  onClearExternalRequest,
}) => {
  const [messages, setMessages] = useState<AIChatMessageItem[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [modelName, setModelName] = useState('Gemini');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Active snippet attached to the next message
  const [attachedSelection, setAttachedSelection] = useState<string | null>(null);
  const [attachedImageCrop, setAttachedImageCrop] = useState<{
    base64: string;
    mime: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastRequestIdRef = useRef<string | null>(null);

  // Check API key status whenever panel opens
  useEffect(() => {
    if (!isOpen) return;
    GetAISettings()
      .then((settings) => {
        setHasApiKey(settings.hasApiKey);
        if (settings.model) setModelName(settings.model);
      })
      .catch((err) => {
        console.error('Failed to load AI settings in panel:', err);
      });
  }, [isOpen]);

  // Scroll to bottom on new messages or chunks
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  // Listen to Wails streaming events
  useEffect(() => {
    const unsubChunk = EventsOn('ai:chunk', (data: { requestId: string; text: string }) => {
      if (!data || data.requestId !== lastRequestIdRef.current) return;

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === 'model') {
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + data.text },
          ];
        }
        return [...prev, { role: 'model', text: data.text, selectedText: '', hasImageCrop: false }];
      });
    });

    const unsubDone = EventsOn('ai:done', (data: { requestId: string; cancelled?: boolean }) => {
      if (!data || data.requestId !== lastRequestIdRef.current) return;
      setIsStreaming(false);
      setCurrentRequestId(null);
      lastRequestIdRef.current = null;
    });

    const unsubError = EventsOn('ai:error', (data: { requestId: string; message: string }) => {
      if (!data || data.requestId !== lastRequestIdRef.current) return;
      setIsStreaming(false);
      setCurrentRequestId(null);
      lastRequestIdRef.current = null;
      setErrorMessage(data.message || 'Si e verificato un errore durante la risposta.');
    });

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, []);

  // Send a question to the AI assistant
  const handleSend = useCallback(
    async (
      overrideQuestion?: string,
      overrideSelection?: string,
      overrideImageCrop?: { base64: string; mime: string }
    ) => {
      const q = (overrideQuestion !== undefined ? overrideQuestion : inputQuestion).trim();
      const sel = (overrideSelection !== undefined ? overrideSelection : attachedSelection) || '';
      const crop = overrideImageCrop !== undefined ? overrideImageCrop : attachedImageCrop;

      if (!q && !sel && !crop) return;
      if (isStreaming) return;

      setErrorMessage(null);

      // Create new user turn
      const userMessage: AIChatMessageItem = {
        role: 'user',
        text: q || (sel ? 'Spiegami questo passaggio.' : 'Spiegami questa parte dell\'immagine.'),
        selectedText: sel,
        hasImageCrop: !!crop,
      };

      const newHistory = [...messages, userMessage];
      setMessages(newHistory);
      setInputQuestion('');
      setAttachedSelection(null);
      setAttachedImageCrop(null);

      // Placeholder for incoming streaming model answer
      const modelPlaceholder: AIChatMessageItem = {
        role: 'model',
        text: '',
        selectedText: '',
        hasImageCrop: false,
      };
      setMessages([...newHistory, modelPlaceholder]);

      const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setCurrentRequestId(reqId);
      lastRequestIdRef.current = reqId;
      setIsStreaming(true);

      try {
        await AskAI({
          requestId: reqId,
          itemId,
          documentName,
          documentText,
          question: userMessage.text,
          selectedText: userMessage.selectedText,
          imageCropBase64: crop ? crop.base64 : '',
          imageCropMime: crop ? crop.mime : '',
          history: messages,
        } as any);
      } catch (err: any) {
        console.error('AskAI invocation failed:', err);
        setIsStreaming(false);
        setCurrentRequestId(null);
        lastRequestIdRef.current = null;
        setErrorMessage(err?.toString() || 'Impossibile avviare la richiesta all\'assistente.');
      }
    },
    [
      inputQuestion,
      attachedSelection,
      attachedImageCrop,
      isStreaming,
      messages,
      itemId,
      documentName,
      documentText,
    ]
  );

  // Handle external requests (e.g. user clicked "Spiega" on a selection or crop)
  useEffect(() => {
    if (!externalRequest) return;

    if (externalRequest.question !== undefined && externalRequest.question !== '') {
      // Immediate query triggered from popover
      const cropObj = externalRequest.imageCropBase64
        ? { base64: externalRequest.imageCropBase64, mime: externalRequest.imageCropMime || 'image/png' }
        : undefined;

      handleSend(externalRequest.question, externalRequest.selectedText, cropObj);
    } else {
      // Attach selection to input area and focus textarea
      if (externalRequest.selectedText) {
        setAttachedSelection(externalRequest.selectedText);
      }
      if (externalRequest.imageCropBase64) {
        setAttachedImageCrop({
          base64: externalRequest.imageCropBase64,
          mime: externalRequest.imageCropMime || 'image/png',
        });
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }

    if (onClearExternalRequest) onClearExternalRequest();
  }, [externalRequest, handleSend, onClearExternalRequest]);

  // Stop Generation
  const handleStop = async () => {
    if (currentRequestId) {
      try {
        await CancelAIRequest(currentRequestId);
      } catch (err) {
        console.error('Failed to cancel request:', err);
      }
      setIsStreaming(false);
      setCurrentRequestId(null);
      lastRequestIdRef.current = null;
    }
  };

  // Reset Conversation
  const handleClearHistory = () => {
    if (messages.length === 0) return;
    if (window.confirm('Cancellare la cronologia della conversazione per questo file?')) {
      handleStop();
      setMessages([]);
      setErrorMessage(null);
      setAttachedSelection(null);
      setAttachedImageCrop(null);
    }
  };

  // Copy Message to Clipboard
  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  // Handle Enter key (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-96 md:w-[420px] h-full bg-slate-50 border-l border-gray-200 flex flex-col shrink-0 overflow-hidden shadow-2xl animate-fade-in z-20 select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 select-none shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-gray-900 truncate">
                Assistente Appunti
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shrink-0">
                {modelName.replace('gemini-', '')}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1" title={documentName}>
              <FileText className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="truncate">{documentName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Azzera conversazione"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Impostazioni IA (Chiave API e modello)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Chiudi pannello"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* No API Key Banner */}
      {!hasApiKey && (
        <div className="p-4 m-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col gap-2 shrink-0 select-none shadow-xs">
          <div className="flex items-start gap-2 text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">Attiva l'assistente IA</p>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                Configura gratuitamente la tua chiave Google Gemini per spiegare
                formule, passaggi complessi e schematizzare i tuoi appunti.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="self-start px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Inserisci chiave API gratuita
          </button>
        </div>
      )}

      {/* Message Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4 my-auto select-none">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-xs font-bold text-gray-800">
                Come posso aiutarti con questo appunto?
              </h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Seleziona qualsiasi pezzo del documento per chiedermene il significato,
                oppure scegli una domanda rapida:
              </p>
            </div>

            {/* Quick Starter Pills */}
            <div className="w-full space-y-2 pt-2">
              <button
                onClick={() => handleSend('Spiega la struttura generale e la scaletta dei concetti di questo appunto.')}
                className="w-full p-2 text-left text-xs bg-white hover:bg-indigo-50/70 border border-gray-200 hover:border-indigo-200 rounded-xl text-gray-700 hover:text-indigo-800 font-medium transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Spiega la struttura dell'appunto</span>
              </button>

              <button
                onClick={() => handleSend('Fai un riassunto chiaro e sintetico dei concetti principali trattati in questo documento.')}
                className="w-full p-2 text-left text-xs bg-white hover:bg-indigo-50/70 border border-gray-200 hover:border-indigo-200 rounded-xl text-gray-700 hover:text-indigo-800 font-medium transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Riassumi i punti chiave</span>
              </button>

              <button
                onClick={() => handleSend('Quali sono le definizioni, i teoremi o le formule piu importanti presenti in questo documento?')}
                className="w-full p-2 text-left text-xs bg-white hover:bg-indigo-50/70 border border-gray-200 hover:border-indigo-200 rounded-xl text-gray-700 hover:text-indigo-800 font-medium transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Definizioni e formule principali</span>
              </button>

              <button
                onClick={() => handleSend('Formula 3 domande d\'esame a risposta aperta su questo appunto per verificare se ho capito bene.')}
                className="w-full p-2 text-left text-xs bg-white hover:bg-indigo-50/70 border border-gray-200 hover:border-indigo-200 rounded-xl text-gray-700 hover:text-indigo-800 font-medium transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span>Mettimi alla prova con 3 domande</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {/* Quoted Snippet Indicator for User message */}
              {msg.role === 'user' && msg.selectedText && (
                <div className="max-w-[85%] mb-1 px-3 py-1.5 bg-indigo-50/90 border-l-2 border-indigo-500 rounded-r-xl text-[11px] text-indigo-900 italic flex items-start gap-1.5 shadow-2xs">
                  <Quote className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{msg.selectedText}</span>
                </div>
              )}

              {msg.role === 'user' && msg.hasImageCrop && (
                <div className="max-w-[85%] mb-1 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-800 flex items-center gap-1.5 shadow-2xs">
                  <ImageIcon className="w-3 h-3 text-indigo-600" />
                  <span>Riferimento all'area dell'immagine ritagliata</span>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`group relative max-w-[90%] p-3.5 rounded-2xl shadow-xs leading-relaxed text-xs ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-xs'
                    : 'bg-white text-gray-800 border border-gray-200/80 rounded-tl-xs'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div>
                    {msg.text ? (
                      <article className="prose prose-slate max-w-none text-xs leading-relaxed text-gray-800">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            h1: ({ node, ...props }) => (
                              <h1 className="text-sm font-bold text-gray-900 mt-2 mb-1.5 pb-1 border-b border-gray-100" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="text-xs font-bold text-gray-900 mt-2 mb-1" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3 className="text-xs font-semibold text-gray-800 mt-1.5 mb-0.5" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                              <p className="mb-2 last:mb-0" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="list-disc pl-4 space-y-0.5 mb-2" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol className="list-decimal pl-4 space-y-0.5 mb-2" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                              <li className="leading-relaxed" {...props} />
                            ),
                            blockquote: ({ node, ...props }) => (
                              <blockquote className="border-l-2 border-indigo-400 bg-indigo-50/50 pl-2 py-1 my-1.5 rounded-r text-gray-700 italic" {...props} />
                            ),
                            code: ({ node, inline, children, ...props }: any) => {
                              if (inline) {
                                return (
                                  <code className="px-1 py-0.2 rounded-sm bg-gray-100 text-indigo-600 font-mono text-[11px] font-semibold border border-gray-200" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <pre className="p-2.5 my-2 rounded-xl bg-gray-900 text-gray-100 overflow-x-auto font-mono text-[11px]">
                                  <code {...props}>{children}</code>
                                </pre>
                              );
                            },
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </article>
                    ) : (
                      /* Streaming animation */
                      <div className="flex items-center gap-1.5 py-1 text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse delay-100" />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse delay-200" />
                        <span className="text-[11px] text-gray-400 ml-1">L'assistente sta analizzando...</span>
                      </div>
                    )}

                    {/* Copy Button for Model messages */}
                    {msg.text && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleCopy(msg.text, idx)}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                          title="Copia spiegazione"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copiato!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copia</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-slide-up">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Errore</p>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input / Control Area */}
      <div className="p-3 bg-white border-t border-gray-200 flex flex-col gap-2 shrink-0">
        {/* Attached Selection or Crop pill */}
        {attachedSelection && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 animate-slide-up">
            <div className="flex items-center gap-1.5 truncate">
              <Quote className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="font-medium">Passaggio allegato:</span>
              <span className="truncate italic">"{attachedSelection}"</span>
            </div>
            <button
              onClick={() => setAttachedSelection(null)}
              className="p-0.5 hover:bg-indigo-100 rounded-md text-indigo-600 cursor-pointer shrink-0"
              title="Rimuovi passaggio"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {attachedImageCrop && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 animate-slide-up">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="font-medium">Ritaglio immagine allegato</span>
            </div>
            <button
              onClick={() => setAttachedImageCrop(null)}
              className="p-0.5 hover:bg-indigo-100 rounded-md text-indigo-600 cursor-pointer"
              title="Rimuovi ritaglio"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Input Textarea and Send button */}
        <div className="relative flex items-end bg-gray-50 border border-gray-300 rounded-2xl focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all p-1.5">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachedSelection
                ? 'Fai una domanda specifica su questo passaggio...'
                : attachedImageCrop
                ? 'Fai una domanda su questa porzione di immagine...'
                : 'Fai una domanda su questo appunto... (Invio per inviare)'
            }
            className="w-full px-2.5 py-1.5 bg-transparent resize-none outline-hidden text-xs text-gray-800 placeholder:text-gray-400"
          />

          <div className="flex items-center gap-1 shrink-0 pb-1 pr-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Interrompi generazione"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputQuestion.trim() && !attachedSelection && !attachedImageCrop}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Invia domanda"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 select-none">
          <span>Tasto Invio per inviare, Shift+Invio per a capo</span>
          <span>Google Gemini Flash</span>
        </div>
      </div>
    </aside>
  );
};
