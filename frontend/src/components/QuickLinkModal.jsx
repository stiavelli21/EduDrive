// =============================================================================
// EduDrive — QuickLink Modal Component ⭐
// =============================================================================

import { useState } from 'react';
import { ExternalLink, X, Link as LinkIcon } from 'lucide-react';
import api from '../services/api.js';

export default function QuickLinkModal({ parentId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Inserisci un URL valido (es. https://drive.google.com/...)');
      return;
    }

    setLoading(true);

    try {
      await api.post('/nodes/quicklink', {
        name: name.trim(),
        url: url.trim(),
        parentId,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Creazione del QuickLink non riuscita');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Aggiungi QuickLink
              </h2>
              <p className="text-xs text-text-muted">
                Salva un link esterno nel tuo drive
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="quicklink-name" className="block text-sm font-medium text-text-secondary mb-1.5">
              Titolo
            </label>
            <input
              id="quicklink-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Appunti di Fisica — Capitolo 3"
              required
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="quicklink-url" className="block text-sm font-medium text-text-secondary mb-1.5">
              URL
            </label>
            <input
              id="quicklink-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              required
              className="input-field"
            />
            <p className="text-xs text-text-muted mt-1.5">
              Google Drive, Dropbox, YouTube o qualsiasi link esterno
            </p>
          </div>

          {/* Preview */}
          {name && url && (
            <div className="p-3 rounded-lg bg-surface-200/50 border border-surface-300 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <ExternalLink className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {name}
                </p>
                <p className="text-xs text-text-muted truncate">{url}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  Salva QuickLink
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
