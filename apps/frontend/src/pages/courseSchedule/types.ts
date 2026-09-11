import type { RefObject, Dispatch, SetStateAction, FormEvent } from 'react';
import type { CourseSchedule, ClassPeriod, ClassInfo, Subject } from '../../services/api';
import type { ID } from '../../types';
import type { ColumnType } from '../../components';

export interface FormData {
  class_info_id: number;
  subject_id: number;
  day_of_week: number;
  period_number: number;
  teacher_id?: number;
  teacher_name: string;
  classroom: string;
  description: string;
  color: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface ConflictResult {
  has_conflict: boolean;
  conflicts: Array<{
    type: string;
    message: string;
    schedule_id?: number;
    conflicting_class_name?: string;
    conflicting_subject_name?: string;
    conflicting_teacher_name?: string;
    conflicting_classroom?: string;
  }>;
}

export interface WeekDay {
  day: number;
  label: string;
  shortLabel: string;
}

export interface ImportResult {
  success: boolean;
  total: number;
  success_count: number;
  failed_count: number;
  messages: Array<{
    class_name: string;
    subject_name: string;
    action: string;
    message: string;
    row_data?: Record<string, unknown>;
    error_fields?: string[];
  }>;
}

export type TeacherItem = { id: ID; name: string };

export interface CourseScheduleViewProps {
  schedulesError: boolean;
  exportFormat: 'json' | 'excel';
  setExportFormat: Dispatch<SetStateAction<'json' | 'excel'>>;
  exportSchedule: () => Promise<void> | void;
  handleAdd: (day?: number, period?: number) => void;
  openImportModalWithData: () => void;
  totalSchedules: number;
  uniqueSubjects: number;
  uniqueTeachers: number;
  classes: ClassInfo[];
  selectedClass: number;
  setSelectedClass: Dispatch<SetStateAction<number>>;
  showClassDropdown: boolean;
  setShowClassDropdown: Dispatch<SetStateAction<boolean>>;
  filteredSchedules: CourseSchedule[];
  columns: ColumnType<ClassPeriod>[];
  activePeriods: ClassPeriod[];
  isLoading: boolean;
  showModal: boolean;
  closeModal: () => void;
  editingSchedule: CourseSchedule | null;
  setEditingSchedule: Dispatch<SetStateAction<CourseSchedule | null>>;
  conflictResult: ConflictResult | null;
  setConflictResult: Dispatch<SetStateAction<ConflictResult | null>>;
  formData: FormData;
  handleFormChange: (
    field: keyof FormData,
    value: string | number | boolean | null | undefined
  ) => void;
  handleSubjectChange: (e: { target: { value: string } }) => void;
  subjects: Subject[];
  weekDays: WeekDay[];
  getPeriodTime: (periodNumber: number) => string;
  teachers: TeacherItem[];
  checkConflicts: () => Promise<ConflictResult | null>;
  submitting: boolean;
  handleSubmit: (e?: FormEvent) => Promise<void>;
  runSubmit: (fn: () => Promise<void>) => Promise<void>;
  showImportModal: boolean;
  closeImportModalWithReset: () => void;
  importConfigs: Array<{ id: number; config_name: string }>;
  selectedConfigId: number | null;
  setSelectedConfigId: Dispatch<SetStateAction<number | null>>;
  conflictStrategy: 'skip' | 'update' | 'error';
  setConflictStrategy: Dispatch<SetStateAction<'skip' | 'update' | 'error'>>;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (e: { target: { files: FileList | null } }) => void;
  importFile: File | null;
  setImportFile: Dispatch<SetStateAction<File | null>>;
  importResult: ImportResult | null;
  isImporting: boolean;
  handleImport: () => Promise<void> | void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}
