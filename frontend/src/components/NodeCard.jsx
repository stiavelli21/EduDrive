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

import { useState } from 'react';
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
} from 'lucide-react';

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
    return {
      Icon: BookOpen,
      bgColor: 'bg-purple-500/15',
      iconColor: 'text-purple-400',
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
export default function NodeCard({ node, onClick, onDelete, onShare, onRename }) {
  const [showMenu, setShowMenu] = useState(false);
  const { Icon, bgColor, iconColor, fillClass } = getNodeVisuals(node);

  return (
    <div
      className="glass-card p-4 cursor-pointer group relative flex flex-col items-center text-center"
      onClick={onClick}
    >
      {/* Public indicator */}
      {node.isPublic && (
        <div className="absolute top-2 left-2" title="Pubblico">
          <Globe className="w-3.5 h-3.5 text-brand-600" />
        </div>
      )}

      {/* Context Menu Button */}
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-surface-300"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical className="w-4 h-4 text-text-muted" />
      </button>

      {/* Context Menu Dropdown */}
      {showMenu && (
        <div
          className="absolute top-9 right-2 bg-surface-200 border border-surface-400 rounded-lg shadow-xl z-20 py-1 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-300 hover:text-text-primary transition-colors"
            onClick={() => { onRename(); setShowMenu(false); }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Rinomina
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-300 hover:text-text-primary transition-colors"
            onClick={() => { onShare(); setShowMenu(false); }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Condividi
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
            onClick={() => { onDelete(); setShowMenu(false); }}
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

      {/* Metadata */}
      <p className="text-xs text-text-muted mt-1">
        {node.type === 'link' && '🔗 QuickLink'}
        {node.type === 'folder' && '📁 Cartella'}
        {node.type === 'file' && (
          node.name?.toLowerCase().endsWith('.md') || node.mimeType?.includes('markdown')
            ? `📖 Markdown · ${formatSize(node.sizeBytes)}`
            : formatSize(node.sizeBytes)
        )}
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
