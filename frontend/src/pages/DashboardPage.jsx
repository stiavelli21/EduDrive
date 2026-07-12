// =============================================================================
// EduDrive — Dashboard Page
// =============================================================================
// Main application page showing the file explorer with:
//   - Header with user info and logout
//   - Breadcrumb navigation
//   - Action bar (New Folder, Upload, QuickLink)
//   - File/Folder/QuickLink grid
//   - Modals for QuickLink creation and sharing
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import FileExplorer from '../components/FileExplorer.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import QuickLinkModal from '../components/QuickLinkModal.jsx';
import ShareModal from '../components/ShareModal.jsx';
import MarkdownViewerModal from '../components/MarkdownViewerModal.jsx';
import DownloadFormatModal from '../components/DownloadFormatModal.jsx';
import RenameModal from '../components/RenameModal.jsx';
import UploadButton from '../components/UploadButton.jsx';
import {
  LogOut,
  FolderPlus,
  Link as LinkIcon,
  GraduationCap,
  Share2,
  Users,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { folderId } = useParams();
  const navigate = useNavigate();

  // --- State -----------------------------------------------------------------
  const [nodes, setNodes] = useState([]);
  const [parentNode, setParentNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [activeTab, setActiveTab] = useState('my-files'); // 'my-files' | 'shared'

  // Modal states
  const [showQuickLinkModal, setShowQuickLinkModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetNode, setShareTargetNode] = useState(null);
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [markdownTargetNode, setMarkdownTargetNode] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetNode, setRenameTargetNode] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadTargetNode, setDownloadTargetNode] = useState(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // --- Data Fetching ---------------------------------------------------------

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'shared') {
        const { data } = await api.get('/nodes?shared=true');
        setNodes(data.nodes);
        setParentNode(null);
        setBreadcrumbs([]);
      } else if (folderId) {
        const { data } = await api.get(`/nodes/${folderId}/children`);
        setNodes(data.nodes);
        setParentNode(data.parent);
        // Use breadcrumbs computed server-side (single CTE query)
        setBreadcrumbs(data.breadcrumbs || []);
      } else {
        const { data } = await api.get('/nodes');
        setNodes(data.nodes);
        setParentNode(null);
        setBreadcrumbs([]);
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      setLoading(false);
    }
  }, [folderId, activeTab]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // --- Actions ---------------------------------------------------------------

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;

    try {
      await api.post('/nodes/folder', {
        name: newFolderName.trim(),
        parentId: folderId || null,
      });
      setNewFolderName('');
      setShowNewFolderInput(false);
      fetchNodes();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  }

  async function handleDelete(nodeId) {
    if (!window.confirm('Sei sicuro di voler eliminare questo elemento?')) return;

    try {
      await api.delete(`/nodes/${nodeId}`);
      fetchNodes();
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  }

  function handleNodeClick(node) {
    if (node.type === 'folder') {
      navigate(`/folder/${node.id}`);
    } else if (node.type === 'link') {
      // ⭐ QuickLink: open URL in external browser / new tab
      if (window.__TAURI_INTERNALS__) {
        import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(node.url)).catch(console.error);
      } else {
        window.open(node.url, '_blank', 'noopener,noreferrer');
      }
    } else if (node.type === 'file') {
      // ⭐ If it is a Markdown file (.md), open the built-in reader!
      if (node.name?.toLowerCase().endsWith('.md') || node.mimeType?.includes('markdown')) {
        setMarkdownTargetNode(node);
        setShowMarkdownModal(true);
        return;
      }

      // For other files, fetch download URL and open
      api
        .get(`/nodes/${node.id}`)
        .then(({ data }) => {
          if (data.node.downloadUrl) {
            if (window.__TAURI_INTERNALS__) {
              import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(data.node.downloadUrl)).catch(console.error);
            } else {
              window.open(data.node.downloadUrl, '_blank');
            }
          }
        })
        .catch(console.error);
    }
  }

  function handleShare(node) {
    setShareTargetNode(node);
    setShowShareModal(true);
  }

  function handleRename(node) {
    setRenameTargetNode(node);
    setShowRenameModal(true);
  }

  function handleDownload(node) {
    if (node.name?.toLowerCase().endsWith('.md') || node.mimeType?.includes('markdown')) {
      setDownloadTargetNode(node);
      setShowDownloadModal(true);
      return;
    }
    if (node.downloadUrl) {
      if (window.__TAURI_INTERNALS__) {
        import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(node.downloadUrl)).catch(console.error);
      } else {
        window.open(node.downloadUrl, '_blank');
      }
    }
  }

  // --- Render ----------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* ================================================================== */}
      {/* HEADER                                                              */}
      {/* ================================================================== */}
      <header className="border-b border-surface-300/50 bg-surface-50/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 flex items-center justify-center shadow-lg shadow-brand-600/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-text-primary">
              EduDrive
            </span>
          </div>

          {/* User info & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-text-primary">
                {user?.displayName}
              </p>
              <p className="text-xs text-text-muted">{user?.email}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-sm">
              {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <button onClick={logout} className="btn-ghost flex items-center gap-1.5" title="Esci">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MAIN CONTENT                                                        */}
      {/* ================================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Switcher */}
        <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
          <button
            onClick={() => { setActiveTab('my-files'); navigate('/'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'my-files'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
              : 'text-text-secondary hover:text-text-primary'
              }`}
          >
            I Miei File
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === 'shared'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
              : 'text-text-secondary hover:text-text-primary'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            Condivisi con me
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        {activeTab === 'my-files' && (
          <Breadcrumb crumbs={breadcrumbs} onNavigate={(id) => navigate(id ? `/folder/${id}` : '/')} />
        )}

        {/* Action Bar */}
        {activeTab === 'my-files' && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* New Folder */}
            {showNewFolderInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  placeholder="Nome cartella..."
                  autoFocus
                  className="input-field w-48"
                />
                <button onClick={handleCreateFolder} className="btn-primary text-sm py-2">
                  Crea
                </button>
                <button
                  onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                  className="btn-ghost text-sm"
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolderInput(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                Nuova Cartella
              </button>
            )}

            {/* Upload */}
            <UploadButton parentId={folderId || null} onUploadComplete={fetchNodes} />

            {/* ⭐ QuickLink Button */}
            <button
              onClick={() => setShowQuickLinkModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              Aggiungi QuickLink
            </button>
          </div>
        )}

        {/* File Explorer Grid */}
        <FileExplorer
          nodes={nodes}
          loading={loading}
          onNodeClick={handleNodeClick}
          onDelete={handleDelete}
          onShare={handleShare}
          onRename={handleRename}
          onDownload={handleDownload}
        />
      </main>

      {/* ================================================================== */}
      {/* MODALS                                                              */}
      {/* ================================================================== */}

      {/* QuickLink Modal */}
      {showQuickLinkModal && (
        <QuickLinkModal
          parentId={folderId || null}
          onClose={() => setShowQuickLinkModal(false)}
          onCreated={fetchNodes}
        />
      )}

      {/* Share Modal */}
      {showShareModal && shareTargetNode && (
        <ShareModal
          node={shareTargetNode}
          onClose={() => { setShowShareModal(false); setShareTargetNode(null); }}
        />
      )}

      {/* Built-in Markdown Reader Modal */}
      {showMarkdownModal && markdownTargetNode && (
        <MarkdownViewerModal
          node={markdownTargetNode}
          onClose={() => { setShowMarkdownModal(false); setMarkdownTargetNode(null); }}
        />
      )}

      {/* Rename Modal */}
      {showRenameModal && renameTargetNode && (
        <RenameModal
          node={renameTargetNode}
          onClose={() => { setShowRenameModal(false); setRenameTargetNode(null); }}
          onRenamed={fetchNodes}
        />
      )}

      {/* Download Format Modal ("Convertitore alla rovescia") */}
      {showDownloadModal && downloadTargetNode && (
        <DownloadFormatModal
          node={downloadTargetNode}
          onClose={() => { setShowDownloadModal(false); setDownloadTargetNode(null); }}
        />
      )}
    </div>
  );
}
