// =============================================================================
// EduDrive — Storage & Profile Modal Component
// =============================================================================
// Visualizza i dettagli del profilo utente e lo stato di occupazione della
// memoria con barra progressiva colorata e calcolo del limite assegnato.
// Consente di impostare e aggiornare il Nome Utente (username) e Nome Visualizzato.
// Rispettoso della Zero Emoji Policy e del design system (index.css).
// =============================================================================

import { useState, useEffect } from 'react';
import { HardDrive, User, X, LogOut, Edit2, Check, AlertCircle } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function StorageProfileModal({ user, onClose, onLogout }) {
  const { updateProfile } = useAuth();
  const [usageData, setUsageData] = useState(user?.storageUsage || {
    usedBytes: 0,
    quotaBytes: 524288000,
    percentage: 0
  });
  const [loading, setLoading] = useState(false);

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName || '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function fetchFreshUsage() {
      setLoading(true);
      try {
        const { data } = await api.get('/auth/storage-usage');
        if (isMounted && data) {
          setUsageData(data);
        }
      } catch (err) {
        console.error('Failed to fetch live storage usage:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchFreshUsage();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isEditing) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditing]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaveLoading(true);

    try {
      await updateProfile({
        username: usernameInput.trim() || null,
        displayName: displayNameInput.trim(),
      });
      setSaveSuccess('Profilo aggiornato con successo.');
      setIsEditing(false);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.response?.data?.error || 'Impossibile aggiornare il profilo.'
      );
    } finally {
      setSaveLoading(false);
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0.0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return (mb / 1024).toFixed(2) + ' GB';
    }
    if (mb < 0.1 && bytes > 0) {
      const kb = bytes / 1024;
      return kb.toFixed(1) + ' KB';
    }
    return mb.toFixed(2) + ' MB';
  }

  const usedFormatted = formatBytes(usageData.usedBytes);
  const quotaFormatted = formatBytes(usageData.quotaBytes);
  const pct = Math.min(100, Math.max(0, Number(usageData.percentage || 0)));

  let progressColorClass = 'bg-brand-600';
  if (pct >= 95) {
    progressColorClass = 'bg-red-500';
  } else if (pct >= 80) {
    progressColorClass = 'bg-amber-500';
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
              <User className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Profilo & Memoria
              </h2>
              <p className="text-xs text-text-muted">
                Gestione account e spazio archiviazione
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" title="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveSuccess && !isEditing && (
          <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {/* User Info & Edit Card */}
        <div className="p-4 rounded-xl bg-surface-100 border border-surface-200 mb-6">
          {!isEditing ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
                  {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-semibold text-text-primary truncate text-base">
                    {user?.displayName}
                  </h3>
                  <p className="text-xs font-medium text-brand-600 truncate">
                    {user?.username ? `@${user.username}` : 'Nessun nome utente impostato'}
                  </p>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsernameInput(user?.username || '');
                  setDisplayNameInput(user?.displayName || '');
                  setSaveError('');
                  setIsEditing(true);
                }}
                className="btn-ghost p-2 shrink-0 text-text-secondary hover:text-brand-600"
                title="Modifica Nome e Username"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center justify-between border-b border-surface-200 pb-2">
                <span className="text-sm font-semibold text-text-primary">Modifica Dati Profilo</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Annulla
                </button>
              </div>

              {saveError && (
                <div className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-error text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Nome Visualizzato
                </label>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Nome Cognome"
                  required
                  minLength={2}
                  className="input-field text-sm py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Nome Utente (Username)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-text-muted text-sm select-none">@</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="nome.cognome"
                    pattern="[a-zA-Z0-9._-]*"
                    title="Solo lettere, numeri, punti, trattini e underscore"
                    className="input-field text-sm py-2 pl-7"
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  Da 3 a 50 caratteri. Consentiti lettere, numeri, punti e underscore.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-ghost text-xs px-3 py-1.5"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                >
                  {saveLoading && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>Salva Profilo</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Storage Section */}
        <div className="mb-6 p-4 rounded-xl bg-surface-100 border border-surface-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-text-primary">
                Spazio Archiviazione
              </span>
            </div>
            {loading ? (
              <span className="text-xs text-text-muted animate-pulse">Aggiornamento...</span>
            ) : (
              <span className="text-xs font-bold text-text-primary">
                {pct}% utilizzato
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-surface-200 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${progressColorClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              <strong className="text-text-primary">{usedFormatted}</strong> di memoria usata
            </span>
            <span>
              Limite: <strong className="text-text-primary">{quotaFormatted}</strong>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-200">
          <button
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Esci dall'Account
          </button>
          <button onClick={onClose} className="btn-primary text-sm px-5 py-2">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
