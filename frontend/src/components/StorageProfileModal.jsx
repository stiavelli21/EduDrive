// =============================================================================
// EduDrive — Storage & Profile Modal Component
// =============================================================================
// Visualizza i dettagli del profilo utente e lo stato di occupazione della
// memoria con barra progressiva colorata e calcolo del limite assegnato.
// Rispettoso della Zero Emoji Policy e del design system (index.css).
// =============================================================================

import { useState, useEffect } from 'react';
import { HardDrive, User, X, LogOut, Shield } from 'lucide-react';
import api from '../services/api.js';

export default function StorageProfileModal({ user, onClose, onLogout }) {
  const [usageData, setUsageData] = useState(user?.storageUsage || {
    usedBytes: 0,
    quotaBytes: 524288000,
    percentage: 0
  });
  const [loading, setLoading] = useState(false);

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
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
                Dettagli account e spazio archiviazione
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" title="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Card */}
        <div className="p-4 rounded-xl bg-surface-100 border border-surface-200 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="overflow-hidden flex-1">
            <h3 className="font-semibold text-text-primary truncate text-base">
              {user?.displayName}
            </h3>
            <p className="text-xs text-text-muted truncate">
              {user?.email}
            </p>
          </div>
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

        {/* Info Box */}
        <div className="mb-6 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Ogni utente dispone di una quota personalizzabile (predefinita a 500 MB) per garantire la massima stabilità e velocità di archiviazione dei documenti e QuickLink su EduDrive.
          </p>
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
