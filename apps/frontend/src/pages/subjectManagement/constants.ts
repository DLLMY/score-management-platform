// T12-4 拆分（2026-09-12）：常量自 SubjectManagementSections.tsx 原样搬出。
import type { FormData } from './types';

export const defaultForm: FormData = {
  id: null,
  name: '',
  code: '',
  grade: '',
  description: '',
  color: '#10B981',
  is_active: true,
};

export const presetColors = [
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
  '#14B8A6',
  '#A855F7',
];
