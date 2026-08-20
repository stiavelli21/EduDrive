import React, { useState, useEffect, useRef } from 'react';
import { Globe, X, Link as LinkIcon } from 'lucide-react';

interface NewLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, url: string) => void;
}

export const NewLinkModal: React.FC<NewLinkModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setUrl('');
      setError('');
      setTimeout(() => {
        if (urlInputRef.current) {
          urlInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Inserisci un indirizzo URL valido.');
      return;
    }

    // Default name from hostname if name is left empty
    let finalName = name.trim();
    if (!finalName) {
      try {
        const parsed = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`);
        finalName = parsed.hostname.replace(/^www\./, '');
      } catch {
        finalName = trimmedUrl;
      }
    }

    onCreate(finalName, trimmedUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600">
              <Globe className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Nuovo collegamento web</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                Indirizzo Web (URL) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  ref={urlInputRef}
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="https://example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-hidden text-sm text-gray-900 transition-all font-mono placeholder:font-sans"
                />
              </div>
              {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                Titolo / Nome visualizzato (opzionale)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Portale Studenti o Documentazione"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-hidden text-sm text-gray-900 transition-all"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Se lasciato vuoto, verrà utilizzato automaticamente il nome del dominio.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors"
            >
              Crea collegamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
