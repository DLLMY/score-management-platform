import type { FormEvent } from 'react';
import type { Category } from '../../services/api';
import type { UseFormResult } from '../../hooks';

export interface FormData {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface FormErrors {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

export const COLORS: string[] = [
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export interface CategoryListViewProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isLoading: boolean;
  error: Error | null;
  fetchCategories: () => Promise<void>;
  filteredCategories: Category[];
  openModal: () => void;
  closeModal: () => void;
  editingCategory: Category | null;
  setEditingCategory: (category: Category | null) => void;
  setFormData: UseFormResult<FormData>['setFormData'];
  formData: FormData;
  formErrors: FormErrors;
  setFormErrors: (errors: FormErrors) => void;
  handleDelete: (id: number) => Promise<void>;
  runSubmit: (fn: () => Promise<unknown> | unknown) => Promise<void>;
  handleSubmit: (e?: FormEvent<HTMLFormElement>) => Promise<void>;
  submitting: boolean;
  showModal: boolean;
}
