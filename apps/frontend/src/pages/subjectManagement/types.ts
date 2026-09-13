// T12-4 拆分（2026-09-12）：类型自 SubjectManagementSections.tsx 原样搬出。
import type { ChangeEvent } from 'react';
import type { FormErrors } from '../../hooks';
import type { Subject, SubjectClassLink, ClassInfo } from '../../services/api';

export interface FormData {
  id: number | null;
  name: string;
  code: string;
  grade: string;
  description: string;
  color: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface AdminUser {
  id: number;
  real_name: string;
  username: string;
  is_active?: boolean;
}

export type StatusFilter = 'all' | 'active' | 'inactive';

export interface SubjectManagementViewProps {
  searchInput: string;
  setSearchInput: (v: string) => void;
  isLoading: boolean;
  statusFilter: StatusFilter;
  handleStatusFilterChange: (status: StatusFilter) => void;
  loadError: boolean;
  showModal: boolean;
  formData: FormData;
  errors: FormErrors<FormData>;
  handleChange: (field: string, value: unknown) => void;
  handleChangeEvent: (
    field: string
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleOpenModal: (isEdit?: boolean, subjectData?: Subject) => void;
  handleCloseModal: () => void;
  submitting: boolean;
  runSubmit: (fn: () => Promise<void> | void) => void;
  validateAll: () => boolean;
  onSubmit: (data: FormData) => Promise<void>;
  showClassLinkModal: boolean;
  closeClassLinkModal: () => void;
  selectedSubject: Subject | null;
  subjectClasses: SubjectClassLink[];
  allClasses: ClassInfo[];
  teachers: AdminUser[];
  selectedClassId: number;
  setSelectedClassId: (v: number) => void;
  selectedTeacherId: number;
  setSelectedTeacherId: (v: number) => void;
  linkLoading: boolean;
  handleAssignClass: () => Promise<void>;
  handleEditTeacher: (link: SubjectClassLink) => void;
  handleRemoveClass: (classInfoId: number) => Promise<void>;
  editingTeacherLinkId: number;
  editingTeacherId: number;
  setEditingTeacherId: (v: number) => void;
  handleSaveTeacher: () => Promise<void>;
  closeEditTeacherModal: () => void;
  filteredSubjects: Subject[];
  totalSubjects: number;
  activeSubjects: number;
  totalClassCount: number;
  handleToggleStatus: (subject: Subject) => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  openClassLinkModal: (subject: Subject) => Promise<void>;
  handleExport: (format: 'excel' | 'csv') => Promise<Blob>;
  handleImportComplete: (result: { success: boolean }) => void;
  handleReset: () => void;
  fetchSubjects: (includeInactive?: boolean, skipCache?: boolean) => Promise<void>;
}
