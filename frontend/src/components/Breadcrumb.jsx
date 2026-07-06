// =============================================================================
// EduDrive — Breadcrumb Navigation Component
// =============================================================================
// Shows the current path in the folder tree.
// Allows clicking on any ancestor to navigate up.
// =============================================================================

import { ChevronRight, Home } from 'lucide-react';

/**
 * @param {object[]} crumbs - Array of { id, name } for each folder in the path
 * @param {function} onNavigate - Called with folder ID (or null for root)
 */
export default function Breadcrumb({ crumbs, onNavigate }) {
  return (
    <nav className="flex items-center gap-1 mb-4 text-sm overflow-x-auto pb-1">
      {/* Home / Root */}
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-200 transition-colors shrink-0"
      >
        <Home className="w-4 h-4" />
        <span>Il Mio Drive</span>
      </button>

      {/* Path segments */}
      {crumbs.map((crumb, index) => (
        <div key={crumb.id} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="w-4 h-4 text-text-muted" />
          <button
            onClick={() => onNavigate(crumb.id)}
            className={`px-2 py-1 rounded-md transition-colors ${
              index === crumbs.length - 1
                ? 'text-text-primary font-medium bg-surface-200'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-200'
            }`}
          >
            {crumb.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
