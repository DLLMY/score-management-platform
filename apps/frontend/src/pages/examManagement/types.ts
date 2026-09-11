import type { DragEvent, Dispatch, SetStateAction } from 'react';
import type { ColumnType } from '../../components';
import type { FormErrors } from '../../hooks';

export interface Exam {
  id: number;
  name: string;
  description?: string;
  subjects: string[] | string;
  start_time?: string;
  end_time?: string;
  importance?: 'low' | 'medium' | 'high';
  class_id?: number;
  class_name?: string;
  status?: 'draft' | 'published' | 'closed';
}

export interface ClassItem {
  id: number;
  name: string;
}

export interface Subject {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

export interface ExamFormData {
  name: string;
  description: string;
  subjects: string[];
  start_time: string;
  end_time: string;
  importance: 'low' | 'medium' | 'high';
  class_id: string;
  status: 'draft' | 'published' | 'closed';
  [key: string]: unknown;
}

export interface SubjectFormData {
  name: string;
  description: string;
  color: string;
  [key: string]: unknown;
}

export interface ImportExamResult {
  success: boolean;
  message: string;
  success_count?: number;
  failed_count?: number;
}

export interface ExamManagementViewProps {
  // 草稿恢复条
  draftAvailable: boolean;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  // 头部导入目标选择 + 导入导出面板
  importExamId: number;
  setImportExamId: Dispatch<SetStateAction<number>>;
  exams: Exam[];
  handleExport: (format: 'excel' | 'csv') => Promise<Blob>;
  handleImportFile: (file: File) => Promise<ImportExamResult>;
  handleImportComplete: (result: { success: boolean }) => void;
  handleCreateExam: () => void;
  // 搜索/班级筛选
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
  selectedClass: string;
  setSelectedClass: Dispatch<SetStateAction<string>>;
  classes: ClassItem[];
  // 考试表格
  columns: ColumnType<Exam>[];
  filteredExams: Exam[];
  // 考试增改模态框
  showModal: boolean;
  closeExamModal: () => void;
  editingExam: Exam | null;
  examFormData: ExamFormData;
  examFormErrors: FormErrors<ExamFormData>;
  handleExamFormChange: <K extends keyof ExamFormData>(field: K, value: ExamFormData[K]) => void;
  examSubmitting: boolean;
  handleSaveExam: () => Promise<void>;
  runExamSubmit: (fn: () => Promise<void>) => Promise<void>;
  // 科目选择区（拖拽排序）
  subjects: Subject[];
  handleCreateSubject: () => void;
  handleDragStart: (e: DragEvent, index: number) => void;
  handleDragOver: (e: DragEvent, index: number) => void;
  handleDragLeave: () => void;
  handleDrop: (e: DragEvent, targetIndex: number) => Promise<void>;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  handleDeleteSubject: (subject: Subject) => Promise<void>;
  // 科目增改模态框
  showSubjectModal: boolean;
  closeSubjectModal: () => void;
  editingSubject: Subject | null;
  subjectFormData: SubjectFormData;
  subjectFormErrors: FormErrors<SubjectFormData>;
  handleSubjectFormChange: <K extends keyof SubjectFormData>(
    field: K,
    value: SubjectFormData[K]
  ) => void;
  handleSaveSubject: () => Promise<void>;
}
