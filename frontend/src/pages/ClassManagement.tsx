import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Edit2, Trash2, Building2, GraduationCap, Users, Search, ChevronLeft, ChevronRight, X, Check, UserCheck, BookOpen, Trash2 as RemoveIcon, UserPlus, AlertTriangle, Download, Upload, FileJson } from 'lucide-react';
import api, { ClassInfo, ClassListResponse, getAuthHeaders } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton, SearchFilter } from '../components';
import { useForm, useModal, useConfirmDialog } from '../hooks';
import { Admin } from '../types';

interface FormData {
  id: number | null;
  name: string;
  grade: string;
  description: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface TeacherPreview {
  teacher: Admin;
  classInfo: ClassInfo;
}

const defaultForm: FormData = {
  id: null,
  name: '',
  grade: '',
  description: '',
  is_active: true,
};

function ClassManagementPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 10, total: 0, pages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { showToast } = useStableToast();

  const [teachers, setTeachers] = useState<Admin[]>([]);
  const [searchTeacherTerm, setSearchTeacherTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);

  const [teacherPreview, setTeacherPreview] = useState<TeacherPreview | null>(null);

  const {
    formData,
    errors,
    handleChange,
    handleChangeEvent,
    setFormData,
    resetForm,
    validateAll,
  } = useForm<FormData>(defaultForm, {
    name: { required: true, minLength: 1, maxLength: 50 },
    grade: { maxLength: 20 },
    description: { maxLength: 200 },
  });

  const { isOpen: showModal, open: openModal, close: closeModal } = useModal<ClassInfo | null>({
    onClose: () => {
      resetForm();
    },
  });

  const { isOpen: showHeadTeacherModal, open: openHeadTeacherModalInternal, close: closeHeadTeacherModal } = useModal<ClassInfo | null>({
    onClose: () => {
      setTeacherPreview(null);
      setSelectedClass(null);
    },
  });

  const { isOpen: showTeacherPreview, open: openTeacherPreview, close: closeTeacherPreview } = useModal<TeacherPreview | null>({
    onClose: () => {
      setTeacherPreview(null);
    },
  });

  const { isOpen: confirmDialogOpen, confirm, cancel, options } = useConfirmDialog();

  const [lastOperation, setLastOperation] = useState<{
    type: 'assign' | 'remove';
    teacherId: number;
    classId: number;
    previousTeacherId?: number;
    previousTeacherName?: string;
  } | null>(null);

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    total: number;
    success_count: number;
    failed_count: number;
    messages: Array<{ name: string; action: string; message: string; row_data?: Record<string, unknown>; error_fields?: string[] }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importConfigs, setImportConfigs] = useState<Array<{ id: number; config_name: string }>>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const performRemoveHeadTeacherRef = useRef<(() => Promise<void>) | null>(null);

  const fetchClasses = useCallback(async (page = 1, searchKeyword = searchInput, skipCache = false) => {
    setIsLoading(true);
    try {
      const data: ClassListResponse = await api.classes.getAll({
        page,
        page_size: pagination.page_size,
        keyword: searchKeyword || undefined,
        skipCache
      });
      setClasses(data.classes || []);
      setPagination(data.pagination || { page: 1, page_size: 10, total: 0, pages: 1 });
    } catch (error) {
      logger.error('获取班级列表失败:', error);
      showToast('error', '获取班级列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [searchInput, pagination.page_size, showToast]);

  const fetchTeachers = useCallback(async () => {
    try {
      const adminsData = await api.admins.getAll();
      const teachersList = Array.isArray(adminsData)
        ? adminsData.filter((a: Admin) => a.role === 'teacher')
        : ((adminsData as { admins?: Admin[] })?.admins || []).filter((a: Admin) => a.role === 'teacher');
      setTeachers(teachersList);
    } catch (error: unknown) {
      showToast('error', '获取教师列表失败: ' + (error as Error).message);
    }
  }, [showToast]);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, [fetchClasses, fetchTeachers]);

  // 搜索词变化时自动触发搜索（SearchFilter组件自带防抖）
  useEffect(() => {
    fetchClasses(1, searchInput);
  }, [searchInput, fetchClasses]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchClasses(newPage, searchInput);
    }
  }, [fetchClasses, searchInput, pagination.pages]);

  const handleOpenModal = useCallback((isEdit = false, classData?: ClassInfo) => {
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
  }, [setFormData, resetForm, openModal]);

  const onSubmit = useCallback(async (data: FormData) => {
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
      fetchClasses(pagination.page, searchInput);
    } catch (error) {
      logger.error('操作失败:', error);
      showToast('error', data.id ? '更新班级失败' : '创建班级失败');
    }
  }, [showToast, closeModal, fetchClasses, pagination.page, searchInput]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('确定要删除这个班级吗？')) return;
    try {
      await api.classes.delete(id);
      showToast('success', '班级删除成功');
      fetchClasses(pagination.page, searchInput, true);
    } catch (error) {
      logger.error('删除失败:', error);
      showToast('error', '删除班级失败');
    }
  }, [showToast, fetchClasses, pagination.page, searchInput]);

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
    api.importConfig.list({ module_name: 'classes' }).then((res) => {
      if (res) {
        setImportConfigs(res.map(c => ({ id: c.id, config_name: c.config_name })));
      }
    }).catch((e) => logger.error(e)); // 配置列表加载失败静默（主功能不受影响），仅记录日志
  }, []);

  const closeImportModal = useCallback(() => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.json') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        showToast('error', '请选择 JSON 或 Excel 格式的文件');
        return;
      }
      setImportFile(file);
      setImportResult(null);
    }
  }, [showToast]);

  const handleImport = useCallback(async () => {
    if (!importFile) {
      showToast('error', '请先选择文件');
      return;
    }

    setIsImporting(true);
    try {
      const isExcel = importFile.name.toLowerCase().endsWith('.xlsx') || importFile.name.toLowerCase().endsWith('.xls');
      
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
          showToast('success', `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`);
          fetchClasses(1, searchInput, true);
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
          body: JSON.stringify(importData)
        });
        const resultData = await result.json();
        setImportResult(resultData);

        if (resultData.success) {
          showToast('success', `导入完成：成功 ${resultData.success_count} 条，失败 ${resultData.failed_count} 条`);
          fetchClasses(1, searchInput, true);
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
  }, [importFile, selectedConfigId, showToast, fetchClasses, searchInput]);

  const handleExportErrors = useCallback((): void => {
    if (!importResult?.messages) return;
    const errors = importResult.messages
      .filter(msg => msg.action === 'failed')
      .map(msg => ({
        ...msg,
        error_fields: msg.error_fields || [],
      }));
    if (errors.length > 0) {
      api.export.errors(errors, 'classes');
    }
  }, [importResult]);

  const openHeadTeacherModal = useCallback((cls: ClassInfo) => {
    setSelectedClass(cls);
    openHeadTeacherModalInternal(cls);
  }, [openHeadTeacherModalInternal]);

  const showTeacherPreviewDialog = useCallback((teacher: Admin) => {
    if (!selectedClass) return;
    const previewData: TeacherPreview = { teacher, classInfo: selectedClass };
    setTeacherPreview(previewData);
    openTeacherPreview(previewData);
  }, [selectedClass, openTeacherPreview]);

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

      const undoAction = async () => {
        if (!lastOperation) return;
        try {
          if (lastOperation.previousTeacherId) {
            await api.adminClasses.assign(lastOperation.previousTeacherId, lastOperation.classId, true);
          } else {
            await api.adminClasses.remove(lastOperation.teacherId, lastOperation.classId);
          }
          showToast('success', '已撤销班主任分配');
          fetchClasses(1, searchInput, true);
          setLastOperation(null);
        } catch (error: unknown) {
          showToast('error', '撤销失败: ' + (error as Error).message);
        }
      };

      showToast('success', `已将 ${teacher.real_name || teacher.username} 分配为 ${classInfo.name} 的班主任`, { undoAction, undoLabel: '撤销' });

      closeTeacherPreview();
      closeHeadTeacherModal();
      setTeacherPreview(null);
      setSelectedClass(null);
      fetchClasses(1, searchInput, true);
    } catch (error: unknown) {
      showToast('error', '班主任分配失败: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [teacherPreview, showToast, fetchClasses, searchInput, lastOperation, closeTeacherPreview, closeHeadTeacherModal]);

  const showRemoveConfirmDialog = useCallback(async () => {
    if (!selectedClass || !selectedClass.head_teacher_id) return;

    if (!window.confirm(`确定要从 ${selectedClass.name} 移除班主任 ${selectedClass.head_teacher_name} 吗？移除后该班级将暂时没有班主任。`)) return;

    performRemoveHeadTeacherRef.current?.();
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

      const undoAction = async () => {
        if (!lastOperation) return;
        try {
          await api.adminClasses.assign(lastOperation.previousTeacherId!, lastOperation.classId, true);
          showToast('success', '已恢复班主任');
          fetchClasses(1, searchInput, true);
          setLastOperation(null);
        } catch (error: unknown) {
          showToast('error', '撤销失败: ' + (error as Error).message);
        }
      };

      showToast('success', `已从 ${selectedClass.name} 移除班主任 ${previousTeacherName}`, { undoAction, undoLabel: '恢复' });

      cancel();
      closeHeadTeacherModal();
      setSelectedClass(null);
      fetchClasses(1, searchInput, true);
    } catch (error: unknown) {
      showToast('error', '班主任移除失败: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, showToast, fetchClasses, searchInput, lastOperation, cancel, closeHeadTeacherModal]);

  performRemoveHeadTeacherRef.current = performRemoveHeadTeacher;

  const filteredTeachers = useMemo((): Admin[] => {
    return teachers.filter(
      (teacher: Admin) =>
        teacher.username?.toLowerCase().includes(searchTeacherTerm.toLowerCase()) ||
        teacher.real_name?.toLowerCase().includes(searchTeacherTerm.toLowerCase())
    );
  }, [teachers, searchTeacherTerm]);

  const totalStudents = useMemo(() => {
    return classes.reduce((sum, cls) => sum + (cls.student_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）
  }, [classes]);

  const classesWithTeacher = useMemo(() => {
    return classes.filter(cls => cls.head_teacher_id).length;
  }, [classes]);

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {/* Header */}
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <Building2 className='w-6 h-6 text-white' />
              </div>
              <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
                <div className='w-2 h-2 bg-white rounded-full' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                班级管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>管理班级信息、班主任和学生</p>
            </div>
          </div>
          <PermissionButton
            permission='class.manage'
            onClick={() => handleOpenModal(false)}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            添加班级
          </PermissionButton>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <GraduationCap className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>班级总数</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{pagination.total}</p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
                <Users className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>学生总数</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{totalStudents}</p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20'>
                <UserCheck className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>已分配班主任</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{classesWithTeacher}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className='flex-1 px-6 pb-6'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          {/* Search Bar */}
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center gap-4'>
              <SearchFilter
                searchTerm={searchInput}
                onSearchChange={setSearchInput}
                placeholder='搜索班级名称、年级或描述...'
              />
              <PermissionButton
                permission='class.view'
                onClick={handleExport}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Download className='w-5 h-5' />
                导出班级
              </PermissionButton>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'json' | 'excel')}
                className='px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
              >
                <option value='excel'>Excel 格式</option>
                <option value='json'>JSON 格式</option>
              </select>
              <PermissionButton
                permission='class.manage'
                onClick={openImportModal}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Upload className='w-5 h-5' />
                导入班级
              </PermissionButton>
            </div>
          </div>

          {/* Table */}
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-700/30'>
                  <th className='px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>班级名称</th>
                  <th className='px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>年级</th>
                  <th className='px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>班主任</th>
                  <th className='px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>关联状态</th>
                  <th className='px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>学生数</th>
                  <th className='px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>状态</th>
                  <th className='px-5 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider'>操作</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100 dark:divide-slate-700/50'>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className='px-5 py-12 text-center'>
                      <div className='flex flex-col items-center gap-3'>
                        <div className='w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin' />
                        <p className='text-sm text-slate-500 dark:text-slate-400'>加载中...</p>
                      </div>
                    </td>
                  </tr>
                ) : classes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='px-5 py-16 text-center'>
                      <div className='flex flex-col items-center gap-3'>
                        <div className='w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center'>
                          <Building2 className='w-8 h-8 text-slate-400' />
                        </div>
                        <p className='text-slate-500 dark:text-slate-400'>暂无班级数据</p>
                        <PermissionButton
                          permission='class.manage'
                          onClick={() => handleOpenModal(false)}
                          className='text-blue-500 hover:text-blue-600 font-medium text-sm'
                        >
                          添加第一个班级
                        </PermissionButton>
                      </div>
                    </td>
                  </tr>
                ) : (
                  classes.map((cls, index) => (
                    <tr
                      key={cls.id}
                      className='group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-slate-700/50 dark:hover:to-slate-700/30 transition-all duration-200'
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className='px-5 py-4'>
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center'>
                            <GraduationCap className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                          </div>
                          <div>
                            <p className='font-medium text-slate-800 dark:text-slate-200'>{cls.name}</p>
                            {cls.description && (
                              <p className='text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs'>{cls.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className='px-5 py-4'>
                        <span className='inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium'>
                          {cls.grade || '-'}
                        </span>
                      </td>
                      <td className='px-5 py-4'>
                        {cls.head_teacher_name ? (
                          <div className='flex items-center gap-2'>
                            <div className='w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
                              <span className='text-xs font-medium text-white'>
                                {cls.head_teacher_name.charAt(0)}
                              </span>
                            </div>
                            <span className='text-sm text-slate-700 dark:text-slate-300'>{cls.head_teacher_name}</span>
                          </div>
                        ) : (
                          <span className='text-sm text-slate-400 dark:text-slate-500'>未分配</span>
                        )}
                      </td>
                      <td className='px-5 py-4 text-center'>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          cls.head_teacher_id
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            cls.head_teacher_id ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                          {cls.head_teacher_id ? '已关联' : '未关联'}
                        </span>
                      </td>
                      <td className='px-5 py-4 text-center'>
                        <span className='inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold'>
                          {cls.student_count != null ? cls.student_count : '--'}
                        </span>
                      </td>
                      <td className='px-5 py-4 text-center'>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          cls.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            cls.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                          {cls.is_active ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className='px-5 py-4'>
                        <div className='flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                          <PermissionButton
                            permission='class.manage'
                            onClick={() => openHeadTeacherModal(cls)}
                            className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
                          >
                            <UserPlus className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton
                            permission='class.manage'
                            onClick={() => handleOpenModal(true, cls)}
                            className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                          >
                            <Edit2 className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton
                            permission='class.delete'
                            onClick={() => handleDelete(cls.id)}
                            className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                          >
                            <Trash2 className='w-4 h-4' />
                          </PermissionButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className='px-5 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-slate-500 dark:text-slate-400'>
                  显示 {(pagination.page - 1) * pagination.page_size + 1} - {Math.min(pagination.page * pagination.page_size, pagination.total)} 条，共 {pagination.total} 条
                </p>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className='p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                  >
                    <ChevronLeft className='w-5 h-5' />
                  </button>
                  <div className='flex items-center gap-1'>
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            pagination.page === pageNum
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className='p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                  >
                    <ChevronRight className='w-5 h-5' />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={closeModal}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <BookOpen className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑班级' : '添加班级'}
                  </h3>
                </div>
                <button
                  onClick={closeModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  班级名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  name='name'
                  value={formData.name}
                  onChange={handleChangeEvent('name')}
                  placeholder='输入班级名称'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />
                {errors.name && (
                  <p className='mt-1 text-xs text-red-500'>{errors.name}</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  年级
                </label>
                <input
                  type='text'
                  name='grade'
                  value={formData.grade}
                  onChange={handleChangeEvent('grade')}
                  placeholder='输入年级（如：高一）'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.grade ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />
                {errors.grade && (
                  <p className='mt-1 text-xs text-red-500'>{errors.grade}</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  描述
                </label>
                <textarea
                  name='description'
                  value={formData.description}
                  onChange={handleChangeEvent('description')}
                  placeholder='输入班级描述'
                  rows={3}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.description ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />
                {errors.description && (
                  <p className='mt-1 text-xs text-red-500'>{errors.description}</p>
                )}
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                  启用状态
                </label>
                <button
                  onClick={() => handleChange('is_active', !formData.is_active)}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                    formData.is_active ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ${
                      formData.is_active ? 'left-7' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={closeModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const isValid = validateAll();
                  if (!isValid) return;
                  await onSubmit(formData);
                }}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium'
              >
                <Check className='w-5 h-5' />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Head Teacher Assignment Modal */}
      {showHeadTeacherModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={closeHeadTeacherModal}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                    <UserPlus className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    分配班主任 - {selectedClass?.name}
                  </h3>
                </div>
                <button
                  onClick={closeHeadTeacherModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5'>
              {selectedClass?.head_teacher_name && (
                <div className='mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
                        <span className='text-sm font-medium text-white'>
                          {selectedClass.head_teacher_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className='font-medium text-slate-900 dark:text-slate-100'>
                          当前班主任: {selectedClass.head_teacher_name}
                        </div>
                        <div className='text-sm text-slate-500 dark:text-slate-400'>
                          年级: {selectedClass.grade}
                        </div>
                      </div>
                    </div>
                    <PermissionButton
                      permission='class.manage'
                      onClick={showRemoveConfirmDialog}
                      className='flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-xl transition-all font-medium text-sm'
                    >
                      <RemoveIcon className='w-4 h-4' />
                      移除
                    </PermissionButton>
                  </div>
                </div>
              )}

              <div>
                <h3 className='text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center'>
                  <UserCheck className='w-5 h-5 mr-2 text-amber-500' />
                  选择教师
                </h3>
                <div className='relative mb-4'>
                  <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
                  <input
                    type='text'
                    value={searchTeacherTerm}
                    onChange={(e) => setSearchTeacherTerm(e.target.value)}
                    placeholder='搜索教师姓名或用户名...'
                    className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-sm'
                  />
                </div>

                {filteredTeachers.length === 0 ? (
                  <div className='text-center py-8 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                    <div className='w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-200 dark:bg-slate-600 flex items-center justify-center'>
                      <Users className='w-6 h-6 text-slate-400' />
                    </div>
                    <p className='text-slate-500 dark:text-slate-400'>暂无教师数据</p>
                  </div>
                ) : (
                  <div className='space-y-2 max-h-[40vh] overflow-y-auto'>
                    {filteredTeachers.map((teacher) => (
                      <PermissionButton
                        key={teacher.id}
                        permission='class.manage'
                        onClick={() => showTeacherPreviewDialog(teacher)}
                        className='w-full flex items-center justify-between p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left group'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                            <GraduationCap className='w-5 h-5 text-amber-600 dark:text-amber-400' />
                          </div>
                          <div>
                            <div className='font-medium text-slate-900 dark:text-slate-100'>
                              {teacher.real_name || teacher.username}
                            </div>
                            <div className='text-sm text-slate-500 dark:text-slate-400'>
                              @{teacher.username} | {teacher.phone || '暂无电话'}
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <span className='text-xs text-slate-500 dark:text-slate-400'>
                            管理{teacher.class_count != null ? teacher.class_count : '--'}个班级
                          </span>
                          <UserPlus className='w-5 h-5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity' />
                        </div>
                      </PermissionButton>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 flex items-center justify-end'>
              <button
                onClick={closeHeadTeacherModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Preview Dialog */}
      {showTeacherPreview && teacherPreview && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4' onClick={closeTeacherPreview}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                    <UserCheck className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    确认分配班主任
                  </h3>
                </div>
                <button
                  onClick={closeTeacherPreview}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-6'>
              {/* Preview Content */}
              <div className='space-y-4'>
                <div className='p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                  <div className='flex items-center gap-4'>
                    <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center'>
                      <GraduationCap className='w-7 h-7 text-emerald-600 dark:text-emerald-400' />
                    </div>
                    <div className='flex-1'>
                      <p className='font-semibold text-slate-900 dark:text-slate-100'>
                        {teacherPreview.teacher.real_name || teacherPreview.teacher.username}
                      </p>
                      <p className='text-sm text-slate-500 dark:text-slate-400'>
                        @{teacherPreview.teacher.username}
                      </p>
                    </div>
                  </div>
                </div>

                <div className='flex items-center justify-center gap-2 text-slate-400'>
                  <div className='w-8 h-0.5 bg-slate-300 dark:bg-slate-600' />
                  <UserPlus className='w-5 h-5' />
                  <div className='w-8 h-0.5 bg-slate-300 dark:bg-slate-600' />
                </div>

                <div className='p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                  <div className='flex items-center gap-4'>
                    <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                      <Building2 className='w-7 h-7 text-amber-600 dark:text-amber-400' />
                    </div>
                    <div className='flex-1'>
                      <p className='font-semibold text-slate-900 dark:text-slate-100'>
                        {teacherPreview.classInfo.name}
                      </p>
                      <p className='text-sm text-slate-500 dark:text-slate-400'>
                        {teacherPreview.classInfo.grade || '未设置年级'}
                      </p>
                    </div>
                  </div>
                </div>

                {teacherPreview.classInfo.head_teacher_name && (
                  <div className='p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800'>
                    <div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
                      <AlertTriangle className='w-4 h-4' />
                      <p className='text-sm font-medium'>
                        当前班主任 {teacherPreview.classInfo.head_teacher_name} 将被替换
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={closeTeacherPreview}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                返回选择
              </button>
              <button
                onClick={confirmAssignHeadTeacher}
                disabled={isLoading}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                {isLoading ? (
                  <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                ) : (
                  <Check className='w-5 h-5' />
                )}
                确认分配
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialogOpen && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4' onClick={cancel}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700'>
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                options?.type === 'danger' ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500' :
                options?.type === 'warning' ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500' :
                'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'
              }`} />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    options?.type === 'danger' ? 'bg-gradient-to-br from-red-500 to-rose-500' :
                    options?.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                    'bg-gradient-to-br from-blue-500 to-indigo-500'
                  }`}>
                    <AlertTriangle className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {options?.title}
                  </h3>
                </div>
                <button
                  onClick={cancel}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-6'>
              <p className='text-slate-600 dark:text-slate-300 leading-relaxed'>
                {options?.message}
              </p>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={cancel}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                {options?.cancelText || '取消'}
              </button>
              <button
                onClick={confirm}
                disabled={isLoading}
                className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium disabled:opacity-50 ${
                  options?.type === 'danger' ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-red-500/25' :
                  options?.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-amber-500/25' :
                  'bg-gradient-to-r from-blue-500 to-indigo-500 hover:shadow-blue-500/25'
                }`}
              >
                {isLoading ? (
                  <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                ) : (
                  <Check className='w-5 h-5' />
                )}
                {options?.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4' onClick={closeImportModal}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                    <Upload className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    导入班级数据
                  </h3>
                </div>
                <button
                  onClick={closeImportModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div className='p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400'>
                    <FileJson className='w-4 h-4' />
                    <span>支持 JSON 和 Excel 格式的班级数据文件</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(api.importConfig.downloadTemplate('classes'));
                        if (!response.ok) throw new Error('下载失败');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = '班级导入模板.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (error) {
                        logger.error('下载模板失败:', error);
                        showToast('error', '下载模板失败');
                      }
                    }}
                    className='flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors'
                  >
                    <Download className='w-4 h-4' />
                    下载模板
                  </button>
                </div>
              </div>

              <div className='p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                <div className='flex items-center gap-2 mb-3'>
                  <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400' />
                  <span className='text-sm font-medium text-amber-800 dark:text-amber-300'>必填字段说明</span>
                </div>
                <ul className='space-y-1.5 text-sm text-amber-700 dark:text-amber-400'>
                  <li><span className='font-medium'>班级名称</span>：唯一标识，不能为空</li>
                </ul>
                <p className='mt-2 text-xs text-amber-600 dark:text-amber-500'>提示：下载模板后，请参考"填写说明"工作表了解详细的字段填写规则</p>
              </div>

              {importConfigs.length > 0 && (
                <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl'>
                  <label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>选择导入配置</label>
                  <select
                    value={selectedConfigId || ''}
                    onChange={(e) => setSelectedConfigId(e.target.value ? parseInt(e.target.value) : null)}
                    className='w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
                  >
                    <option value=''>使用默认配置</option>
                    {importConfigs.map(config => (
                      <option key={config.id} value={config.id}>{config.config_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {!importResult ? (
                <>
                  <div className='border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors cursor-pointer'
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='.json,.xlsx,.xls'
                      onChange={handleFileChange}
                      className='hidden'
                    />
                    <div className='w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                      <Upload className='w-8 h-8 text-amber-600 dark:text-amber-400' />
                    </div>
                    <p className='text-lg font-semibold text-slate-700 dark:text-slate-200'>
                      点击或拖拽文件到此处
                    </p>
                    <p className='text-sm text-slate-500 dark:text-slate-400 mt-1'>
                      支持 .json、.xlsx、.xls 格式文件
                    </p>
                  </div>

                  {importFile && (
                    <div className='flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                          <FileJson className='w-5 h-5 text-white' />
                        </div>
                        <div>
                          <p className='font-medium text-slate-900 dark:text-slate-100'>{importFile.name}</p>
                          <p className='text-sm text-slate-500 dark:text-slate-400'>
                            {(importFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setImportFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className='p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors'
                      >
                        <X className='w-5 h-5' />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className='space-y-4'>
                  <div className='flex items-center justify-center gap-4 p-4 rounded-xl'
                    style={{ backgroundColor: importResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      importResult.success ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>
                      {importResult.success ? (
                        <Check className='w-6 h-6 text-white' />
                      ) : (
                        <X className='w-6 h-6 text-white' />
                      )}
                    </div>
                    <div className='text-center'>
                      <p className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                        导入完成
                      </p>
                      <p className='text-sm text-slate-500 dark:text-slate-400'>
                        总计 {importResult.total} 条 | 成功 {importResult.success_count} 条 | 失败 {importResult.failed_count} 条
                      </p>
                    </div>
                  </div>

                  {importResult.messages.length > 0 && (
                    <div className='max-h-[300px] overflow-y-auto space-y-2'>
                      <div className='flex items-center justify-between mb-2'>
                        <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>导入详情：</p>
                        {importResult.failed_count > 0 && (
                          <button
                            onClick={handleExportErrors}
                            className='flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors'
                          >
                            <Download className='w-4 h-4' />
                            导出错误数据
                          </button>
                        )}
                      </div>
                      {importResult.messages.map((msg, index) => (
                        <div key={index} className={`p-3 rounded-lg text-sm ${
                          msg.action === 'failed'
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            : msg.action === 'created'
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        }`}>
                          {msg.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={closeImportModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                关闭
              </button>
              {!importResult && (
                <PermissionButton
                  permission='class.manage'
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
                >
                  {isImporting ? (
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  ) : (
                    <Upload className='w-5 h-5' />
                  )}
                  开始导入
                </PermissionButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassManagementPage;
