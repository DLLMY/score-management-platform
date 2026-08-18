import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  X,
  Check,
  GraduationCap,
  Layers,
  Palette,
  Link2,
  Users,
  Minus,
  School,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import api, { Subject, SubjectClassLink, ClassInfo, getAuthHeaders } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton, SearchFilter } from '../components';
import { ToggleSwitch } from '../components/form/ToggleSwitch';
import ImportExportPanel from '../components/special/ImportExportPanel';
import { usePermissions, useForm, useModal } from '../hooks';
import { useDebouncedValue } from '../hooks';

interface FormData {
  id: number | null;
  name: string;
  code: string;
  grade: string;
  description: string;
  color: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface AdminUser {
  id: number;
  real_name: string;
  username: string;
  is_active?: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';

const defaultForm: FormData = {
  id: null,
  name: '',
  code: '',
  grade: '',
  description: '',
  color: '#10B981',
  is_active: true,
};

const presetColors = [
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

function SubjectManagementPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // 数据加载失败标记（科目/教师/班级/关联任一失败置位）
  const [loadError, setLoadError] = useState<boolean>(false);
  const { showToast } = useStableToast();
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
    async (includeInactive = statusFilter !== 'active', skipCache = false) => {
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
      fetchSubjects();
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
      if (!window.confirm('确定要移除该班级关联吗？')) return;
      try {
        await api.subjects.removeClass(selectedSubject.id, classInfoId);
        showToast('success', '已移除班级关联');
        await fetchSubjectClasses(selectedSubject.id);
        fetchSubjects();
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
      if (!window.confirm('确定要删除这个科目吗？')) return;
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

  // Calculate statistics
  const totalSubjects = subjects.length;
  const activeSubjects = subjects.filter((s) => s.is_active).length;
  const totalClassCount = subjects.reduce((sum, s) => sum + (s.class_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {loadError && (
        <div className='px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            科目/教师/班级数据加载失败，当前数据可能不完整，请刷新重试
          </p>
        </div>
      )}
      {/* Header */}
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/20'>
                <BookOpen className='w-6 h-6 text-white' />
              </div>
              <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
                <div className='w-2 h-2 bg-white rounded-full' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                科目管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理科目信息、科目代码和班级关联
              </p>
            </div>
          </div>
          <PermissionButton
            permission='score.entry'
            onClick={() => handleOpenModal(false)}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            添加科目
          </PermissionButton>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20'>
                <BookOpen className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>科目总数</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {totalSubjects}
                </p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
                <GraduationCap className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>启用科目</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {activeSubjects}
                </p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20'>
                <Layers className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>班级关联</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {totalClassCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Grid */}
      <div className='flex-1 px-6 pb-6 overflow-auto'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          {/* Search Bar */}
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
              <SearchFilter
                value={searchInput}
                onChange={setSearchInput}
                filters={[
                  { label: '全部', value: 'all' },
                  { label: '启用', value: 'active' },
                  { label: '禁用', value: 'inactive' },
                ]}
                activeFilter={statusFilter}
                onFilterChange={(v) => handleStatusFilterChange(v as StatusFilter)}
                placeholder='搜索科目名称、代码或年级...'
                className='flex-1'
                showReset={true}
                onReset={() => {
                  setSearchInput('');
                  handleStatusFilterChange('all');
                  fetchSubjects();
                }}
              >
                <button
                  onClick={() => fetchSubjects()}
                  className='p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all'
                  title='刷新列表'
                >
                  <RefreshCw className='w-5 h-5' />
                </button>
              </SearchFilter>
              <ImportExportPanel
                type='subject'
                showExport={true}
                showImport={true}
                showTemplate={true}
                acceptFormats='.json,.xlsx,.xls'
                exportUrl={`/api/subjects/export?include_inactive=${statusFilter !== 'active'}`}
                importUrl='/api/subjects/import'
                templateUrl='/api/subjects/template'
                onDataExport={handleExport}
                onImportComplete={handleImportComplete}
                permissions={{
                  import: 'subject.import',
                  export: 'subject.export',
                  template: 'subject.template',
                }}
              />
            </div>
          </div>

          {/* Subject Grid */}
          <div className='p-5'>
            {isLoading ? (
              <div className='flex flex-col items-center justify-center py-16 gap-3'>
                <div className='w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin' />
                <p className='text-sm text-slate-500 dark:text-slate-400'>加载中...</p>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 gap-3'>
                <div className='w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center'>
                  <BookOpen className='w-8 h-8 text-slate-400' />
                </div>
                <p className='text-slate-500 dark:text-slate-400'>
                  {searchInput ? '未找到匹配的科目' : '暂无科目数据'}
                </p>
                {!searchInput && (
                  <PermissionButton
                    permission='score.entry'
                    onClick={() => handleOpenModal(false)}
                    className='text-violet-500 hover:text-violet-600 font-medium text-sm'
                  >
                    添加第一个科目
                  </PermissionButton>
                )}
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                {filteredSubjects.map((subject, index) => (
                  <div
                    key={subject.id}
                    className='group relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-700/50 dark:to-slate-700 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-600/50 hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-500/50 transition-all duration-300'
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Color Bar */}
                    <div
                      className='absolute top-0 left-4 right-4 h-1 rounded-b-full opacity-80 group-hover:opacity-100 transition-opacity'
                      style={{ backgroundColor: subject.color }}
                    />

                    <div className='flex items-start justify-between mb-4 mt-2'>
                      <div className='flex items-center gap-3'>
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                            !subject.is_active ? 'opacity-50' : ''
                          }`}
                          style={{ backgroundColor: `${subject.color}20` }}
                        >
                          <BookOpen className='w-6 h-6' style={{ color: subject.color }} />
                        </div>
                        <div>
                          <h3
                            className={`font-bold text-lg ${
                              subject.is_active
                                ? 'text-slate-800 dark:text-slate-100'
                                : 'text-slate-400 dark:text-slate-500 line-through'
                            }`}
                          >
                            {subject.name}
                          </h3>
                          {subject.code && (
                            <span className='inline-block px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-medium rounded-md'>
                              {subject.code}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        <PermissionButton
                          permission='score.entry'
                          onClick={() => handleToggleStatus(subject)}
                          className={`p-2 rounded-lg transition-all ${
                            subject.is_active
                              ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                              : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'
                          }`}
                          title={subject.is_active ? '禁用科目' : '启用科目'}
                        >
                          {subject.is_active ? (
                            <ToggleRight className='w-5 h-5' />
                          ) : (
                            <ToggleLeft className='w-5 h-5' />
                          )}
                        </PermissionButton>
                      </div>
                    </div>

                    {subject.description && (
                      <p className='text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2'>
                        {subject.description}
                      </p>
                    )}

                    <div className='flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-600/50'>
                      <div className='flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400'>
                        {subject.grade && (
                          <span className='flex items-center gap-1'>
                            <GraduationCap className='w-4 h-4' />
                            {subject.grade}
                          </span>
                        )}
                        <span className='flex items-center gap-1'>
                          <Layers className='w-4 h-4' />
                          {subject.class_count != null ? subject.class_count : '--'}班
                        </span>
                      </div>
                      <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <PermissionButton
                          permission='score.entry'
                          onClick={() => openClassLinkModal(subject)}
                          className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                          title='关联班级'
                        >
                          <Link2 className='w-4 h-4' />
                        </PermissionButton>
                        <PermissionButton
                          permission='score.entry'
                          onClick={() => handleOpenModal(true, subject)}
                          className='p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-all'
                        >
                          <Edit2 className='w-4 h-4' />
                        </PermissionButton>
                        <PermissionButton
                          permission='score.entry'
                          onClick={() => handleDelete(subject.id)}
                          className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                        >
                          <Trash2 className='w-4 h-4' />
                        </PermissionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex-shrink-0'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center'>
                    <Palette className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑科目' : '添加科目'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => e.preventDefault()}
              className='px-6 py-5 space-y-5 flex-1 overflow-y-auto min-h-0'
            >
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  科目名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={handleChangeEvent('name')}
                  placeholder='输入科目名称'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.name
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-violet-500'
                  }`}
                />
                {errors.name && <p className='mt-1 text-sm text-red-500'>{errors.name}</p>}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    科目代码
                  </label>
                  <input
                    type='text'
                    value={formData.code}
                    onChange={handleChangeEvent('code')}
                    placeholder='如: MATH'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    所属年级
                  </label>
                  <input
                    type='text'
                    value={formData.grade}
                    onChange={handleChangeEvent('grade')}
                    placeholder='如: 高一'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                  />
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  颜色
                </label>
                <div className='flex items-center gap-3 mb-3'>
                  <input
                    type='color'
                    value={formData.color}
                    onChange={handleChangeEvent('color')}
                    className='w-12 h-10 rounded-xl cursor-pointer border-0 bg-transparent'
                  />
                  <input
                    type='text'
                    value={formData.color}
                    onChange={handleChangeEvent('color')}
                    className='flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div className='flex flex-wrap gap-2'>
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type='button'
                      onClick={() => handleChange('color', color)}
                      className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                        formData.color === color
                          ? 'ring-2 ring-offset-2 ring-violet-500 scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={handleChangeEvent('description')}
                  placeholder='输入科目描述'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400'
                />
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                  启用状态
                </label>
                <ToggleSwitch
                  checked={formData.is_active}
                  onChange={(v) => handleChange('is_active', v)}
                  activeClass='bg-gradient-to-r from-emerald-500 to-teal-500'
                />
              </div>
            </form>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3 flex-shrink-0'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <PermissionButton
                permission='score.entry'
                onClick={async () => {
                  const isValid = validateAll();
                  if (!isValid) return;
                  await onSubmit(formData);
                }}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 font-medium'
              >
                <Check className='w-5 h-5' />
                保存
              </PermissionButton>
            </div>
          </div>
        </div>
      )}

      {/* Class Link Modal */}
      {showClassLinkModal && selectedSubject && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={closeClassLinkModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800 flex-shrink-0'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <Link2 className='w-5 h-5 text-white' />
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                      关联班级
                    </h3>
                    <p className='text-sm text-slate-500 dark:text-slate-400'>
                      {selectedSubject.name} - 已关联 {subjectClasses.length} 个班级
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeClassLinkModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5 flex-1 overflow-y-auto min-h-0'>
              {/* Add new class link */}
              <div className='bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 space-y-4'>
                <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2'>
                  <Plus className='w-4 h-4' />
                  添加班级关联
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  <div>
                    <label className='block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>
                      选择班级
                    </label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(Number(e.target.value))}
                      className='w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm text-slate-800 dark:text-slate-100'
                    >
                      <option value={0}>请选择班级</option>
                      {allClasses
                        .filter((c) => !subjectClasses.some((sc) => sc.class_info_id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.grade ? `(${c.grade})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>
                      授课教师（可选）
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(Number(e.target.value))}
                      className='w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm text-slate-800 dark:text-slate-100'
                    >
                      <option value={0}>不指定</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.real_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='flex items-end'>
                    <PermissionButton
                      permission='score.entry'
                      onClick={handleAssignClass}
                      className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium text-sm'
                    >
                      <Plus className='w-4 h-4' />
                      添加关联
                    </PermissionButton>
                  </div>
                </div>
              </div>

              {/* Linked classes list */}
              <div>
                <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2'>
                  <School className='w-4 h-4' />
                  已关联班级
                </h4>
                {linkLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin' />
                  </div>
                ) : subjectClasses.length === 0 ? (
                  <div className='text-center py-8 bg-slate-50 dark:bg-slate-700/30 rounded-2xl'>
                    <School className='w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2' />
                    <p className='text-sm text-slate-400 dark:text-slate-500'>暂无关联班级</p>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {subjectClasses.map((sc) => (
                      <div
                        key={sc.id}
                        className='flex items-center justify-between p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600/50 hover:shadow-md transition-all'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                            <School className='w-5 h-5 text-white' />
                          </div>
                          <div>
                            <p className='font-semibold text-slate-800 dark:text-slate-100 text-sm'>
                              {sc.class_name}
                            </p>
                            {sc.grade && (
                              <p className='text-xs text-slate-500 dark:text-slate-400'>
                                {sc.grade}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          {sc.teacher_name ? (
                            <div className='flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-600 px-2.5 py-1 rounded-full'>
                              <Users className='w-3 h-3' />
                              {sc.teacher_name}
                            </div>
                          ) : (
                            <span className='text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1 rounded-full'>
                              未指定教师
                            </span>
                          )}
                          <PermissionButton
                            permission='score.entry'
                            onClick={() => handleEditTeacher(sc)}
                            className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                            title='编辑教师'
                          >
                            <Edit2 className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton
                            permission='score.entry'
                            onClick={() => handleRemoveClass(sc.class_info_id)}
                            className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                            title='移除关联'
                          >
                            <Minus className='w-4 h-4' />
                          </PermissionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editingTeacherLinkId > 0 && selectedSubject && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => {
            setEditingTeacherSubjectId(0);
            setEditingTeacherClassId(0);
            setEditingTeacherLinkId(0);
            setEditingTeacherId(0);
          }}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800 flex-shrink-0'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <Users className='w-5 h-5 text-white' />
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                      编辑授课教师
                    </h3>
                    <p className='text-sm text-slate-500 dark:text-slate-400'>
                      {selectedSubject.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingTeacherSubjectId(0);
                    setEditingTeacherClassId(0);
                    setEditingTeacherLinkId(0);
                    setEditingTeacherId(0);
                  }}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5 flex-1 overflow-y-auto min-h-0'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  选择授课教师
                </label>
                <select
                  value={editingTeacherId}
                  onChange={(e) => setEditingTeacherId(Number(e.target.value))}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100'
                >
                  <option value={0}>不指定教师</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.real_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3 flex-shrink-0'>
              <button
                onClick={() => {
                  setEditingTeacherSubjectId(0);
                  setEditingTeacherClassId(0);
                  setEditingTeacherLinkId(0);
                  setEditingTeacherId(0);
                }}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <PermissionButton
                permission='score.entry'
                onClick={handleSaveTeacher}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium'
              >
                <Check className='w-5 h-5' />
                保存
              </PermissionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubjectManagementPage;
