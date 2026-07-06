// =============================================================================
// EduDrive — Share Modal Component
// =============================================================================
// Lets node owners manage sharing permissions:
//   - Add new users by email with viewer/editor role
//   - Toggle public/private visibility
//   - View and revoke existing permissions
// =============================================================================

import { useState, useEffect } from 'react';
import { X, UserPlus, Globe, Lock, Trash2 } from 'lucide-react';
import api from '../services/api.js';

/**
 * @param {object} node - The node being shared
 * @param {function} onClose - Close the modal
 */
export default function ShareModal({ node, onClose }) {
  const [permissions, setPermissions] = useState([]);
  const [isPublic, setIsPublic] = useState(node.isPublic);
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState('viewer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch existing permissions
  useEffect(() => {
    async function fetchPermissions() {
      try {
        const { data } = await api.get(`/permissions/node/${node.id}`);
        setPermissions(data.permissions);
        setIsPublic(data.node.isPublic);
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
      }
    }
    fetchPermissions();
  }, [node.id]);

  /**
   * Add a new permission (share with user by email).
   */
  async function handleShare(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await api.post(`/permissions/node/${node.id}`, {
        email: email.trim(),
        level,
      });
      setSuccess(data.message);
      setEmail('');

      // Refresh permissions list
      const { data: updated } = await api.get(`/permissions/node/${node.id}`);
      setPermissions(updated.permissions);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to share');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Toggle public/private visibility.
   */
  async function handleToggleVisibility() {
    try {
      const newValue = !isPublic;
      await api.put(`/permissions/node/${node.id}/visibility`, {
        isPublic: newValue,
      });
      setIsPublic(newValue);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update visibility');
    }
  }

  /**
   * Revoke a permission.
   */
  async function handleRevoke(permId) {
    try {
      await api.delete(`/permissions/${permId}`);
      setPermissions(permissions.filter((p) => p.id !== permId));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke permission');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Share "{node.name}"
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Manage who can access this {node.type}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visibility Toggle */}
        <button
          onClick={handleToggleVisibility}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all mb-5 ${
            isPublic
              ? 'border-brand-500/30 bg-brand-500/5'
              : 'border-surface-300 bg-surface-200/50'
          }`}
        >
          {isPublic ? (
            <Globe className="w-5 h-5 text-brand-400" />
          ) : (
            <Lock className="w-5 h-5 text-text-muted" />
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-text-primary">
              {isPublic ? 'Public — anyone can view' : 'Private — only shared users'}
            </p>
            <p className="text-xs text-text-muted">
              Click to {isPublic ? 'make private' : 'make public'}
            </p>
          </div>
        </button>

        {/* Add User Form */}
        <form onSubmit={handleShare} className="flex gap-2 mb-5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address..."
            required
            className="input-field flex-1"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="input-field w-28"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-1.5 shrink-0">
            <UserPlus className="w-4 h-4" />
            Share
          </button>
        </form>

        {/* Feedback Messages */}
        {error && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm mb-4">
            {success}
          </div>
        )}

        {/* Permissions List */}
        {permissions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">
              Shared with
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-200/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-300 text-xs font-semibold">
                      {perm.userDisplayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {perm.userDisplayName}
                      </p>
                      <p className="text-xs text-text-muted">{perm.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-300 text-text-secondary">
                      {perm.level}
                    </span>
                    <button
                      onClick={() => handleRevoke(perm.id)}
                      className="p-1 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
