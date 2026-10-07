import { models } from '../../wailsjs/go/models';

export type DriveItem = models.Item;
export type BreadcrumbItem = models.Breadcrumb;
export type StorageStats = models.StorageStats;
export type ExamDateItem = models.ExamDate;
export type PassedExamItem = models.PassedExam;
export type AIChatMessageItem = models.AIChatMessage;
export type AIAskRequestItem = models.AIAskRequest;
export type AISettingsItem = models.AISettings;
export type AIModelInfoItem = models.AIModelInfo;
export type PodcastTurnItem = models.PodcastTurn;
export type PodcastEpisodeItem = models.PodcastEpisode;
export type PodcastGenerateRequestItem = models.PodcastGenerateRequest;

export interface StudyHandoutItem {
  id: string;
  title: string;
  topic: string;
  mode: string;
  detailLevel: string;
  sourceItemIds: string[];
  sourceItemNames: string[];
  contentMarkdown: string;
  driveItemId?: string;
  createdAt: any;
  updatedAt: any;
}

export type StudyHandoutGenerateRequestItem = models.StudyHandoutGenerateRequest;

export interface PodcastProgressEventItem {
  stage: string;
  percent: number;
  message: string;
  currentTurn: number;
  totalTurns: number;
  error?: string;
}

export interface StudyHandoutProgressEventItem {
  stage: string;
  percent: number;
  message: string;
  error?: string;
}

export type ViewMode = 'drive' | 'recent' | 'trash' | 'career' | 'podcast' | 'handouts';
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

export type SortField = 'name' | 'updatedAt' | 'size' | 'type';
export type SortDirection = 'asc' | 'desc';
export type TypeFilter = 'all' | 'documents' | 'images' | 'links' | 'markdown' | 'code';
