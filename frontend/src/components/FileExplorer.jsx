// =============================================================================
// EduDrive — File Explorer Component
// =============================================================================
// Displays a responsive grid of NodeCards (files, folders, QuickLinks).
// Handles loading state with skeleton placeholders and empty state.
// =============================================================================

import NodeCard from './NodeCard.jsx';
import { FolderOpen } from 'lucide-react';

/**
 * @param {object[]} nodes - Array of node objects to display
 * @param {boolean} loading - Whether data is being fetched
 * @param {function} onNodeClick - Called when a node is clicked
 * @param {function} onDelete - Called when delete is requested
 * @param {function} onShare - Called when share is requested
 */
export default function FileExplorer({
  nodes,
  loading,
  onNodeClick,
  onDelete,
  onShare,
}) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card p-4 h-36 animate-shimmer" />
        ))}
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-200 flex items-center justify-center mb-4">
          <FolderOpen className="w-10 h-10 text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          No files yet
        </h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Create a folder, upload a file, or add a QuickLink to get started.
        </p>
      </div>
    );
  }

  // Grid of nodes
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          node={node}
          onClick={() => onNodeClick(node)}
          onDelete={() => onDelete(node.id)}
          onShare={() => onShare(node)}
        />
      ))}
    </div>
  );
}
