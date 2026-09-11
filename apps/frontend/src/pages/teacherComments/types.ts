/**
 * 班主任评语页（TeacherComments）的类型契约。
 */

import type { Dispatch, SetStateAction } from 'react';
import type { ColumnType } from '../../components';
import type { TeacherComment } from '../../types';
import { useWorkbenchClass, useSubmitGuard } from '../../hooks';

export interface CommentFormData {
  student_id: number;
  term: string;
  comment_type: string;
  rating: number;
  content: string;
}

export const defaultForm: CommentFormData = {
  student_id: 0,
  term: '',
  comment_type: 'term',
  rating: 0,
  content: '',
};

export const COMMENT_TYPES = [
  { value: 'term', label: '学期评语' },
  { value: 'monthly', label: '月度评语' },
  { value: 'incident', label: '事件评语' },
  { value: 'other', label: '其他' },
];

/** 当前班级 state（来自 useWorkbenchClass） */
export type WorkbenchClassTuple = ReturnType<typeof useWorkbenchClass>;

/** 防重复提交 runner（来自 useSubmitGuard） */
export type SubmitRunner = ReturnType<typeof useSubmitGuard>['run'];

/**
 * 班主任评语页视图层（TeacherCommentsView）所需的全部 props。
 */
export interface TeacherCommentsViewProps {
  /** 评语表格列定义 */
  columns: ColumnType<TeacherComment>[];
  /** 服务端分页 */
  commentPage: number;
  setCommentPage: Dispatch<SetStateAction<number>>;
  commentTotal: number;
  /** 全量评语（当前页） */
  comments: TeacherComment[];
  /** 关键字过滤后的评语 */
  filteredComments: TeacherComment[];
  isLoading: boolean;
  /** 搜索 */
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  /** 当前班级 */
  filterClassId: WorkbenchClassTuple[0];
  setFilterClassId: WorkbenchClassTuple[1];
  /** 表单模态 */
  showModal: boolean;
  editingId: number | null;
  formData: CommentFormData;
  setFormData: Dispatch<SetStateAction<CommentFormData>>;
  errors: Partial<Record<keyof CommentFormData, string>>;
  isSubmitting: boolean;
  openCreateModal: () => void;
  openEditModal: (item: TeacherComment) => void;
  handleCloseModal: () => void;
  handleSubmit: () => Promise<void>;
  runSubmit: SubmitRunner;
  handleDelete: (id: number) => Promise<void>;
}
