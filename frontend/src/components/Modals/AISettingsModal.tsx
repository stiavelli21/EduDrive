import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Trash2,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import {
  GetAISettings,
  SaveAISettings,
  ClearAIAPIKey,
  ListAIModels,
} from '../../../wailsjs/go/main/App';
import { AIModelInfoItem } from '../../types';

export interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('gemini-flash-latest');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [availableModels, setAvailableModels] = useState<AIModelInfoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load current settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoading(true);
    setFeedback(null);
    setApiKey('');
    setShowKey(false);

    GetAISettings()
      .then((settings) => {
        if (!active) return;
        setHasSavedKey(settings.hasApiKey);
        setMaskedKey(settings.maskedKey || '');
        if (settings.model) setModel(settings.model);
        setIsLoading(false);

        // If key already exists, optionally fetch available models in the background
        if (settings.hasApiKey) {
          ListAIModels('')
            .then((models) => {
              if (active && models && models.length > 0) {
                setAvailableModels(models);
              }
            })
            .catch(() => {
              // Silently ignore background model refresh
            });
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to get AI settings:', err);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  // Test connection & load model list
  const handleTestConnection = async () => {
    setFeedback(null);
    setIsTesting(true);

    try {
      // Use entered key or existing stored key
      const keyToTest = apiKey.trim();
      const models = await ListAIModels(keyToTest);
      if (models && models.length > 0) {
        setAvailableModels(models);
        setFeedback({
          type: 'success',
          message: `Connessione riuscita! ${models.length} modelli Gemini disponibili.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'Connessione con Gemini riuscita con successo.',
        });
      }
    } catch (err: any) {
      console.error('AI test failed:', err);
      setFeedback({
        type: 'error',
        message: err?.toString() || 'Errore nella verifica della chiave API.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save Settings
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      await SaveAISettings(apiKey.trim(), model.trim());
      setFeedback({
        type: 'success',
        message: 'Impostazioni dell\'assistente salvate con successo!',
      });
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to save AI settings:', err);
      setFeedback({
        type: 'error',
        message: err?.toString() || 'Impossibile salvare le impostazioni.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Clear stored key
  const handleClearKey = async () => {
    if (!window.confirm('Rimuovere la chiave API di Gemini salvata in locale?')) {
      return;
    }
    try {
      await ClearAIAPIKey();
      setHasSavedKey(false);
      setMaskedKey('');
      setApiKey('');
      setAvailableModels([]);
      setFeedback({
        type: 'success',
        message: 'Chiave API rimossa. L\'assistente e ora disattivato.',
      });
      if (onSettingsSaved) onSettingsSaved();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.toString() || 'Errore nella rimozione della chiave.',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Assistente IA per gli Appunti
              </h3>
              <p className="text-xs text-gray-500">
                Alimentato da Google Gemini
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Privacy Note */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-blue-900 leading-relaxed">
              <p className="font-semibold">Privacy e Sicurezza</p>
              <p className="text-[11px] text-blue-800">
                La tua chiave API e memorizzata esclusivamente sul tuo computer
                nel database SQLite locale di EduDrive. Il contenuto del documento
                viene trasmesso a Google solo quando fai una domanda all'assistente.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Caricamento impostazioni...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {/* API Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-gray-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Chiave API Google Gemini</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 text-[11px] hover:underline"
                    title="Ottieni una chiave gratuita su Google AI Studio"
                  >
                    <span>Ottieni chiave gratis</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      hasSavedKey
                        ? `Chiave salvata (${maskedKey}) - inseriscine una nuova per sostituirla`
                        : 'Incolla qui la tua API key (es. AIzaSy...)'
                    }
                    className="w-full pl-3 pr-20 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                  />
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200/60 cursor-pointer"
                      title={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
                    >
                      {showKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {hasSavedKey && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Rimuovi chiave salvata"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {hasSavedKey && !apiKey && (
                  <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Una chiave API e attualmente attiva e salvata in locale.</span>
                  </p>
                )}
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-gray-700 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Modello Gemini</span>
                </label>

                {availableModels.length > 0 ? (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer font-medium"
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName ? `${m.displayName} (${m.id})` : m.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gemini-flash-latest"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono"
                  />
                )}
                <p className="text-[11px] text-gray-500">
                  Default consigliato: <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">gemini-flash-latest</code> (veloce, multimodale, gratuito).
                </p>
              </div>

              {/* Test Button */}
              <div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || (!apiKey.trim() && !hasSavedKey)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>Testa connessione e carica modelli</span>
                </button>
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 animate-slide-up ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs leading-relaxed">{feedback.message}</span>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-gray-100 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving || (!hasSavedKey && !apiKey.trim())}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-40"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salva impostazioni</span>
          </button>
        </div>
      </div>
    </div>
  );
};
