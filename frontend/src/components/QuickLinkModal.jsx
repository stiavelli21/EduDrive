// =============================================================================
// EduDrive — QuickLink Modal Component ⭐
// =============================================================================
// This is the UI for the INNOVATIVE QuickLink feature.
//
// Instead of forcing users to create a text file with a link inside,
// this modal lets them save an external URL (e.g. Google Drive link)
// directly as a node in their file tree.
//
// The link is saved in the database as:
//   type: 'link'
//   url: <the external URL>
//   name: <user-provided title>
//
// In the file explorer, it appears with a 🔗 icon.
// Clicking it opens the URL in a new browser tab.
// =============================================================================

import { useState } from 'react';
import { ExternalLink, X, Link as LinkIcon } from 'lucide-react';
import api from '../services/api.js';

/**
 * @param {string|null} parentId - Current folder ID (null = root)
 * @param {function} onClose - Close the modal
 * @param {function} onCreated - Called after successful creation (to refresh list)
 */
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
      setError('Please enter a valid URL (e.g. https://drive.google.com/...)');
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
      setError(err.response?.data?.error || 'Failed to create QuickLink');
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
                Add QuickLink
              </h2>
              <p className="text-xs text-text-muted">
                Save an external link in your drive
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
              Title
            </label>
            <input
              id="quicklink-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Physics Notes — Chapter 3"
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
              Google Drive, Dropbox, YouTube, or any external link
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
              Cancel
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
                  Save QuickLink
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
