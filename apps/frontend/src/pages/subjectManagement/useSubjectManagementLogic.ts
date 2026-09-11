import logger from '../../utils/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api, { Subject, SubjectClassLink, ClassInfo, getAuthHeaders } from '../../services/api';
import {
  useStableToast,
  useSubmitGuard,
  usePermissions,
  useForm,
  useModal,
  useDebouncedValue,
} from '../../hooks';
import { useConfirm } from '../../components';
import {
  SubjectManagementViewProps,
  defaultForm,
  type FormData,
  type StatusFilter,
  type AdminUser,
} from './SubjectManagementSections';

/**
 * 科目管理逻辑层（列表/搜索/班级关联/教师/增删改/导入导出）
 *
 * 展示组件见 ./SubjectManagementSections 的 SubjectManagementView；页面装配层见 ../SubjectManagement。
 */
export function useSubjectManagementLogic(): SubjectManagementViewProps {
  const { submitting, run: runSubmit } = useSubmitGuard();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // 数据加载失败标记（科目/教师/班级/关联任一失败置位）
  const [loadError, setLoadError] = useState<boolean>(false);
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const {
    formData,
    errors,
    handleChange,
    handleChangeEvent,
    setFormData,
    resetForm,
    validateAll,
    setErrors,
  } = useForm<FormData>(defaultForm, {
    name: { required: true, minLength: 1, maxLength: 50 },
    code: { maxLength: 20 },
    grade: { maxLength: 20 },
    description: { maxLength: 200 },
  });

  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<Subject | null>({
    onClose: () => {
      resetForm();
      setErrors({});
    },
  });

  // 防抖搜索 - 延迟 300ms 更新搜索词
  const debouncedKeyword = useDebouncedValue(searchInput, 300);

  // 使用 useMemo 优化过滤逻辑
  const filteredSubjects = useMemo(() => {
    let filtered = subjects;

    if (statusFilter === 'active') {
      filtered = filtered.filter((s) => s.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((s) => !s.is_active);
    }

    if (debouncedKeyword) {
      const searchLower = debouncedKeyword.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          (s.code && s.code.toLowerCase().includes(searchLower)) ||
          (s.grade && s.grade.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [subjects, statusFilter, debouncedKeyword]);

  // Class link modal states
  const [showClassLinkModal, setShowClassLinkModal] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassLink[]>([]);
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number>(0);
  const [linkLoading, setLinkLoading] = useState<boolean>(false);

  // Edit teacher modal states
  const [editingTeacherSubjectId, setEditingTeacherSubjectId] = useState<number>(0);
  const [editingTeacherClassId, setEditingTeacherClassId] = useState<number>(0);
  const [editingTeacherLinkId, setEditingTeacherLinkId] = useState<number>(0);
  const [editingTeacherId, setEditingTeacherId] = useState<number>(0);

  // Import/Export handled by ImportExportPanel component

  usePermissions();

  const fetchSubjects = useCallback(
    // skipCache 默认 true：穿透前端缓存（cacheDB 持久化缓存曾残留已删除科目的"幽灵"项，
    // 页面加载 GET 命中旧缓存 → 列表显示已删科目 → 反复删反复 404）。
    // 性能兜底交给后端 cached_api 60s + skip_cache=true BYPASS。
    async (includeInactive = statusFilter !== 'active', skipCache = true) => {
      setIsLoading(true);
      try {
        const data = (await api.subjects.getAll({
          include_inactive: includeInactive,
          skipCache,
        })) as Subject[];
        const subjectArray = Array.isArray(data) ? data : [];
        setSubjects(subjectArray);
        setLoadError(false);
      } catch (error) {
        logger.error('获取科目列表失败:', error);
        setLoadError(true);
        showToastRef.current('error', '获取科目列表失败');
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleStatusFilterChange = useCallback((status: StatusFilter) => {
    setStatusFilter(status);
  }, []);

  const handleToggleStatus = useCallback(
    async (subject: Subject) => {
      try {
        const result = (await api.subjects.toggle(subject.id)) as Subject & { message: string };
        showToast('success', result.message);
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === subject.id
              ? { ...s, is_active: !s.is_active, class_count: result.class_count }
              : s
          )
        );
      } catch (error: unknown) {
        logger.error('切换状态失败:', error);
        showToast('error', (error as Error).message || '切换状态失败');
      }
    },
    [showToast]
  );

  const fetchTeachers = useCallback(async () => {
    try {
      const data = await api.admins.getAll();
      const rawList = Array.isArray(data) ? data : (data as { admins?: unknown[] }).admins || [];
      const adminList = rawList as AdminUser[];
      setTeachers(
        adminList
          .filter((a) => a.is_active !== false)
          .map((a) => ({
            id: a.id,
            real_name: a.real_name || a.username,
            username: a.username,
          }))
      );
      setLoadError(false);
    } catch (error) {
      logger.error('获取教师列表失败:', error);
      setLoadError(true);
    }
  }, []);

  const fetchAllClasses = useCallback(async () => {
    try {
      const data = await api.classes.getAll();
      const classList = (data as { classes?: ClassInfo[] }).classes || data || [];
      setAllClasses(Array.isArray(classList) ? classList : []);
      setLoadError(false);
    } catch (error) {
      logger.error('获取班级列表失败:', error);
      setLoadError(true);
    }
  }, []);

  const fetchSubjectClasses = useCallback(async (subjectId: number) => {
    try {
      const result = await api.subjects.getClasses(subjectId);
      setSubjectClasses(result.classes || []);
      setLoadError(false);
    } catch (error) {
      logger.error('获取科目关联班级失败:', error);
      setLoadError(true);
      setSubjectClasses([]);
    }
  }, []);

  const handleEditTeacher = useCallback(
    (link: SubjectClassLink) => {
      setEditingTeacherSubjectId(selectedSubject?.id || 0);
      setEditingTeacherClassId(link.class_info_id);
      setEditingTeacherLinkId(link.id);
      setEditingTeacherId(link.teacher_id || 0);
    },
    [selectedSubject]
  );

  const handleSaveTeacher = useCallback(async () => {
    if (!editingTeacherSubjectId || !editingTeacherClassId) return;
    try {
      await api.subjects.updateClassTeacher(editingTeacherSubjectId, editingTeacherClassId, {
        teacher_id: editingTeacherId || undefined,
      });
      showToast('success', '教师信息更新成功');
      setEditingTeacherSubjectId(0);
      setEditingTeacherClassId(0);
      setEditingTeacherLinkId(0);
      setEditingTeacherId(0);
      if (selectedSubject) {
        await fetchSubjectClasses(selectedSubject.id);
      }
    } catch (error: unknown) {
      logger.error('更新教师失败:', error);
      showToast('error', (error as Error).message || '更新教师失败');
    }
  }, [
    editingTeacherSubjectId,
    editingTeacherClassId,
    editingTeacherId,
    selectedSubject,
    showToast,
    fetchSubjectClasses,
  ]);

  const openClassLinkModal = useCallback(
    async (subject: Subject) => {
      setSelectedSubject(subject);
      setShowClassLinkModal(true);
      setSelectedClassId(0);
      setSelectedTeacherId(0);
      setLinkLoading(true);
      await Promise.all([fetchSubjectClasses(subject.id), fetchAllClasses(), fetchTeachers()]);
      setLinkLoading(false);
    },
    [fetchSubjectClasses, fetchAllClasses, fetchTeachers]
  );

  const closeClassLinkModal = useCallback(() => {
    setShowClassLinkModal(false);
    setSelectedSubject(null);
    setSubjectClasses([]);
    setSelectedClassId(0);
    setSelectedTeacherId(0);
  }, []);

  const closeEditTeacherModal = useCallback(() => {
    setEditingTeacherSubjectId(0);
    setEditingTeacherClassId(0);
    setEditingTeacherLinkId(0);
    setEditingTeacherId(0);
  }, []);

  const handleAssignClass = useCallback(async () => {
    if (!selectedSubject || !selectedClassId) {
      showToast('error', '请选择班级');
      return;
    }
    try {
      await api.subjects.assignClass(selectedSubject.id, {
        class_info_id: selectedClassId,
        teacher_id: selectedTeacherId || undefined,
      });
      showToast('success', '班级关联成功');
      setSelectedClassId(0);
      setSelectedTeacherId(0);
      await fetchSubjectClasses(selectedSubject.id);
      // 修复：skipCache=true 强制绕开后端 60s 缓存拿最新 class_count，
      // 否则 fetchSubjects 仍返回旧"0 班"（缓存未及时清或请求飞行中截图）
      await fetchSubjects(undefined, true);
    } catch (error: unknown) {
      logger.error('关联班级失败:', error);
      showToast('error', (error as Error).message || '关联班级失败');
    }
  }, [
    selectedSubject,
    selectedClassId,
    selectedTeacherId,
    showToast,
    fetchSubjectClasses,
    fetchSubjects,
  ]);

  const handleRemoveClass = useCallback(
    async (classInfoId: number) => {
      if (!selectedSubject) return;
      const ok = await confirmRef.current({
        message: '确定要移除该班级关联吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.subjects.removeClass(selectedSubject.id, classInfoId);
        showToast('success', '已移除班级关联');
        await fetchSubjectClasses(selectedSubject.id);
        // 修复：同关联——skipCache 绕缓存强制最新 class_count
        await fetchSubjects(undefined, true);
      } catch (error: unknown) {
        logger.error('移除关联失败:', error);
        showToast('error', (error as Error).message || '移除关联失败');
      }
    },
    [selectedSubject, showToast, fetchSubjectClasses, fetchSubjects]
  );

  const handleOpenModal = useCallback(
    (isEdit = false, subjectData?: Subject) => {
      if (isEdit && subjectData) {
        setFormData({
          id: subjectData.id,
          name: subjectData.name,
          code: subjectData.code || '',
          grade: subjectData.grade || '',
          description: subjectData.description || '',
          color: subjectData.color,
          is_active: subjectData.is_active,
        });
      } else {
        resetForm();
      }
      openModal(subjectData || null);
    },
    [setFormData, resetForm, openModal]
  );

  const handleCloseModal = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      try {
        if (data.id) {
          await api.subjects.update(data.id, {
            name: data.name,
            code: data.code || undefined,
            grade: data.grade || undefined,
            description: data.description,
            color: data.color,
          });
          showToast('success', '科目更新成功');
        } else {
          await api.subjects.create({
            name: data.name,
            code: data.code || undefined,
            grade: data.grade || undefined,
            description: data.description,
            color: data.color,
          });
          showToast('success', '科目创建成功');
        }
        closeModal();
        fetchSubjects();
      } catch (error) {
        logger.error('操作失败:', error);
        showToast('error', data.id ? '更新科目失败' : '创建科目失败');
      }
    },
    [showToast, closeModal, fetchSubjects]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个科目吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.subjects.delete(id);
        showToast('success', '科目删除成功');
        fetchSubjects(statusFilter !== 'active', true);
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', '删除科目失败');
      }
    },
    [showToast, fetchSubjects, statusFilter]
  );

  const handleExport = useCallback(
    async (format: 'excel' | 'csv'): Promise<Blob> => {
      const response = await fetch(
        `/api/subjects/export?include_inactive=${statusFilter !== 'active'}&format=${format}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) {
        throw new Error('导出失败');
      }
      return response.blob();
    },
    [statusFilter]
  );

  const handleImportComplete = useCallback(
    (result: { success: boolean }) => {
      if (result.success) {
        fetchSubjects();
      }
    },
    [fetchSubjects]
  );

  const handleReset = useCallback(() => {
    setSearchInput('');
    handleStatusFilterChange('all');
    fetchSubjects();
  }, [handleStatusFilterChange, fetchSubjects]);

  // Calculate statistics
  const totalSubjects = subjects.length;
  const activeSubjects = subjects.filter((s) => s.is_active).length;
  const totalClassCount = subjects.reduce((sum, s) => sum + (s.class_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）

  return {
    searchInput,
    setSearchInput,
    isLoading,
    statusFilter,
    handleStatusFilterChange,
    loadError,
    showModal,
    formData,
    errors,
    handleChange,
    handleChangeEvent,
    handleOpenModal,
    handleCloseModal,
    submitting,
    runSubmit,
    validateAll,
    onSubmit,
    showClassLinkModal,
    closeClassLinkModal,
    selectedSubject,
    subjectClasses,
    allClasses,
    teachers,
    selectedClassId,
    setSelectedClassId,
    selectedTeacherId,
    setSelectedTeacherId,
    linkLoading,
    handleAssignClass,
    handleEditTeacher,
    handleRemoveClass,
    editingTeacherLinkId,
    editingTeacherId,
    setEditingTeacherId,
    handleSaveTeacher,
    closeEditTeacherModal,
    filteredSubjects,
    totalSubjects,
    activeSubjects,
    totalClassCount,
    handleToggleStatus,
    handleDelete,
    openClassLinkModal,
    handleExport,
    handleImportComplete,
    handleReset,
    fetchSubjects,
  };
}
