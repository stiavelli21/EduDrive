import { models } from '../../wailsjs/go/models';

export type DriveItem = models.Item;
export type BreadcrumbItem = models.Breadcrumb;
export type StorageStats = models.StorageStats;
export type ExamDateItem = models.ExamDate;
export type PassedExamItem = models.PassedExam;

export type ViewMode = 'drive' | 'recent' | 'trash' | 'career';
export type LayoutMode = 'grid' | 'list';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  item: DriveItem | null;
}
