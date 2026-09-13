// T12-3 拆分（2026-09-12）：自 pages/ClassManagement.tsx「班主任分配/移除」域原样搬出，
// 行为逐字节等价。共享原语（showToast / confirmRef / classList / setPage）由组合根注入。
// 注：handleImport/confirmAssign/performRemove 的 deps 增补了 setPage——React 保证
// setState 恒等，故运行时零变化，仅为满足 exhaustive-deps（原为 useState setter 免检）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';
import type { ClassInfo } from '../../../services/api';
import { useModal, type UseListFetchResult } from '../../../hooks';
import type { ConfirmOptions } from '../../../components';
import type { Admin } from '../../../types';
import type { TeacherPreview } from '../types';

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

interface UseClassHeadTeacherParams {
  showToast: ShowToast;
  confirmRef: { current: (options: ConfirmOptions) => Promise<boolean> };
  classList: UseListFetchResult<ClassInfo>;
  setPage: (value: number) => void;
}

/** 班主任分配/移除（教师列表、三重模态、可撤销操作） */
export function useClassHeadTeacher({
  showToast,
  confirmRef,
  classList,
  setPage,
}: UseClassHeadTeacherParams) {
  // 仅用于「分配/移除班主任」等 mutation 的按钮 busy 态；列表加载走 classList.loading
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [teachers, setTeachers] = useState<Admin[]>([]);
  const [searchTeacherTerm, setSearchTeacherTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  const [teacherPreview, setTeacherPreview] = useState<TeacherPreview | null>(null);

  const {
    isOpen: showHeadTeacherModal,
    open: openHeadTeacherModalInternal,
    close: closeHeadTeacherModal,
  } = useModal<ClassInfo | null>({
    onClose: () => {
      setTeacherPreview(null);
      setSelectedClass(null);
    },
  });

  const {
    isOpen: showTeacherPreview,
    open: openTeacherPreview,
    close: closeTeacherPreview,
  } = useModal<TeacherPreview | null>({
    onClose: () => {
      setTeacherPreview(null);
    },
  });

  const [lastOperation, setLastOperation] = useState<{
    type: 'assign' | 'remove';
    teacherId: number;
    classId: number;
    previousTeacherId?: number;
    previousTeacherName?: string;
  } | null>(null);

  const performRemoveHeadTeacherRef = useRef<(() => Promise<void>) | null>(null);

  const fetchTeachers = useCallback(async () => {
    try {
      const adminsData = await api.admins.getAll();
      const teachersList = Array.isArray(adminsData)
        ? adminsData.filter((a: Admin) => a.role === 'teacher')
        : ((adminsData as { admins?: Admin[] })?.admins || []).filter(
            (a: Admin) => a.role === 'teacher'
          );
      setTeachers(teachersList);
    } catch (error: unknown) {
      showToast('error', '获取教师列表失败: ' + (error as Error).message);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const openHeadTeacherModal = useCallback(
    (cls: ClassInfo) => {
      setSelectedClass(cls);
      openHeadTeacherModalInternal(cls);
    },
    [openHeadTeacherModalInternal]
  );

  const showTeacherPreviewDialog = useCallback(
    (teacher: Admin) => {
      if (!selectedClass) return;
      const previewData: TeacherPreview = { teacher, classInfo: selectedClass };
      setTeacherPreview(previewData);
      openTeacherPreview(previewData);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedClass, openTeacherPreview]
  );

  const confirmAssignHeadTeacher = useCallback(async () => {
    if (!teacherPreview) return;
    const { teacher, classInfo } = teacherPreview;
    setIsLoading(true);

    const previousTeacherId = classInfo.head_teacher_id;
    const previousTeacherName = classInfo.head_teacher_name;

    try {
      await api.adminClasses.assign(Number(teacher.id), classInfo.id, true);

      setLastOperation({
        type: 'assign',
        teacherId: Number(teacher.id),
        classId: classInfo.id,
        previousTeacherId: previousTeacherId || undefined,
        previousTeacherName: previousTeacherName || undefined,
      });

      // 修复：分配成功后刷新班级列表（skipCache 绕开后端 60s 缓存），
      // 否则前端 state 保持旧 head_teacher_id 显示"未分配"
      await classList.refetch({ skipCache: true });

      const undoAction = async () => {
        if (!lastOperation) return;
        try {
          if (lastOperation.previousTeacherId) {
            await api.adminClasses.assign(
              lastOperation.previousTeacherId,
              lastOperation.classId,
              true
            );
          } else {
            await api.adminClasses.remove(lastOperation.teacherId, lastOperation.classId);
          }
          showToast('success', '已撤销班主任分配');
          setPage(1);
          await classList.refetch({ skipCache: true, params: { page: 1 } });
          setLastOperation(null);
        } catch (error: unknown) {
          showToast('error', '撤销失败: ' + (error as Error).message);
        }
      };

      showToast(
        'success',
        `已将 ${teacher.real_name || teacher.username} 分配为 ${classInfo.name} 的班主任`,
        { undoAction, undoLabel: '撤销' }
      );

      closeTeacherPreview();
      closeHeadTeacherModal();
      setTeacherPreview(null);
      setSelectedClass(null);
      classList.refetch({ skipCache: true, params: { page: 1 } });
      setPage(1);
    } catch (error: unknown) {
      showToast('error', '班主任分配失败: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [
    teacherPreview,
    showToast,
    classList,
    lastOperation,
    closeTeacherPreview,
    closeHeadTeacherModal,
    setPage,
  ]);

  const showRemoveConfirmDialog = useCallback(async () => {
    if (!selectedClass || !selectedClass.head_teacher_id) return;

    const ok = await confirmRef.current({
      title: '移除班主任',
      message: `确定要从 ${selectedClass.name} 移除班主任 ${selectedClass.head_teacher_name} 吗？移除后该班级将暂时没有班主任。`,
      confirmText: '移除',
      type: 'danger',
    });
    if (!ok) return;

    performRemoveHeadTeacherRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  const performRemoveHeadTeacher = useCallback(async () => {
    if (!selectedClass || !selectedClass.head_teacher_id) return;
    setIsLoading(true);

    const previousTeacherId = selectedClass.head_teacher_id;
    const previousTeacherName = selectedClass.head_teacher_name;

    try {
      await api.adminClasses.remove(Number(selectedClass.head_teacher_id), selectedClass.id);

      setLastOperation({
        type: 'remove',
        teacherId: Number(previousTeacherId),
        classId: selectedClass.id,
        previousTeacherId: previousTeacherId || undefined,
        previousTeacherName: previousTeacherName || undefined,
      });

      // 修复：移除成功后刷新列表（同分配）
      await classList.refetch({ skipCache: true });

      const undoAction = async () => {
        if (!lastOperation) return;
        try {
          await api.adminClasses.assign(
            lastOperation.previousTeacherId!,
            lastOperation.classId,
            true
          );
          showToast('success', '已恢复班主任');
          classList.refetch({ skipCache: true, params: { page: 1 } });
          setPage(1);
          setLastOperation(null);
        } catch (error: unknown) {
          showToast('error', '撤销失败: ' + (error as Error).message);
        }
      };

      showToast('success', `已从 ${selectedClass.name} 移除班主任 ${previousTeacherName}`, {
        undoAction,
        undoLabel: '恢复',
      });

      closeHeadTeacherModal();
      setSelectedClass(null);
      classList.refetch({ skipCache: true, params: { page: 1 } });
      setPage(1);
    } catch (error: unknown) {
      showToast('error', '班主任移除失败: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, showToast, classList, lastOperation, closeHeadTeacherModal, setPage]);

  performRemoveHeadTeacherRef.current = performRemoveHeadTeacher;

  const filteredTeachers = useMemo((): Admin[] => {
    return teachers.filter(
      (teacher: Admin) =>
        teacher.username?.toLowerCase().includes(searchTeacherTerm.toLowerCase()) ||
        teacher.real_name?.toLowerCase().includes(searchTeacherTerm.toLowerCase())
    );
  }, [teachers, searchTeacherTerm]);

  return {
    isLoading,
    searchTeacherTerm,
    setSearchTeacherTerm,
    selectedClass,
    showHeadTeacherModal,
    openHeadTeacherModal,
    closeHeadTeacherModal,
    showRemoveConfirmDialog,
    filteredTeachers,
    showTeacherPreviewDialog,
    showTeacherPreview,
    teacherPreview,
    closeTeacherPreview,
    confirmAssignHeadTeacher,
  };
}
