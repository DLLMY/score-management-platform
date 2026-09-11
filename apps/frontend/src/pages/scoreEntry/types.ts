import type { Dispatch, SetStateAction } from 'react';
import type { ColumnType } from '../../components';
import type { User, Subject } from '../../types';
import type { LucideIcon } from 'lucide-react';

// 班级信息类型
export interface ClassInfo {
  id: number;
  name: string;
  description?: string;
}

// 考试类型
export interface Exam {
  id: number;
  name: string;
  exam_time?: string;
}

// 成绩项接口
export interface ScoreItem {
  id?: number;
  student_id: number;
  subject_id?: number;
  subject: string;
  score?: number | null;
  status?: 'pending' | 'confirmed' | 'locked';
}

// 考试数据接口
export interface ExamData extends Exam {
  subjects?: string | string[];
  status?: string;
  start_time?: string;
}

// 待保存更改接口
export interface PendingChange {
  student_id: number;
  subject: string;
  subject_id?: number;
  score: number;
}

// 成绩录入草稿（仅可序列化字段，用于 M3 本地暂存/恢复）
export interface ScoreEntryDraft {
  selectedExam: string;
  selectedClass: string;
  scores: Record<string, ScoreItem>;
  pendingChanges: Record<string, PendingChange>;
  batchSubject: string;
  filterSubject: string;
}

// 导入结果接口
export interface ImportResult {
  successCount: number;
  failedCount: number;
  failedMessages: string[];
  errors?: Array<{
    row?: number;
    error_fields: string[];
    message: string;
    row_data?: Record<string, unknown>;
  }>;
}

// 单元格位置接口
export interface CellPosition {
  studentId: number;
  subject: string;
}

export interface ScoreEntryState {
  exams: ExamData[];
  selectedExam: string;
  classes: ClassInfo[];
  selectedClass: string;
  students: User[];
  subjects: Subject[];
  scores: Record<string, ScoreItem>;
  loading: boolean;
  importFile: File | null;
  editingCell: CellPosition | null;
  filterSubject: string;
  statusFilter: string;
  batchSubject: string;
  importResult: ImportResult | null;
  pendingChanges: Record<string, PendingChange>;
}

export type ScoreEntryAction =
  | { type: 'SET_EXAMS'; payload: ExamData[] }
  | { type: 'SET_SELECTED_EXAM'; payload: string }
  | { type: 'SET_CLASSES'; payload: ClassInfo[] }
  | { type: 'SET_SELECTED_CLASS'; payload: string }
  | { type: 'SET_STUDENTS'; payload: User[] }
  | { type: 'SET_SUBJECTS'; payload: Subject[] }
  | { type: 'SET_SCORES'; payload: Record<string, ScoreItem> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_IMPORT_FILE'; payload: File | null }
  | { type: 'SET_EDITING_CELL'; payload: CellPosition | null }
  | { type: 'SET_FILTER_SUBJECT'; payload: string }
  | { type: 'SET_STATUS_FILTER'; payload: string }
  | { type: 'SET_BATCH_SUBJECT'; payload: string }
  | { type: 'SET_IMPORT_RESULT'; payload: ImportResult | null }
  | { type: 'SET_PENDING_CHANGES'; payload: Record<string, PendingChange> }
  | { type: 'UPDATE_SCORE'; payload: { key: string; score: ScoreItem } }
  | { type: 'ADD_PENDING_CHANGE'; payload: { key: string; change: PendingChange } }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'CLEAR_PENDING_CHANGES' };

export type BatchFailure = { key: string; error: string };

export interface ScoreEntryViewProps {
  state: ScoreEntryState;
  dispatch: Dispatch<ScoreEntryAction>;
  setClassInput: Dispatch<SetStateAction<string>>;
  columns: ColumnType<User>[];
  examSubjects: string[];
  visibleSubjects: string[];
  getEntryProgress: number;
  filteredStudents: User[];
  handleSaveAll: () => Promise<void>;
  handleExport: (format: 'excel' | 'csv') => Promise<Blob>;
  handleImport: () => Promise<void>;
  handleExportErrors: () => void;
  handleConfirmAll: () => Promise<void>;
  handleBatchDelete: () => Promise<void>;
  handleBatchReset: () => Promise<void>;
  handleBatchConfirm: () => Promise<void>;
  handlePrint: () => void;
  exportTemplate: () => Promise<void>;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  onRefresh: () => void;
  onCancelBatch: () => void;
  runSubmit: (fn: () => Promise<void>) => Promise<void>;
  submitting: boolean;
  draftAvailable: boolean;
  batchProgress: { processed: number; total: number } | null;
  batchFailures: BatchFailure[] | null;
  setBatchFailures: Dispatch<SetStateAction<BatchFailure[] | null>>;
  showImportModal: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;
  showBatchModal: boolean;
  openBatchModal: () => void;
  closeBatchModal: () => void;
  showImportResultModal: boolean;
  closeImportResultModal: () => void;
}

export type { LucideIcon };
