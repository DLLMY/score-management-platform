import logger from '../../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 考试管理页面的逻辑层 hook（状态 / effect / handler / 列定义）。
 * 主文件退化为「hook → ExamManagementView」的薄装配。
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { StatusTag, useConfirm, type StatusTone, type ColumnType } from '../../components';
import api, { getAuthHeaders } from '../../services/api';
import type { Exam, ClassItem, Subject, ExamFormData, SubjectFormData } from './types';
import { buildExamColumns } from './columns';
import {
  useAutoSave,
  useClientFilter,
  useDebouncedValue,
  useForm,
  useModal,
  useStableToast,
  useSubmitGuard,
} from '../../hooks';

// M3: 考试表单默认值（用于草稿空值判定）
const DEFAULT_EXAM_FORM: ExamFormData = {
  name: '',
  description: '',
  subjects: ['语文', '数学', '英语'],
  start_time: '',
  end_time: '',
  importance: 'medium',
  class_id: '',
  status: 'draft',
};

/**
 * 考试管理页逻辑 hook。
 */
export function useExamManagementLogic() {
  const { showToast } = useStableToast();
  const { submitting: examSubmitting, run: runExamSubmit } = useSubmitGuard();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  // P1-1: 考试导入需指定目标考试（后端 /api/exam-import/execute 必填 exam_id）
  const [importExamId, setImportExamId] = useState<number>(0);

  // 使用 useDebouncedValue 优化搜索
  const debouncedSearchInput = useDebouncedValue(searchInput, 300);

  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // 使用 useForm 管理考试表单
  const {
    formData: examFormData,
    errors: examFormErrors,
    handleChange: handleExamFormChange,
    setFormData: setExamFormData,
    resetForm: resetExamForm,
  } = useForm<ExamFormData>(DEFAULT_EXAM_FORM, {
    name: { required: true, minLength: 1, maxLength: 100 },
  });

  // 使用 useForm 管理科目表单
  const {
    formData: subjectFormData,
    errors: subjectFormErrors,
    handleChange: handleSubjectFormChange,
    resetForm: resetSubjectForm,
  } = useForm<SubjectFormData>(
    {
      name: '',
      description: '',
      color: '#10B981',
    },
    {
      name: { required: true, minLength: 1, maxLength: 50 },
    }
  );

  // 使用 useModal 管理考试弹窗
  const {
    isOpen: showModal,
    open: openExamModal,
    close: closeExamModal,
  } = useModal<Exam | null>({
    onClose: () => {
      resetExamForm();
    },
  });

  // 使用 useModal 管理科目弹窗
  const {
    isOpen: showSubjectModal,
    open: openSubjectModal,
    close: closeSubjectModal,
  } = useModal<Subject | null>({
    onClose: () => {
      resetSubjectForm();
    },
  });

  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // M3: 考试新增/编辑表单草稿（含科目勾选），中途刷新可恢复
  const { draftAvailable, loadDraft, restoreDraft, discardChanges, clearDraft } =
    useAutoSave<ExamFormData>({
      key: 'exam-form',
      data: examFormData,
    });

  // 空草稿静默清理：默认值草稿（如取消后回写）不弹恢复条
  useEffect(() => {
    if (!draftAvailable) return;
    const d = loadDraft();
    if (d && JSON.stringify(d) === JSON.stringify(DEFAULT_EXAM_FORM)) {
      clearDraft();
    }
  }, [draftAvailable, loadDraft, clearDraft]);

  const handleRestoreDraft = useCallback((): void => {
    const draft = restoreDraft();
    if (!draft) return;
    setExamFormData({ ...draft });
    setEditingExam(null);
    openExamModal(null);
  }, [restoreDraft, setExamFormData, openExamModal]);

  const handleDiscardDraft = useCallback((): void => {
    discardChanges();
  }, [discardChanges]);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 使用 useMemo 优化过滤逻辑（经 useClientFilter 派生，predicate ref 持有）
  const filteredExams = useClientFilter(
    exams,
    (exam) => {
      const matchesSearch = exam.name?.toLowerCase().includes(debouncedSearchInput.toLowerCase());
      const matchesClass = !selectedClass || exam.class_id === parseInt(selectedClass);
      return matchesSearch && matchesClass;
    },
    [debouncedSearchInput, selectedClass]
  );

  // Import/Export handled by ImportExportPanel component

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [examsRes, classesRes, subjectsRes] = await Promise.all([
        api.exams.getAll({ skipCache: true }),
        api.classes.getAll(),
        api.subjects.getAll(),
      ]);

      setExams(
        Array.isArray(examsRes)
          ? (examsRes as unknown as Exam[])
          : (((examsRes as { data?: unknown[] })?.data || []) as unknown as Exam[])
      );
      setClasses(
        Array.isArray(classesRes)
          ? classesRes
          : (classesRes as { classes?: ClassItem[] })?.classes || []
      );
      setSubjects(Array.isArray(subjectsRes) ? subjectsRes : []);
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number): void => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number): void => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (index !== draggedIndex) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex]
  );

  const handleDragLeave = useCallback((): void => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetIndex: number): Promise<void> => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === targetIndex) {
        setDragOverIndex(null);
        setDraggedIndex(null);
        return;
      }

      const newSubjects = [...subjects];
      const draggedSubject = newSubjects[draggedIndex];
      newSubjects.splice(draggedIndex, 1);
      newSubjects.splice(targetIndex, 0, draggedSubject);

      setSubjects(newSubjects);

      try {
        const orderData = newSubjects.map((subject, idx) => ({
          id: subject.id,
          order: idx + 1,
        }));
        await api.subjects.updateOrder(orderData);
      } catch (err) {
        logger.error('更新科目顺序失败:', err);
        showToast('error', '科目顺序更新失败，请重试');
      }

      setDragOverIndex(null);
      setDraggedIndex(null);
    },
    [draggedIndex, subjects]
  );

  const handleCreateExam = useCallback((): void => {
    setEditingExam(null);
    resetExamForm();
    openExamModal(null);
  }, [resetExamForm, openExamModal]);

  const handleEditExam = useCallback(
    (exam: Exam): void => {
      setEditingExam(exam);
      setExamFormData({
        name: exam.name || '',
        description: exam.description || '',
        subjects: exam.subjects
          ? Array.isArray(exam.subjects)
            ? exam.subjects
            : exam.subjects.split(',').map((s: string) => s.trim())
          : [],
        start_time: exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '',
        end_time: exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '',
        importance: exam.importance || 'medium',
        class_id: exam.class_id ? String(exam.class_id) : '',
        status: exam.status || 'draft',
      });
      openExamModal(exam);
    },
    [setExamFormData, openExamModal]
  );

  const handleCreateSubject = useCallback((): void => {
    setEditingSubject(null);
    resetSubjectForm();
    openSubjectModal(null);
  }, [resetSubjectForm, openSubjectModal]);

  const handleSaveSubject = useCallback(async (): Promise<void> => {
    if (!subjectFormData.name) {
      showToast('error', '请输入科目名称');
      return;
    }

    try {
      if (editingSubject) {
        await api.subjects.update(editingSubject.id, subjectFormData);
        showToast('success', '科目更新成功');
      } else {
        await api.subjects.create(subjectFormData);
        showToast('success', '科目创建成功');
      }
      closeSubjectModal();
      fetchData();
    } catch (err: unknown) {
      showToast('error', '保存失败: ' + (err as Error).message);
    }
  }, [subjectFormData, editingSubject, showToast, fetchData, closeSubjectModal]);

  const handleDeleteSubject = useCallback(
    async (subject: Subject): Promise<void> => {
      const ok = await confirmRef.current({
        title: '删除科目',
        message: `确定要删除科目 ${subject.name} 吗？`,
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;

      try {
        await api.subjects.delete(subject.id);
        showToast('success', '科目删除成功');
        fetchData();
      } catch (err: unknown) {
        showToast('error', '删除失败: ' + (err as Error).message);
      }
    },
    [showToast, fetchData]
  );

  const handleExport = useCallback(async (format: 'excel' | 'csv'): Promise<Blob> => {
    const response = await fetch(`/api/exams/export?format=${format}`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('导出失败');
    }
    return response.blob();
  }, []);

  const handleImportComplete = useCallback(
    (result: { success: boolean }) => {
      if (result.success) {
        fetchData();
      }
    },
    [fetchData]
  );

  // P1-1: 考试导入走后端 /api/exam-import/execute（FormData: file + exam_id）
  const handleImportFile = useCallback(
    async (
      file: File
    ): Promise<{
      success: boolean;
      message: string;
      success_count?: number;
      failed_count?: number;
    }> => {
      if (!importExamId) {
        return { success: false, message: '请先在上方选择要导入成绩的考试' };
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('exam_id', String(importExamId));
      const response = await fetch('/api/exam-import/execute', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData,
      });
      const result = (await response.json()) as {
        success: boolean;
        message: string;
        success_count?: number;
        failed_count?: number;
      };
      if (!response.ok || result.success === false) {
        throw new Error(result.message || '导入失败');
      }
      return result;
    },
    [importExamId]
  );

  const handleSaveExam = useCallback(async (): Promise<void> => {
    if (!examFormData.name) {
      showToast('error', '请输入考试名称');
      return;
    }

    if (!examFormData.start_time || !examFormData.end_time) {
      showToast('error', '请选择开始和结束时间');
      return;
    }

    if (!examFormData.subjects || examFormData.subjects.length === 0) {
      showToast('error', '请至少选择一个科目');
      return;
    }

    // 边界：开始时间必须早于结束时间
    if (new Date(examFormData.start_time) >= new Date(examFormData.end_time)) {
      showToast('error', '结束时间必须晚于开始时间');
      return;
    }

    try {
      const data = {
        ...examFormData,
        subjects: examFormData.subjects,
        start_time: new Date(examFormData.start_time).toISOString(),
        end_time: new Date(examFormData.end_time).toISOString(),
        class_id: examFormData.class_id ? parseInt(examFormData.class_id) : undefined,
      };

      if (editingExam) {
        await api.exams.update(editingExam.id, data);
        showToast('success', '考试更新成功');
      } else {
        await api.exams.create(data);
        showToast('success', '考试创建成功');
      }

      clearDraft();
      closeExamModal();
      fetchData();
    } catch (err: unknown) {
      showToast('error', '保存失败: ' + (err as Error).message);
    }
  }, [examFormData, editingExam, showToast, fetchData, closeExamModal, clearDraft]);

  const handlePublishExam = useCallback(
    async (exam: Exam): Promise<void> => {
      const ok = await confirmRef.current({
        title: '发布考试',
        message: `确定要发布考试 ${exam.name} 吗？`,
        confirmText: '发布',
        cancelText: '取消',
        type: 'info',
      });
      if (!ok) return;

      try {
        await api.exams.publish(exam.id);
        showToast('success', '考试发布成功');
      } catch (err: unknown) {
        showToast('error', '发布失败: ' + (err as Error).message);
      } finally {
        fetchData();
      }
    },
    [showToast, fetchData]
  );

  const handleCloseExam = useCallback(
    async (exam: Exam): Promise<void> => {
      const ok = await confirmRef.current({
        title: '结束考试',
        message: `确定要结束考试 ${exam.name} 吗？`,
        confirmText: '结束',
        cancelText: '取消',
        type: 'warning',
      });
      if (!ok) return;

      try {
        await api.exams.close(exam.id);
        showToast('success', '考试已结束');
      } catch (err: unknown) {
        showToast('error', '操作失败: ' + (err as Error).message);
      } finally {
        fetchData();
      }
    },
    [showToast, fetchData]
  );

  const handleDeleteExam = useCallback(
    async (exam: Exam): Promise<void> => {
      const ok = await confirmRef.current({
        title: '删除考试',
        message: `确定要删除考试 ${exam.name} 吗？`,
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;

      try {
        await api.exams.delete(exam.id);
        showToast('success', '考试删除成功');
      } catch (err: unknown) {
        showToast('error', '删除失败: ' + (err as Error).message);
      } finally {
        fetchData();
      }
    },
    [showToast, fetchData]
  );

  const getStatusBadge = (status?: string): React.ReactElement => {
    const s = status || 'draft';
    const toneMap: Record<string, StatusTone> = {
      draft: 'neutral',
      published: 'success',
      closed: 'info',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      published: '已发布',
      closed: '已结束',
    };
    return <StatusTag tone={toneMap[s] ?? 'neutral'} label={labels[s] ?? s} />;
  };

  const getImportanceBadge = (importance?: string): React.ReactElement => {
    const styles: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[importance || 'medium']
        }`}
      >
        {labels[importance || 'medium'] || importance}
      </span>
    );
  };

  const columns = useMemo<ColumnType<Exam>[]>(
    () =>
      buildExamColumns({
        getStatusBadge,
        getImportanceBadge,
        handleEditExam,
        handlePublishExam,
        handleDeleteExam,
        handleCloseExam,
      }),
    [
      getStatusBadge,
      getImportanceBadge,
      handleEditExam,
      handlePublishExam,
      handleDeleteExam,
      handleCloseExam,
    ]
  );

  return {
    loading,
    draftAvailable,
    handleRestoreDraft,
    handleDiscardDraft,
    importExamId,
    setImportExamId,
    exams,
    handleExport,
    handleImportFile,
    handleImportComplete,
    handleCreateExam,
    searchInput,
    setSearchInput,
    selectedClass,
    setSelectedClass,
    classes,
    columns,
    filteredExams,
    showModal,
    closeExamModal,
    editingExam,
    examFormData,
    examFormErrors,
    handleExamFormChange,
    examSubmitting,
    handleSaveExam,
    runExamSubmit,
    subjects,
    handleCreateSubject,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    draggedIndex,
    dragOverIndex,
    handleDeleteSubject,
    showSubjectModal,
    closeSubjectModal,
    editingSubject,
    subjectFormData,
    subjectFormErrors,
    handleSubjectFormChange,
    handleSaveSubject,
  };
}
