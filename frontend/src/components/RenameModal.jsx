// =============================================================================
// EduDrive — Rename Modal Component ⭐
// =============================================================================
// Modale per la rinomina di file, cartelle e QuickLink.
// Funzionalità UX avanzate:
//   - Selezione intelligente del testo: per i file con estensione (.pdf, .md, ecc.)
//     seleziona solo il nome prima del punto all'apertura, evitando di far cancellare l'estensione.
//   - Riscontro visivo in tempo reale con l'icona del tipo di elemento.
//   - Gestione errori e caricamento con animazioni fluide.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { Pencil, Folder, FileText, Link as LinkIcon, X, Check, Palette, BookOpen } from 'lucide-react';
import api from '../services/api.js';
import { MARKDOWN_COLORS, getMarkdownColor } from '../utils/colors.js';

export default function RenameModal({ node, onClose, onRenamed }) {
  const [name, setName] = useState(node?.name || '');
  const [description, setDescription] = useState(node?.description || '');
  const [color, setColor] = useState(node?.color || 'purple');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const isMarkdown = node?.type === 'file' && (node.name?.toLowerCase().endsWith('.md') || node.mimeType?.includes('markdown'));

  // --- Smart Text Selection all'apertura ---
  useEffect(() => {
    if (inputRef.current && node?.name) {
      inputRef.current.focus();

      // Se è un file con estensione, seleziona solo la parte prima del punto (".")
      if (node.type === 'file') {
        const lastDotIdx = node.name.lastIndexOf('.');
        if (lastDotIdx > 0 && lastDotIdx < node.name.length - 1) {
          inputRef.current.setSelectionRange(0, lastDotIdx);
          return;
        }
      }

      // Altrimenti (cartella, link o file senza estensione) seleziona tutto il testo
      inputRef.current.select();
    }
  }, [node]);

  // Gestione chiusura con tasto ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    if (!trimmedName) {
      setError('Il nome non può essere vuoto');
      return;
    }

    const hasChanged =
      trimmedName !== node.name ||
      trimmedDesc !== (node.description || '') ||
      (isMarkdown && color !== (node.color || 'purple'));

    if (!hasChanged) {
      onClose();
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.put(`/nodes/${node.id}`, {
        name: trimmedName,
        description: trimmedDesc || null,
        color: isMarkdown ? color : undefined,
      });
      if (onRenamed) onRenamed();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Impossibile modificare l\'elemento');
    } finally {
      setLoading(false);
    }
  }

  // Scelta di icona e colore in base al tipo
  function getHeaderVisuals() {
    if (node?.type === 'folder') {
      return {
        Icon: Folder,
        bgColor: 'bg-amber-500/15',
        iconColor: 'text-amber-400',
        label: 'Cartella',
      };
    }
    if (node?.type === 'link') {
      return {
        Icon: LinkIcon,
        bgColor: 'bg-emerald-500/15',
        iconColor: 'text-emerald-400',
        label: 'QuickLink',
      };
    }
    if (isMarkdown) {
      const custom = getMarkdownColor(color);
      return {
        Icon: BookOpen,
        bgColor: custom.bg,
        iconColor: custom.text,
        label: 'Markdown',
      };
    }
    return {
      Icon: FileText,
      bgColor: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      label: 'File',
    };
  }

  const { Icon, bgColor, iconColor, label } = getHeaderVisuals();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}>
              <Pencil className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Modifica {label}
              </h2>
              <p className="text-xs text-text-muted truncate max-w-[200px]" title={node?.name}>
                Elemento: {node?.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm animate-fadeIn">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="rename-input" className="block text-sm font-medium text-text-secondary mb-1.5">
              Nuovo Nome
            </label>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                id="rename-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Inserisci il nuovo nome..."
                disabled={loading}
                required
                className="input-field pr-10"
              />
              <div className="absolute right-3 pointer-events-none text-text-muted">
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
          </div>

          {/* Campo Descrizione */}
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-text-secondary mb-1.5">
              Descrizione <span className="text-xs text-text-muted font-normal">(Opzionale)</span>
            </label>
            <textarea
              id="edit-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aggiungi una breve descrizione per riconoscere subito il contenuto..."
              disabled={loading}
              className="input-field resize-none text-sm"
            />
          </div>

          {/* Sezione Colore per file Markdown */}
          {isMarkdown && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-brand-500" />
                <span>Colore Tema Markdown</span>
              </label>
              <div className="flex flex-wrap gap-2.5">
                {MARKDOWN_COLORS.map((c) => {
                  const isSelected = color === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      disabled={loading}
                      title={c.label}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? `${c.bg} ${c.text} border-current ring-2 ${c.ring} font-semibold scale-105 shadow-sm`
                          : 'bg-surface-200 hover:bg-surface-300 text-text-secondary border-surface-300'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.bg} border ${c.border}`} style={{ backgroundColor: c.hex }} />
                      <span>{c.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Anteprima del cambiamento in tempo reale */}
          {(name.trim() !== node.name || description.trim() !== (node.description || '') || (isMarkdown && color !== (node.color || 'purple'))) && (
            <div className="p-3 rounded-xl bg-surface-200/60 border border-surface-300/80 flex items-center gap-3 transition-all animate-fadeIn">
              <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Anteprima Modifiche
                </p>
                <p className="text-sm font-semibold text-text-primary truncate">
                  {name.trim() || node.name}
                </p>
                {description.trim() && (
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {description.trim()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !name.trim() ||
                (name.trim() === node.name &&
                  description.trim() === (node.description || '') &&
                  (!isMarkdown || color === (node.color || 'purple')))
              }
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Conferma
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
