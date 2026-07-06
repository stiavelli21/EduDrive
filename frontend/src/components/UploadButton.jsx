// =============================================================================
// EduDrive — Upload Button Component
// =============================================================================
// File upload with click-to-browse and drag-and-drop support.
// Sends multipart/form-data to POST /api/nodes/upload.
// =============================================================================

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api.js';

/**
 * @param {string|null} parentId - Current folder ID for upload context
 * @param {function} onUploadComplete - Called after successful upload
 */
export default function UploadButton({ parentId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success' | 'error' | null
  const fileInputRef = useRef(null);

  async function handleUpload(file) {
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (parentId) {
        formData.append('parentId', parentId);
      }

      await api.post('/nodes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadStatus('success');
      onUploadComplete();

      // Clear status after 2 seconds
      setTimeout(() => setUploadStatus(null), 2000);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus(null), 3000);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  return (
    <div
      className="relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.svg"
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) handleUpload(file);
          e.target.value = ''; // Reset for re-upload
        }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`btn-secondary flex items-center gap-2 transition-all ${
          dragOver ? 'border-brand-500 bg-brand-500/10 scale-105' : ''
        } ${uploadStatus === 'success' ? 'border-success text-success' : ''} ${
          uploadStatus === 'error' ? 'border-error text-error' : ''
        }`}
      >
        {uploading ? (
          <div className="w-4 h-4 border-2 border-text-muted/30 border-t-text-primary rounded-full animate-spin" />
        ) : uploadStatus === 'success' ? (
          <CheckCircle className="w-4 h-4" />
        ) : uploadStatus === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {uploading
          ? 'Caricamento...'
          : uploadStatus === 'success'
          ? 'Caricato!'
          : uploadStatus === 'error'
          ? 'Errore'
          : 'Carica'}
      </button>
    </div>
  );
}
