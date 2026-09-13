// T12-6 拆分（2026-09-12）：类型自 CommitteeListView.tsx 原样搬出。
import type { Dispatch, SetStateAction } from 'react';
import type { ClassCommittee, CommitteeTerm } from '../../types';
export interface CommitteeFormData {
  position: string;
  class_id: number;
  student_id: number;
  responsibilities: string;
  term_start: string;
  term_end: string;
}

export interface TermFormData {
  term_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface CommitteeListViewProps {
  committee: ClassCommittee[];
  isLoading: boolean;
  terms: CommitteeTerm[];
  termsLoading: boolean;
  termForm: TermFormData;
  formData: CommitteeFormData;
  showFormModal: boolean;
  showTermModal: boolean;
  editingId: number | null;
  filterClassId: number;
  isSubmitting: boolean;
  setFilterClassId: (id: number) => void;
  openCreateModal: () => void;
  openTermModal: () => void;
  openEditModal: (item: ClassCommittee) => void;
  handleSubmit: () => void;
  handleDelete: (id: number) => void;
  handleCreateTerm: () => void;
  setFormData: Dispatch<SetStateAction<CommitteeFormData>>;
  setTermForm: Dispatch<SetStateAction<TermFormData>>;
  setShowFormModal: (v: boolean) => void;
  setShowTermModal: (v: boolean) => void;
  runSubmit: (fn: () => Promise<unknown> | unknown) => Promise<void>;
  activeCount: number;
  ratedCount: number;
}
