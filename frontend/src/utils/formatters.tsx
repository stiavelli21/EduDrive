import React from 'react';
import { DriveItem, SortField, SortDirection, TypeFilter } from '../types';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Code2,
  FileSpreadsheet,
  Presentation,
  FileQuestion,
  Globe,
  FileCheck,
  FileCode,
} from 'lucide-react';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString: any): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    // Check if today
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if this year
    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    }
    
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

export interface FileTypeInfo {
  icon: React.ReactNode;
  colorClass: string;
  badgeBg: string;
  label: string;
}

export function getFileTypeInfo(name: string, isFolder: boolean, mimeType?: string): FileTypeInfo {
  if (isFolder) {
    return {
      icon: <Folder className="w-5 h-5 fill-amber-400 text-amber-500" />,
      colorClass: 'text-amber-500',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Cartella',
    };
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  // Web Links
  if (mimeType === 'url' || ext === 'url') {
    return {
      icon: <Globe className="w-5 h-5 text-cyan-600" />,
      colorClass: 'text-cyan-600',
      badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      label: 'Collegamento Web',
    };
  }

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext) || mimeType?.startsWith('image/')) {
    return {
      icon: <ImageIcon className="w-5 h-5 text-purple-600" />,
      colorClass: 'text-purple-600',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      label: 'Immagine',
    };
  }

  // Videos
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext) || mimeType?.startsWith('video/')) {
    return {
      icon: <Film className="w-5 h-5 text-rose-600" />,
      colorClass: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'Video',
    };
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext) || mimeType?.startsWith('audio/')) {
    return {
      icon: <Music className="w-5 h-5 text-amber-600" />,
      colorClass: 'text-amber-600',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Audio',
    };
  }

  // PDF
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return {
      icon: <FileText className="w-5 h-5 text-red-600" />,
      colorClass: 'text-red-600',
      badgeBg: 'bg-red-50 text-red-700 border-red-200',
      label: 'Documento PDF',
    };
  }

  // Spreadsheets (Excel, CSV)
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
    return {
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
      colorClass: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Foglio di calcolo',
    };
  }

  // Presentations (PPT)
  if (['pptx', 'ppt', 'odp'].includes(ext)) {
    return {
      icon: <Presentation className="w-5 h-5 text-orange-600" />,
      colorClass: 'text-orange-600',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      label: 'Presentazione',
    };
  }

  // Markdown Documents
  if (['md', 'markdown'].includes(ext) || mimeType === 'text/markdown') {
    return {
      icon: <FileCode className="w-5 h-5 text-indigo-600" />,
      colorClass: 'text-indigo-600',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      label: 'Markdown',
    };
  }

  // Word Documents (.docx, .doc)
  if (['docx', 'doc'].includes(ext) || mimeType?.includes('word')) {
    return {
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      colorClass: 'text-blue-600',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      label: 'Documento Word',
    };
  }

  // Text Documents
  if (['odt', 'rtf', 'txt'].includes(ext) || mimeType === 'text/plain') {
    return {
      icon: <FileText className="w-5 h-5 text-slate-600" />,
      colorClass: 'text-slate-600',
      badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
      label: 'File di testo',
    };
  }

  // Archives (zip, rar, 7z)
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return {
      icon: <Archive className="w-5 h-5 text-yellow-600" />,
      colorClass: 'text-yellow-600',
      badgeBg: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      label: 'Archivio compresso',
    };
  }

  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'sql', 'sh'].includes(ext)) {
    return {
      icon: <Code2 className="w-5 h-5 text-indigo-600" />,
      colorClass: 'text-indigo-600',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      label: 'File sorgente',
    };
  }

  return {
    icon: <FileQuestion className="w-5 h-5 text-gray-500" />,
    colorClass: 'text-gray-500',
    badgeBg: 'bg-gray-100 text-gray-700 border-gray-200',
    label: 'File ' + ext.toUpperCase(),
  };
}

export interface ExamUrgencyInfo {
  daysRemaining: number;
  statusLabel: string;
  urgencyLevel: 'green' | 'yellow' | 'red';
  barColorClass: string;
  badgeClass: string;
  textClass: string;
}

export function getExamUrgencyInfo(examDateVal: any): ExamUrgencyInfo {
  const target = new Date(examDateVal);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining > 30) {
    return {
      daysRemaining,
      statusLabel: `+${daysRemaining} giorni`,
      urgencyLevel: 'green',
      barColorClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      textClass: 'text-emerald-600',
    };
  } else if (daysRemaining > 10) {
    return {
      daysRemaining,
      statusLabel: `${daysRemaining} giorni`,
      urgencyLevel: 'yellow',
      barColorClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      textClass: 'text-amber-600',
    };
  } else {
    let label = `${daysRemaining} giorni`;
    if (daysRemaining === 1) label = 'Domani!';
    else if (daysRemaining === 0) label = 'Oggi!';
    else if (daysRemaining < 0) label = `Scaduto (${Math.abs(daysRemaining)} gg fa)`;

    return {
      daysRemaining,
      statusLabel: label,
      urgencyLevel: 'red',
      barColorClass: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      textClass: 'text-rose-600',
    };
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isImageFile(itemOrName: DriveItem | string, mimeType?: string): boolean {
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const mime = typeof itemOrName === 'string' ? mimeType : (itemOrName.mimeType || mimeType);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff'].includes(ext) || (mime ? mime.startsWith('image/') : false);
}

export function isMarkdownFile(itemOrName: DriveItem | string, mimeType?: string): boolean {
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const mime = typeof itemOrName === 'string' ? mimeType : (itemOrName.mimeType || mimeType);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['md', 'markdown'].includes(ext) || mime === 'text/markdown';
}

export function isPdfFile(itemOrName: DriveItem | string, mimeType?: string): boolean {
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const mime = typeof itemOrName === 'string' ? mimeType : (itemOrName.mimeType || mimeType);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf' || mime === 'application/pdf';
}

export function isDocxFile(itemOrName: DriveItem | string, mimeType?: string): boolean {
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const mime = typeof itemOrName === 'string' ? mimeType : (itemOrName.mimeType || mimeType);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['docx', 'doc'].includes(ext) || (mime ? mime.includes('word') : false);
}

export function isCodeOrTextFile(itemOrName: DriveItem | string, mimeType?: string): boolean {
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const mime = typeof itemOrName === 'string' ? mimeType : (itemOrName.mimeType || mimeType);
  // If it's markdown, let markdown reader take priority
  if (isMarkdownFile(name, mime)) return false;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const codeExts = [
    'txt', 'json', 'csv', 'log', 'py', 'sql', 'java', 'c', 'cpp', 'h', 'hpp',
    'html', 'css', 'scss', 'js', 'ts', 'jsx', 'tsx', 'sh', 'bash', 'go', 'rs',
    'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'bat', 'cmd', 'ps1',
  ];
  return codeExts.includes(ext) || mime === 'text/plain' || mime === 'application/json';
}

export function filterAndSortItems(
  items: DriveItem[],
  filter: TypeFilter,
  sortField: SortField,
  sortDir: SortDirection
): DriveItem[] {
  let filtered = [...items];

  // Apply Type Filter
  if (filter !== 'all') {
    filtered = filtered.filter((item) => {
      // In folder navigation, keep folders or filter matching files
      if (item.isFolder) {
        return false; // When specific file type filter is chosen, show matching files
      }
      const ext = item.name.split('.').pop()?.toLowerCase() || '';
      switch (filter) {
        case 'documents':
          return (
            ['pdf', 'docx', 'doc', 'txt', 'rtf', 'odt', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext) ||
            item.mimeType?.includes('pdf') ||
            item.mimeType?.includes('word') ||
            item.mimeType === 'text/plain'
          );
        case 'images':
          return isImageFile(item.name, item.mimeType);
        case 'links':
          return item.mimeType === 'url' || ext === 'url';
        case 'markdown':
          return isMarkdownFile(item.name, item.mimeType);
        case 'code':
          return isCodeOrTextFile(item.name, item.mimeType);
        default:
          return true;
      }
    });
  }

  // Apply Sorting (folders always grouped at top unless sorting by size/date specifically)
  filtered.sort((a, b) => {
    // Keep folders first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;

    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        break;
      case 'updatedAt': {
        const timeA = new Date(a.updatedAt).getTime() || 0;
        const timeB = new Date(b.updatedAt).getTime() || 0;
        comparison = timeA - timeB;
        break;
      }
      case 'size': {
        const sizeA = a.sizeBytes || 0;
        const sizeB = b.sizeBytes || 0;
        comparison = sizeA - sizeB;
        break;
      }
      case 'type': {
        const extA = a.isFolder ? 'folder' : (a.name.split('.').pop()?.toLowerCase() || '');
        const extB = b.isFolder ? 'folder' : (b.name.split('.').pop()?.toLowerCase() || '');
        comparison = extA.localeCompare(extB);
        break;
      }
    }

    return sortDir === 'asc' ? comparison : -comparison;
  });

  return filtered;
}
