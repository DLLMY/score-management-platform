import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Calendar,
  X,
  Check,
  Building2,
  User,
  MapPin,
  ChevronDown,
  Download,
  Upload,
  FileJson,
  AlertTriangle,
  ClipboardList,
  Table,
} from 'lucide-react';
import api, { CourseSchedule, ClassPeriod, ClassInfo, Subject, getAuthHeaders } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useForm, useModal, useConfirmDialog } from '../hooks';
import { PermissionButton } from '../components';
import { usePermissions } from '../hooks/usePermissions';

interface FormData {
  class_info_id: number;
  subject_id: number;
  day_of_week: number;
  period_number: number;
  teacher_id?: number;
  teacher_name: string;
  classroom: string;
  description: string;
  color: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface ConflictResult {
  has_conflict: boolean;
  conflicts: Array<{
    type: string;
    message: string;
    schedule_id?: number;
    conflicting_class_name?: string;
    conflicting_subject_name?: string;
    conflicting_teacher_name?: string;
    conflicting_classroom?: string;
  }>;
}

interface WeekDay {
  day: number;
  label: string;
  shortLabel: string;
}

const CourseSchedulePage: React.FC = () => {
  const { showToast } = useStableToast();
  const showToastRef = React.useRef(showToast);
  
  React.useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);
  
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [schedulesError, setSchedulesError] = useState(false);
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState<number>(0);
  const [showClassDropdown, setShowClassDropdown] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);

  // Import/Export states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    total: number;
    success_count: number;
    failed_count: number;
    messages: Array<{ class_name: string; subject_name: string; action: string; message: string; row_data?: Record<string, unknown>; error_fields?: string[] }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importConfigs, setImportConfigs] = useState<Array<{ id: number; config_name: string }>>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'update' | 'error'>('update');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  usePermissions();

  // 使用 useConfirmDialog 管理确认对话框
  const { show: showConfirm } = useConfirmDialog();

  // 使用 useForm 管理表单状态
  const {
    formData,
    setFormData,
    resetForm,
  } = useForm<FormData>({
    class_info_id: 0,
    subject_id: 0,
    day_of_week: 0,
    period_number: 1,
    teacher_name: '',
    classroom: '',
    description: '',
    color: '#3B82F6',
    is_active: true,
  }, {
    class_info_id: { required: true },
    subject_id: { required: true },
    day_of_week: { required: true },
    period_number: { required: true },
  });

  // 使用 useModal 管理弹窗状态
  const { isOpen: showModal, open: openModal, close: closeModal } = useModal<CourseSchedule | null>({
    onClose: () => {
      resetForm();
      setEditingSchedule(null);
      setConflictResult(null);
    },
  });

  const { isOpen: showImportModal, open: openImportModal, close: closeImportModal } = useModal<null>({
    onClose: () => {
      setImportFile(null);
      setImportResult(null);
      setSelectedConfigId(null);
    },
  });

  const [editingSchedule, setEditingSchedule] = useState<CourseSchedule | null>(null);

  const weekDays: WeekDay[] = [
    { day: 0, label: '周一', shortLabel: '一' },
    { day: 1, label: '周二', shortLabel: '二' },
    { day: 2, label: '周三', shortLabel: '三' },
    { day: 3, label: '周四', shortLabel: '四' },
    { day: 4, label: '周五', shortLabel: '五' },
    { day: 5, label: '周六', shortLabel: '六' },
    { day: 6, label: '周日', shortLabel: '日' },
  ];

  const subjectColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
    '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#EC4899', '#14B8A6',
  ];

  const fetchData = useCallback(async (skipCache = false) => {
    setIsLoading(true);
    try {
      const [scheduleData, periodData, classData, subjectData] = await Promise.all([
        api.courseSchedules.getAll({ skipCache }),
        api.classPeriods.getAll(),
        api.classes.getAll(),
        api.subjects.getAll().catch(() => []),
      ]);
      setSchedules(scheduleData);
      setPeriods(periodData.periods || []);
      setClasses(classData.classes || []);
      setSubjects(Array.isArray(subjectData) ? subjectData : []);
    } catch (error) {
      console.error('获取数据失败:', error);
      showToastRef.current('error', '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (classes.length > 0 && selectedClass === 0) {
      setSelectedClass(classes[0].id);
      setFormData(prev => ({ ...prev, class_info_id: classes[0].id }));
    }
  }, [classes, selectedClass, setFormData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchSchedules = useCallback(async () => {
    try {
      const scheduleData = await api.courseSchedules.getAll(
        selectedClass > 0 ? { class_info_id: selectedClass } : undefined
      );
      setSchedules(scheduleData);
      setSchedulesError(false);
    } catch (error) {
      console.error('获取课程表失败:', error);
      setSchedulesError(true);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass > 0 || classes.length > 0) {
      fetchSchedules();
    }
  }, [selectedClass, classes.length, fetchSchedules]);

  const filteredSchedules = useMemo(() => {
    return selectedClass
      ? schedules.filter(s => s.class_info_id === selectedClass)
      : schedules;
  }, [schedules, selectedClass]);

  const getScheduleForCell = useCallback((day: number, period: number): CourseSchedule | undefined => {
    return filteredSchedules.find(s => s.day_of_week === day && s.period_number === period);
  }, [filteredSchedules]);

  const getPeriodTime = useCallback((periodNumber: number): string => {
    const period = periods.find(p => parseInt(String(p.period_number), 10) === periodNumber);
    if (!period) return `${periodNumber}节`;
    const startHour = parseInt(String(period.start_hour), 10) || 0;
    const startMinute = parseInt(String(period.start_minute), 10) || 0;
    const endHour = parseInt(String(period.end_hour), 10) || 0;
    const endMinute = parseInt(String(period.end_minute), 10) || 0;
    const start = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    const end = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    return `${start}-${end}`;
  }, [periods]);

  const getSubjectColor = useCallback((subjectId: number): string => {
    const subject = subjects.find(s => s.id === subjectId);
    if (subject?.color) return subject.color;
    return subjectColors[(subjectId - 1) % subjectColors.length];
  }, [subjects, subjectColors]);

  const checkConflicts = useCallback(async (): Promise<ConflictResult | null> => {
    try {
      const result = await api.courseSchedules.checkConflict({
        class_info_id: formData.class_info_id,
        teacher_name: formData.teacher_name || undefined,
        classroom: formData.classroom || undefined,
        day_of_week: formData.day_of_week,
        period_number: formData.period_number,
        exclude_id: editingSchedule?.id,
      }) as ConflictResult;
      setConflictResult(result);
      return result;
    } catch (error) {
      console.error('冲突检测失败:', error);
      return null;
    }
  }, [formData, editingSchedule]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.class_info_id || !formData.subject_id) {
      showToast('error', '请选择班级和科目');
      return;
    }

    const conflictData = await checkConflicts();
    if (conflictData?.has_conflict) {
      const messages = conflictData.conflicts.map(c => c.message).join('\n');
      showToast('error', `存在冲突：\n${messages}`);
      return;
    }

    try {
      if (editingSchedule) {
        await api.courseSchedules.update(editingSchedule.id, formData);
        showToast('success', '课程安排更新成功');
      } else {
        await api.courseSchedules.create(formData);
        showToast('success', '课程安排添加成功');
      }
      closeModal();
      setEditingSchedule(null);
      setConflictResult(null);
      setFormData({
        class_info_id: selectedClass,
        subject_id: 0,
        day_of_week: 0,
        period_number: 1,
        teacher_id: undefined,
        teacher_name: '',
        classroom: '',
        description: '',
        color: '#3B82F6',
        is_active: true,
      });
      fetchData();
    } catch (error: any) {
      console.error('保存失败:', error);
      const errorMessage = error.message || (editingSchedule ? '更新失败' : '添加失败');
      showToast('error', errorMessage);
    }
  }, [formData, editingSchedule, selectedClass, showToast, checkConflicts, fetchData, closeModal, setFormData]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm(`确定要删除这个课程安排吗？`)) return;
    try {
      await api.courseSchedules.delete(id);
      showToast('success', '删除成功');
      fetchData(true);
    } catch (error) {
      console.error('删除失败:', error);
      showToast('error', '删除失败');
    }
  }, [showToast, fetchData, showConfirm]);

  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('excel');
  const [exporting, setExporting] = useState(false);
  const exportSchedule = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await api.courseSchedules.export(selectedClass > 0 ? selectedClass : undefined, exportFormat);
      showToast('success', '课程表导出成功');
    } catch (e) {
      showToast('error', '导出失败: ' + ((e as Error).message || '未知错误'));
    } finally {
      setExporting(false);
    }
  }, [selectedClass, exportFormat, showToast, exporting]);

  const openImportModalWithData = useCallback(() => {
    openImportModal();
    setImportFile(null);
    setImportResult(null);
    setSelectedConfigId(null);
    api.importConfig.list({ module_name: 'course_schedule' }).then((res) => {
      if (res) {
        setImportConfigs(res.map(c => ({ id: c.id, config_name: c.config_name })));
      }
    }).catch(console.error);
  }, [openImportModal]);

  const closeImportModalWithReset = useCallback(() => {
    closeImportModal();
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [closeImportModal]);

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
        let url = '/api/course-schedules/import';
        const params = new URLSearchParams();
        if (selectedConfigId) {
          params.append('config_id', selectedConfigId.toString());
        }
        params.append('conflict_strategy', conflictStrategy);
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const result = await api.courseSchedules.import(formData, url);
        setImportResult(result);

        if (result.success) {
          showToast('success', `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`);
          fetchData();
        } else {
          showToast('error', '导入失败');
        }
      } else {
        const fileContent = await importFile.text();
        const importData = JSON.parse(fileContent);
        const formData = new FormData();
        formData.append('data', JSON.stringify(importData));
        let url = '/api/course-schedules/import';
        const params = new URLSearchParams();
        if (selectedConfigId) {
          params.append('config_id', selectedConfigId.toString());
        }
        params.append('conflict_strategy', conflictStrategy);
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const result = await api.courseSchedules.import(formData, url);
        setImportResult(result);

        if (result.success) {
          showToast('success', `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`);
          fetchData();
        } else {
          showToast('error', '导入失败');
        }
      }
    } catch (error: any) {
      console.error('导入失败:', error);
      showToast('error', '导入失败：' + error.message);
    } finally {
      setIsImporting(false);
    }
  }, [importFile, selectedConfigId, conflictStrategy, showToast, fetchData]);

  const handleEdit = useCallback((schedule: CourseSchedule) => {
    setEditingSchedule(schedule);
    const subject = subjects.find(s => s.id === schedule.subject_id);
    const color = subject?.color || schedule.color || '#3B82F6';
    setFormData({
      class_info_id: schedule.class_info_id,
      subject_id: schedule.subject_id,
      day_of_week: schedule.day_of_week,
      period_number: schedule.period_number,
      teacher_id: schedule.teacher_id,
      teacher_name: schedule.teacher_name,
      classroom: schedule.classroom,
      description: schedule.description,
      color: color,
      is_active: schedule.is_active,
    });
    setConflictResult(null);
    openModal();
  }, [subjects, openModal, setFormData]);

  const handleAdd = useCallback((day?: number, period?: number) => {
    setEditingSchedule(null);
    setConflictResult(null);
    setFormData({
      class_info_id: selectedClass || (classes.length > 0 ? classes[0].id : 0),
      subject_id: 0,
      day_of_week: day ?? 0,
      period_number: period ?? 1,
      teacher_id: undefined,
      teacher_name: '',
      classroom: '',
      description: '',
      color: '#3B82F6',
      is_active: true,
    });
    openModal();
  }, [selectedClass, classes, openModal, setFormData]);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subjectId = parseInt(e.target.value);
    setFormData(prev => ({
      ...prev,
      subject_id: subjectId,
      color: getSubjectColor(subjectId),
    }));
  };

  const handleFormChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (conflictResult) {
      setConflictResult(null);
    }
  };

  const activePeriods = useMemo(() => {
    return periods.filter(p => p.is_active).sort((a, b) => a.sort_order - b.sort_order);
  }, [periods]);

  // Statistics
  const { totalSchedules, uniqueSubjects, uniqueTeachers } = useMemo(() => {
    return {
      totalSchedules: filteredSchedules.length,
      uniqueSubjects: new Set(filteredSchedules.map(s => s.subject_id)).size,
      uniqueTeachers: new Set(filteredSchedules.filter(s => s.teacher_name).map(s => s.teacher_name)).size,
    };
  }, [filteredSchedules]);

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {schedulesError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>课程表加载失败，当前课表可能不完整，请刷新重试</p>
        </div>
      )}
      {/* Header */}
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <Calendar className='w-6 h-6 text-white' />
              </div>
              <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
                <div className='w-2 h-2 bg-white rounded-full' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                课程表管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>管理班级课程安排，支持可视化时间表和冲突检测</p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <PermissionButton
              permission='schedule.manage'
              onClick={exportSchedule}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Download className='w-5 h-5' />
              导出课程表
            </PermissionButton>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'json' | 'excel')}
              className='px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
            >
              <option value='excel'>Excel 格式</option>
              <option value='json'>JSON 格式</option>
            </select>
            <button
              onClick={openImportModalWithData}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Upload className='w-5 h-5' />
              导入课程表
            </button>
            <PermissionButton
              permission='schedule.manage'
              onClick={() => handleAdd()}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              添加课程安排
            </PermissionButton>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20'>
                <Table className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>课程总数</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{totalSchedules}</p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20'>
                <ClipboardList className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>涉及科目</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{uniqueSubjects}</p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20'>
                <User className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>授课教师</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{uniqueTeachers}</p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
                <Building2 className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>班级数量</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>{classes.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Class Selector and Table */}
      <div className='flex-1 px-6 pb-6 overflow-auto'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          {/* Class Selector Bar */}
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center justify-between'>
              <div className='relative'>
                <button
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  className='flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-200 min-w-[200px] justify-between shadow-sm'
                >
                  <div className='flex items-center gap-3'>
                    <Building2 className='w-5 h-5 text-cyan-500' />
                    <span className='text-slate-700 dark:text-slate-200 font-medium'>
                      {classes.find(c => c.id === selectedClass)?.name || '选择班级'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showClassDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showClassDropdown && (
                  <>
                    <div className='fixed inset-0 z-40' onClick={() => setShowClassDropdown(false)} />
                    <div className='absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden'>
                      {classes.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => {
                            setSelectedClass(cls.id);
                            setShowClassDropdown(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 ${selectedClass === cls.id ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-200'}`}
                        >
                          <Building2 className='w-4 h-4' />
                          <span className='font-medium'>{cls.name}</span>
                          {cls.grade && <span className='text-xs text-slate-400'>{cls.grade}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className='flex items-center gap-4'>
                <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg'>
                  <Clock className='w-4 h-4' />
                  <span>共 <strong className='text-slate-700 dark:text-slate-200'>{filteredSchedules.length}</strong> 节课程</span>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          {isLoading ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3'>
              <div className='w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin' />
              <p className='text-sm text-slate-500 dark:text-slate-400'>加载中...</p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full border-collapse'>
                <thead>
                  <tr>
                    <th className='p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-700/50 dark:to-slate-800 border-b border-slate-200 dark:border-slate-600 text-left text-sm font-semibold text-slate-600 dark:text-slate-300 w-[140px] sticky left-0 z-10 bg-white dark:bg-slate-800'>
                      <div className='flex items-center gap-2'>
                        <Clock className='w-4 h-4 text-cyan-500' />
                        节次 / 时间
                      </div>
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.day}
                        className='p-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-700/50 dark:to-slate-800 border-b border-slate-200 dark:border-slate-600 text-center text-sm font-semibold min-w-[160px]'
                      >
                        <div className='flex flex-col items-center gap-1'>
                          <span className='text-xs text-slate-400 uppercase tracking-wider'>{day.shortLabel}</span>
                          <span className='font-bold text-slate-700 dark:text-white text-base'>{day.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePeriods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className='text-center py-16'>
                        <div className='flex flex-col items-center gap-3'>
                          <div className='w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center'>
                            <Clock className='w-8 h-8 text-slate-400' />
                          </div>
                          <p className='text-slate-500 dark:text-slate-400'>暂无课程节次设置</p>
                          <a href='#/class-period-settings' className='text-cyan-500 hover:text-cyan-600 font-medium text-sm'>
                            设置课程节次
                          </a>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activePeriods.map((period) => (
                      <tr key={period.id} className='hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group'>
                        <td className='p-4 border-b border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 sticky left-0 z-10'>
                          <div className='font-bold text-slate-700 dark:text-slate-200 text-lg'>{period.name}</div>
                          <div className='text-xs text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md inline-block'>
                            {getPeriodTime(period.period_number)}
                          </div>
                        </td>
                        {weekDays.map((day) => {
                          const schedule = getScheduleForCell(day.day, period.period_number);
                          return (
                            <td
                              key={day.day}
                              className='p-3 border-b border-slate-100 dark:border-slate-700 relative'
                            >
                              {schedule ? (
                                <div
                                  className='group/schedule relative rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-gray-100 dark:border-slate-600'
                                  style={{ 
                                    backgroundColor: `${schedule.subject_color}12`,
                                    borderColor: `${schedule.subject_color}30`
                                  }}
                                  onClick={() => handleEdit(schedule)}
                                >
                                  <div className='absolute top-2 right-2 flex gap-1 opacity-0 group-hover/schedule:opacity-100 transition-all duration-200 transform translate-x-2 group-hover/schedule:translate-x-0'>
                                    <PermissionButton
                                      permission='schedule.manage'
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(schedule);
                                      }}
                                      className='p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-md hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors'
                                    >
                                      <Edit2 className='w-3.5 h-3.5 text-slate-600 dark:text-slate-300' />
                                    </PermissionButton>
                                    <PermissionButton
                                      permission='schedule.manage'
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(schedule.id);
                                      }}
                                      className='p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors'
                                    >
                                      <Trash2 className='w-3.5 h-3.5 text-red-500' />
                                    </PermissionButton>
                                  </div>
                                  <div
                                    className='text-white text-xs font-bold px-2.5 py-1 rounded-lg mb-3 inline-block shadow-sm'
                                    style={{ backgroundColor: schedule.subject_color }}
                                  >
                                    {schedule.subject_name}
                                  </div>
                                  {schedule.teacher_name && (
                                    <div className='flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-1.5'>
                                      <User className='w-3.5 h-3.5 text-slate-400' />
                                      <span className='font-medium'>{schedule.teacher_name}</span>
                                    </div>
                                  )}
                                  {schedule.classroom && (
                                    <div className='flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500'>
                                      <MapPin className='w-3.5 h-3.5 text-slate-400' />
                                      <span>{schedule.classroom}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAdd(day.day, period.period_number)}
                                  className='w-full h-full min-h-[100px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-all duration-200 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-cyan-500'
                                >
                                  <Plus className='w-5 h-5' />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4' onClick={() => { closeModal(); setEditingSchedule(null); setConflictResult(null); }}>
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center'>
                    <Calendar className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {editingSchedule ? '编辑课程安排' : '添加课程安排'}
                  </h3>
                </div>
                <button
                  onClick={() => { closeModal(); setEditingSchedule(null); setConflictResult(null); }}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className='px-6 py-5 space-y-5'>
              {/* Conflict Warning */}
              {conflictResult?.has_conflict && (
                <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl'>
                  <div className='flex items-start gap-3'>
                    <AlertTriangle className='w-5 h-5 text-red-500 mt-0.5' />
                    <div>
                      <p className='font-medium text-red-600 dark:text-red-400'>检测到冲突</p>
                      <ul className='mt-2 text-sm text-red-500 dark:text-red-400 space-y-1'>
                        {conflictResult.conflicts.map((c, i) => (
                          <li key={i}>{c.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    班级 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.class_info_id}
                    onChange={(e) => handleFormChange('class_info_id', parseInt(e.target.value))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    <option value={0}>选择班级</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name} {cls.grade ? `(${cls.grade})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    科目 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.subject_id}
                    onChange={handleSubjectChange}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    <option value={0}>选择科目</option>
                    {subjects.filter(s => s.is_active).map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    星期 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => handleFormChange('day_of_week', parseInt(e.target.value))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    {weekDays.map((day) => (
                      <option key={day.day} value={day.day}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    节次 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.period_number}
                    onChange={(e) => handleFormChange('period_number', parseInt(e.target.value))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    {activePeriods.map((period) => (
                      <option key={period.id} value={period.period_number}>
                        {period.name} ({getPeriodTime(period.period_number)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    授课教师
                  </label>
                  <div className='relative'>
                    <User className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <input
                      type='text'
                      value={formData.teacher_name}
                      onChange={(e) => handleFormChange('teacher_name', e.target.value)}
                      placeholder='输入教师姓名'
                      className='w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    教室
                  </label>
                  <div className='relative'>
                    <MapPin className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <input
                      type='text'
                      value={formData.classroom}
                      onChange={(e) => handleFormChange('classroom', e.target.value)}
                      placeholder='输入教室'
                      className='w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  备注
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder='输入备注信息'
                  rows={2}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400'
                />
              </div>

              {/* Conflict Check Button */}
              <button
                type='button'
                onClick={checkConflicts}
                className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm'
              >
                <AlertTriangle className='w-4 h-4' />
                检测时间冲突
              </button>

              <div className='flex items-center justify-end gap-3 pt-2'>
                <button
                  type='button'
                  onClick={() => { closeModal(); setEditingSchedule(null); setConflictResult(null); }}
                  className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
                >
                  取消
                </button>
                <PermissionButton
                  permission='schedule.manage'
                  type='submit'
                  className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium'
                >
                  <Check className='w-5 h-5' />
                  保存
                </PermissionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4' onClick={closeImportModalWithReset}>
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
                    导入课程表数据
                  </h3>
                </div>
                <button
                  onClick={closeImportModalWithReset}
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
                    <span>支持 JSON 和 Excel 格式的课程表数据文件（包含班级和科目信息）</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(api.importConfig.downloadTemplate('course_schedule'));
                        if (!response.ok) throw new Error('下载失败');
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = '课程表导入模板.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (error) {
                        console.error('下载模板失败:', error);
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
                  <li><span className='font-medium'>班级名称</span>：必须是系统中已存在的班级</li>
                  <li><span className='font-medium'>科目名称</span>：必须是系统中已存在的科目</li>
                  <li><span className='font-medium'>星期</span>：周一至周日</li>
                  <li><span className='font-medium'>节次</span>：数字，如1、2、3</li>
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

              <div className='p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl'>
                <label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>冲突处理策略</label>
                <div className='space-y-2'>
                  <label className='flex items-center gap-3 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors'>
                    <input
                      type='radio'
                      name='conflictStrategy'
                      value='update'
                      checked={conflictStrategy === 'update'}
                      onChange={(e) => setConflictStrategy(e.target.value as 'skip' | 'update' | 'error')}
                      className='w-4 h-4 text-indigo-600 focus:ring-indigo-500'
                    />
                    <div>
                      <div className='font-medium text-slate-800 dark:text-slate-100'>更新已存在课程</div>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>如果同一班级在同一时间已有课程，将更新为新的课程信息</div>
                    </div>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors'>
                    <input
                      type='radio'
                      name='conflictStrategy'
                      value='skip'
                      checked={conflictStrategy === 'skip'}
                      onChange={(e) => setConflictStrategy(e.target.value as 'skip' | 'update' | 'error')}
                      className='w-4 h-4 text-indigo-600 focus:ring-indigo-500'
                    />
                    <div>
                      <div className='font-medium text-slate-800 dark:text-slate-100'>跳过已存在课程</div>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>如果同一班级在同一时间已有课程，将跳过该条记录</div>
                    </div>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors'>
                    <input
                      type='radio'
                      name='conflictStrategy'
                      value='error'
                      checked={conflictStrategy === 'error'}
                      onChange={(e) => setConflictStrategy(e.target.value as 'skip' | 'update' | 'error')}
                      className='w-4 h-4 text-indigo-600 focus:ring-indigo-500'
                    />
                    <div>
                      <div className='font-medium text-slate-800 dark:text-slate-100'>视为导入错误</div>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>如果同一班级在同一时间已有课程，将视为导入错误并记录</div>
                    </div>
                  </label>
                </div>
              </div>

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
                      <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>导入详情：</p>
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
                onClick={closeImportModalWithReset}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                关闭
              </button>
              {importResult && importResult.failed_count && importResult.failed_count > 0 && (
                <button
                  onClick={() => {
                    const errors = importResult.messages!
                      .filter(msg => msg.action === 'failed')
                      .map(msg => ({
                        ...msg,
                        error_fields: msg.error_fields || [],
                      }));
                    if (errors.length > 0) {
                      fetch('/api/export/errors', {
                        method: 'POST',
                        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ errors, module: 'course_schedule' })
                      }).then(response => response.blob()).then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = '课程表导入错误数据.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      });
                    }
                  }}
                  className='flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium'
                >
                  <Download className='w-4 h-4' />
                  导出错误数据
                </button>
              )}
              {!importResult && (
                <PermissionButton
                  permission='schedule.manage'
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
};

export default CourseSchedulePage;
