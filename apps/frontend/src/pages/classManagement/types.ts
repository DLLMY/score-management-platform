import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import type { ColumnType } from '../../components';
import type { FormErrors } from '../../hooks';
import type { ClassInfo } from '../../services/api';
import type { Admin } from '../../types';

export interface FormData {
  id: number | null;
  name: string;
  grade: string;
  description: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface TeacherPreview {
  teacher: Admin;
  classInfo: ClassInfo;
}

export interface ImportResult {
  success: boolean;
  total: number;
  success_count: number;
  failed_count: number;
  messages: Array<{
    name: string;
    action: string;
    message: string;
    row_data?: Record<string, unknown>;
    error_fields?: string[];
  }>;
}

export interface ClassManagementViewProps {
  // 搜索 / 导出 / 导入工具条
  searchInput: string;
  setSearchInput: (value: string) => void;
  handleExport: () => void;
  exportFormat: 'json' | 'excel';
  setExportFormat: Dispatch<SetStateAction<'json' | 'excel'>>;
  openImportModal: () => void;
  // 统计卡
  classTotal: number;
  totalStudents: number;
  classesWithTeacher: number;
  // 表格
  columns: ColumnType<ClassInfo>[];
  classItems: ClassInfo[];
  classLoading: boolean;
  page: number;
  pageSize: number;
  handlePageChange: (newPage: number, newPageSize: number) => void;
  handleOpenModal: (isEdit?: boolean, classData?: ClassInfo) => void;
  openHeadTeacherModal: (cls: ClassInfo) => void;
  handleDelete: (id: number) => void;
  // 班级表单模态
  showModal: boolean;
  formData: FormData;
  errors: FormErrors<FormData>;
  handleChangeEvent: <K extends keyof FormData>(
    field: K
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleChange: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  closeModal: () => void;
  validateAll: () => boolean;
  onSubmit: (data: FormData) => Promise<void>;
  // 班主任分配模态
  showHeadTeacherModal: boolean;
  selectedClass: ClassInfo | null;
  closeHeadTeacherModal: () => void;
  showRemoveConfirmDialog: () => void;
  searchTeacherTerm: string;
  setSearchTeacherTerm: (value: string) => void;
  filteredTeachers: Admin[];
  showTeacherPreviewDialog: (teacher: Admin) => void;
  // 教师预览确认对话框
  showTeacherPreview: boolean;
  teacherPreview: TeacherPreview | null;
  isLoading: boolean;
  closeTeacherPreview: () => void;
  confirmAssignHeadTeacher: () => Promise<void>;
  // 导入模态
  showImportModal: boolean;
  importConfigs: Array<{ id: number; config_name: string }>;
  selectedConfigId: number | null;
  setSelectedConfigId: (id: number | null) => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  importResult: ImportResult | null;
  handleExportErrors: () => void;
  isImporting: boolean;
  handleImport: () => Promise<void>;
  closeImportModal: () => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}
