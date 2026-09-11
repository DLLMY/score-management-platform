import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import api, { ClassInfo, getAuthHeaders } from '../services/api';
import { useStableToast, useForm, useModal, useListFetch } from '../hooks';
import { useConfirm, type ColumnType } from '../components';
import { Admin } from '../types';
import type { FormData, TeacherPreview, ImportResult } from './classManagement/types';
import ClassManagementView from './classManagement/ClassManagementView';

const defaultForm: FormData = {
  id: null,
  name: '',
  grade: '',
  description: '',
  is_active: true,
};

function ClassManagementPage() {
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // 仅用于「分配/移除班主任」等 mutation 的按钮 busy 态；列表加载走 classList.loading
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const classList = useListFetch<ClassInfo>({
    fetcher: async (params) => {
      const data = await api.classes.getAll({
        page: params.page,
        per_page: params.pageSize,
        keyword: (params.keyword as string) || undefined,
        skipCache: params.skipCache,
      });
      return { items: data.classes || [], total: data.pagination?.total ?? 0 };
    },
    params: { page, pageSize, keyword: searchInput },
  });
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const [teachers, setTeachers] = useState<Admin[]>([]);
  const [searchTeacherTerm, setSearchTeacherTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  const [teacherPreview, setTeacherPreview] = useState<TeacherPreview | null>(null);

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

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importConfigs, setImportConfigs] = useState<Array<{ id: number; config_name: string }>>(
    []
  );
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handlePageChange = useCallback(
    (newPage: number, newPageSize: number) => {
      const totalPages = Math.max(1, Math.ceil(classList.total / newPageSize));
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(newPage);
        setPageSize(newPageSize);
      }
    },
    [classList.total]
  );

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
    [showToast, classList]
  );

  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('excel');
  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await api.classes.export(searchInput || undefined, exportFormat);
      showToast('success', '班级数据导出成功');
    } catch (e) {
      showToast('error', '导出失败: ' + ((e as Error).message || '未知错误'));
    } finally {
      setExporting(false);
    }
  }, [searchInput, exportFormat, showToast, exporting]);

  const openImportModal = useCallback(() => {
    setShowImportModal(true);
    setImportFile(null);
    setImportResult(null);
    setSelectedConfigId(null);
    api.importConfig
      .list({ module_name: 'classes' })
      .then((res) => {
        if (res) {
          setImportConfigs(res.map((c) => ({ id: c.id, config_name: c.config_name })));
        }
      })
      .catch((e) => {
        logger.error(e); // 主功能不受影响，仅记录日志
        showToast('error', '导入配置列表加载失败'); // M5: 加载失败提示
      }); // 配置列表加载失败静默（主功能不受影响），仅记录日志
  }, [showToast]);

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name.toLowerCase();
        if (
          !fileName.endsWith('.json') &&
          !fileName.endsWith('.xlsx') &&
          !fileName.endsWith('.xls')
        ) {
          showToast('error', '请选择 JSON 或 Excel 格式的文件');
          return;
        }
        setImportFile(file);
        setImportResult(null);
      }
    },
    [showToast]
  );

  const handleImport = useCallback(async () => {
    if (!importFile) {
      showToast('error', '请先选择文件');
      return;
    }

    setIsImporting(true);
    try {
      const isExcel =
        importFile.name.toLowerCase().endsWith('.xlsx') ||
        importFile.name.toLowerCase().endsWith('.xls');

      if (isExcel) {
        const formData = new FormData();
        formData.append('file', importFile);
        let url = '/api/classes/import';
        if (selectedConfigId) {
          url += `?config_id=${selectedConfigId}`;
        }
        const result = await api.classes.import(formData, url);
        setImportResult(result);

        if (result.success) {
          showToast(
            'success',
            `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          );
          setPage(1);
          await classList.refetch({ skipCache: true, params: { page: 1 } });
        } else {
          showToast('error', '导入失败');
        }
      } else {
        const fileContent = await importFile.text();
        const importData = JSON.parse(fileContent);
        let url = '/api/classes/import';
        if (selectedConfigId) {
          url += `?config_id=${selectedConfigId}`;
        }
        const result = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(importData),
        });
        const resultData = await result.json();
        setImportResult(resultData);

        if (resultData.success) {
          showToast(
            'success',
            `导入完成：成功 ${resultData.success_count} 条，失败 ${resultData.failed_count} 条`
          );
          classList.refetch({ skipCache: true, params: { page: 1 } });
          setPage(1);
        } else {
          showToast('error', '导入失败');
        }
      }
    } catch (error: unknown) {
      logger.error('导入失败:', error);
      showToast('error', '导入失败：' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, selectedConfigId, showToast, classList]);

  const handleExportErrors = useCallback((): void => {
    if (!importResult?.messages) return;
    const errors = importResult.messages
      .filter((msg) => msg.action === 'failed')
      .map((msg) => ({
        ...msg,
        error_fields: msg.error_fields || [],
      }));
    if (errors.length > 0) {
      api.export.errors(errors, 'classes');
    }
  }, [importResult]);

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
  }, [selectedClass, showToast, classList, lastOperation, closeHeadTeacherModal]);

  performRemoveHeadTeacherRef.current = performRemoveHeadTeacher;

  const filteredTeachers = useMemo((): Admin[] => {
    return teachers.filter(
      (teacher: Admin) =>
        teacher.username?.toLowerCase().includes(searchTeacherTerm.toLowerCase()) ||
        teacher.real_name?.toLowerCase().includes(searchTeacherTerm.toLowerCase())
    );
  }, [teachers, searchTeacherTerm]);

  const totalStudents = useMemo(() => {
    return classList.items.reduce((sum, cls) => sum + (cls.student_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）
  }, [classList.items]);

  const classesWithTeacher = useMemo(() => {
    return classList.items.filter((cls) => cls.head_teacher_id).length;
  }, [classList.items]);

  const columns = useMemo<ColumnType<ClassInfo>[]>(
    () => [
      {
        title: '班级名称',
        key: 'name',
        dataIndex: 'name',
        render: (_, cls) => (
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center'>
              <GraduationCap className='w-5 h-5 text-blue-600 dark:text-blue-400' />
            </div>
            <div>
              <p className='font-medium text-slate-800 dark:text-slate-200'>{cls.name}</p>
              {cls.description && (
                <p className='text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs'>
                  {cls.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        title: '年级',
        key: 'grade',
        dataIndex: 'grade',
        render: (_, cls) => (
          <span className='inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium'>
            {cls.grade || '-'}
          </span>
        ),
      },
      {
        title: '班主任',
        key: 'head_teacher_name',
        dataIndex: 'head_teacher_name',
        render: (_, cls) =>
          cls.head_teacher_name ? (
            <div className='flex items-center gap-2'>
              <div className='w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
                <span className='text-xs font-medium text-white'>
                  {cls.head_teacher_name.charAt(0)}
                </span>
              </div>
              <span className='text-sm text-slate-700 dark:text-slate-300'>
                {cls.head_teacher_name}
              </span>
            </div>
          ) : (
            <span className='text-sm text-slate-400 dark:text-slate-500'>未分配</span>
          ),
      },
      {
        title: '关联状态',
        key: 'head_teacher_id',
        dataIndex: 'head_teacher_id',
        align: 'center',
        render: (_, cls) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              cls.head_teacher_id
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                cls.head_teacher_id ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {cls.head_teacher_id ? '已关联' : '未关联'}
          </span>
        ),
      },
      {
        title: '学生数',
        key: 'student_count',
        dataIndex: 'student_count',
        align: 'center',
        render: (_, cls) => (
          <span className='inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold'>
            {cls.student_count != null ? cls.student_count : '--'}
          </span>
        ),
      },
      {
        title: '状态',
        key: 'is_active',
        dataIndex: 'is_active',
        align: 'center',
        render: (_, cls) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              cls.is_active
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                cls.is_active ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {cls.is_active ? '启用' : '禁用'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <ClassManagementView
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      handleExport={handleExport}
      exportFormat={exportFormat}
      setExportFormat={setExportFormat}
      openImportModal={openImportModal}
      classTotal={classList.total}
      totalStudents={totalStudents}
      classesWithTeacher={classesWithTeacher}
      columns={columns}
      classItems={classList.items}
      classLoading={classList.loading}
      page={page}
      pageSize={pageSize}
      handlePageChange={handlePageChange}
      handleOpenModal={handleOpenModal}
      openHeadTeacherModal={openHeadTeacherModal}
      handleDelete={handleDelete}
      showHeadTeacherModal={showHeadTeacherModal}
      showModal={showModal}
      formData={formData}
      errors={errors}
      handleChangeEvent={handleChangeEvent}
      handleChange={handleChange}
      closeModal={closeModal}
      validateAll={validateAll}
      onSubmit={onSubmit}
      selectedClass={selectedClass}
      closeHeadTeacherModal={closeHeadTeacherModal}
      showRemoveConfirmDialog={showRemoveConfirmDialog}
      searchTeacherTerm={searchTeacherTerm}
      setSearchTeacherTerm={setSearchTeacherTerm}
      filteredTeachers={filteredTeachers}
      showTeacherPreviewDialog={showTeacherPreviewDialog}
      showTeacherPreview={showTeacherPreview}
      teacherPreview={teacherPreview}
      isLoading={isLoading}
      closeTeacherPreview={closeTeacherPreview}
      confirmAssignHeadTeacher={confirmAssignHeadTeacher}
      showImportModal={showImportModal}
      importConfigs={importConfigs}
      selectedConfigId={selectedConfigId}
      setSelectedConfigId={setSelectedConfigId}
      importFile={importFile}
      setImportFile={setImportFile}
      fileInputRef={fileInputRef}
      handleFileChange={handleFileChange}
      importResult={importResult}
      handleExportErrors={handleExportErrors}
      isImporting={isImporting}
      handleImport={handleImport}
      closeImportModal={closeImportModal}
      showToast={showToast}
    />
  );
}

export default ClassManagementPage;
