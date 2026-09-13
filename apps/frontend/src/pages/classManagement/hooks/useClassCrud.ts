// T12-3 拆分（2026-09-12）：自 pages/ClassManagement.tsx「班级 CRUD（表单模态）」域原样搬出，
// 行为逐字节等价。共享原语（showToast / confirmRef / classList）由组合根注入。
import { useCallback } from 'react';
import logger from '../../../utils/logger';
import api from '../../../services/api';
import type { ClassInfo } from '../../../services/api';
import { useForm, useModal, type UseListFetchResult } from '../../../hooks';
import type { ConfirmOptions } from '../../../components';
import type { FormData } from '../types';

type ShowToast = (
  type: 'success' | 'error' | 'info' | 'warning',
  message: string,
  options?: {
    undoAction?: () => void;
    undoLabel?: string;
    details?: string;
    errorFields?: string[];
  }
) => void;

interface UseClassCrudParams {
  showToast: ShowToast;
  confirmRef: { current: (options: ConfirmOptions) => Promise<boolean> };
  classList: UseListFetchResult<ClassInfo>;
}

const defaultForm: FormData = {
  id: null,
  name: '',
  grade: '',
  description: '',
  is_active: true,
};

/** 班级新增/编辑模态与删除（useForm + useModal） */
export function useClassCrud({ showToast, confirmRef, classList }: UseClassCrudParams) {
  const { formData, errors, handleChange, handleChangeEvent, setFormData, resetForm, validateAll } =
    useForm<FormData>(defaultForm, {
      name: { required: true, minLength: 1, maxLength: 50 },
      grade: { maxLength: 20 },
      description: { maxLength: 200 },
    });

  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<ClassInfo | null>({
    onClose: () => {
      resetForm();
    },
  });

  const handleOpenModal = useCallback(
    (isEdit = false, classData?: ClassInfo) => {
      if (isEdit && classData) {
        setFormData({
          id: classData.id,
          name: classData.name,
          grade: classData.grade || '',
          description: classData.description || '',
          is_active: classData.is_active ?? true,
        });
      } else {
        resetForm();
      }
      openModal(classData || null);
    },
    [setFormData, resetForm, openModal]
  );

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        if (data.id) {
          await api.classes.update(data.id, {
            name: data.name,
            grade: data.grade,
            description: data.description,
            is_active: data.is_active,
          });
          showToast('success', '班级更新成功');
        } else {
          await api.classes.create({
            name: data.name,
            grade: data.grade,
            description: data.description,
            is_active: data.is_active,
          });
          showToast('success', '班级创建成功');
        }
        closeModal();
        await classList.refetch({ skipCache: true });
      } catch (error) {
        logger.error('操作失败:', error);
        showToast('error', data.id ? '更新班级失败' : '创建班级失败');
      }
    },
    [showToast, closeModal, classList]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除这个班级吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.classes.delete(id);
        showToast('success', '班级删除成功');
        classList.refetch({ skipCache: true });
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', '删除班级失败');
      }
    },
    [showToast, classList, confirmRef]
  );

  return {
    showModal,
    formData,
    errors,
    handleChange,
    handleChangeEvent,
    closeModal,
    validateAll,
    onSubmit,
    handleOpenModal,
    handleDelete,
  };
}
