// =============================================================================
// EduDrive — Node Card Component
// =============================================================================
// Displays a single node (file, folder, or QuickLink) as a card.
// Each type has a distinct icon and color:
//   - Folder: amber/yellow folder icon
//   - File:   blue document icon (with type-specific sub-icons)
//   - Link:   green/teal link icon with external arrow
//
// Features:
//   - Hover effects with glassmorphism
//   - Context menu (share, delete)
//   - File size display
//   - Visual distinction for public nodes
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  Image,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  MoreVertical,
  Share2,
  Trash2,
  Globe,
  Pencil,
  BookOpen,
  Info,
  Download,
} from 'lucide-react';
import { getMarkdownColor } from '../utils/colors.js';

/**
 * Get the appropriate icon and color for a node based on its type and mime.
 */
function getNodeVisuals(node) {
  if (node.type === 'folder') {
    return {
      Icon: Folder,
      bgColor: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      fillClass: 'fill-amber-400/20',
    };
  }

  if (node.type === 'link') {
    return {
      Icon: ExternalLink,
      bgColor: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      fillClass: '',
    };
  }

  // File — choose icon based on MIME type
  const mime = node.mimeType || '';
  if (mime.includes('markdown') || node.name?.toLowerCase().endsWith('.md')) {
    const custom = getMarkdownColor(node.color);
    return {
      Icon: BookOpen,
      bgColor: custom.bg,
      iconColor: custom.text,
      fillClass: '',
    };
  }
  if (mime.startsWith('image/')) {
    return {
      Icon: Image,
      bgColor: 'bg-pink-500/15',
      iconColor: 'text-pink-400',
      fillClass: '',
    };
  }
  if (mime.includes('spreadsheet') || mime.includes('excel')) {
    return {
      Icon: FileSpreadsheet,
      bgColor: 'bg-green-500/15',
      iconColor: 'text-green-400',
      fillClass: '',
    };
  }
  if (mime.includes('presentation') || mime.includes('powerpoint')) {
    return {
      Icon: Presentation,
      bgColor: 'bg-orange-500/15',
      iconColor: 'text-orange-400',
      fillClass: '',
    };
  }

  // Default: document icon
  return {
    Icon: FileText,
    bgColor: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    fillClass: '',
  };
}

/**
 * Format file size to human-readable string.
 */
function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * @param {object} node - Node object from API
 * @param {function} onClick - Called when the card is clicked
 * @param {function} onDelete - Called when delete is selected
 * @param {function} onShare - Called when share is selected
 */
export default function NodeCard({ node, onClick, onDelete, onShare, onRename, onDownload }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const infoTimeoutRef = useRef(null);
  const { Icon, bgColor, iconColor, fillClass } = getNodeVisuals(node);

  const hasDescription = Boolean(node.description && node.description.trim());
  const hasSize = node.type === 'file' && node.sizeBytes !== undefined && node.sizeBytes !== null;
  const hasInfoContent = hasDescription || hasSize;

  function handleInfoMouseEnter() {
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    setShowInfo(true);
  }

  function handleInfoMouseLeave() {
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    infoTimeoutRef.current = setTimeout(() => {
      setShowInfo(false);
    }, 150);
  }

  useEffect(() => {
    if (!showMenu) return;

    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowMenu(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowMenu(false);
      }
    }

    function handleScroll() {
      setShowMenu(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showMenu]);

  return (
    <div
      className="glass-card p-4 cursor-pointer group relative flex flex-col items-center text-center"
      onClick={onClick}
    >
      {/* Top Left Icons: Public Indicator & Info Button */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20">
        {node.isPublic && (
          <div title="Pubblico">
            <Globe className="w-3.5 h-3.5 text-brand-600" />
          </div>
        )}
        {hasInfoContent && (
          <div
            className="relative"
            onMouseEnter={handleInfoMouseEnter}
            onMouseLeave={handleInfoMouseLeave}
          >
            <button
              type="button"
              className={`p-1 rounded-md transition-all ${showInfo || hasDescription ? 'opacity-100 text-brand-600 bg-surface-300/80' : 'opacity-0 group-hover:opacity-100 text-text-muted hover:bg-surface-300'
                }`}
              onClick={(e) => {
                e.stopPropagation();
                if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
                setShowInfo(!showInfo);
              }}
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Description Popover */}
            {showInfo && (
              <div
                className="absolute top-7 left-0 bg-surface-100/95 backdrop-blur-md border border-surface-300 rounded-xl p-3 shadow-2xl z-30 text-left w-[200px] max-w-[80vw] animate-fadeIn cursor-default pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={handleInfoMouseEnter}
                onMouseLeave={handleInfoMouseLeave}
              >
                {hasDescription && (
                  <>
                    <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      <Info className="w-3 h-3 text-brand-500" />
                      <span>Descrizione</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed break-words font-normal">
                      {node.description}
                    </p>
                  </>
                )}
                {hasSize && (
                  <div className={`${hasDescription ? 'mt-2 pt-2 border-t border-surface-300' : ''} flex items-center justify-between text-xs gap-2`}>
                    <span className="text-text-muted font-medium">Dimensione:</span>
                    <span className="text-text-primary font-semibold">{formatSize(node.sizeBytes)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu Button */}
      <button
        ref={buttonRef}
        className={`absolute top-2 right-2 p-1 rounded-md transition-all z-20 ${showMenu ? 'opacity-100 bg-surface-300' : 'opacity-0 group-hover:opacity-100 hover:bg-surface-300'
          }`}
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical className="w-4 h-4 text-text-muted" />
      </button>

      {/* Invisible backdrop to safely catch clicks outside the menu and prevent accidental card navigation */}
      {showMenu && (
        <div
          className="fixed inset-0 z-10 cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        />
      )}

      {/* Context Menu Dropdown */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-9 right-2 bg-surface-200 border border-surface-400 rounded-lg shadow-xl z-20 py-1 min-w-[140px] animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {node.type === 'file' && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-300 hover:text-text-primary transition-colors"
              onClick={() => { if (onDownload) onDownload(node); setShowMenu(false); }}
            >
              <Download className="w-3.5 h-3.5 text-brand-400" />
              Scarica
            </button>
          )}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-300 hover:text-text-primary transition-colors"
            onClick={() => { if (onRename) onRename(node); setShowMenu(false); }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifica
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-300 hover:text-text-primary transition-colors"
            onClick={() => { if (onShare) onShare(node); setShowMenu(false); }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Condividi
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
            onClick={() => { if (onDelete) onDelete(node.id); setShowMenu(false); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Elimina
          </button>
        </div>
      )}

      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
        <Icon className={`w-7 h-7 ${iconColor} ${fillClass}`} />
      </div>

      {/* Name */}
      <p className="text-sm font-medium text-text-primary truncate w-full" title={node.name}>
        {node.name}
      </p>



      {/* Permission level badge (for shared items) */}
      {node.permissionLevel && (
        <span className="mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-50 text-brand-700 border border-brand-200">
          {node.permissionLevel}
        </span>
      )}
    </div>
  );
}
