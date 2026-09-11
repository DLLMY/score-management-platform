import logger from '../../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 课程表页面的逻辑层 hook（状态 / effect / handler / 列定义）。
 * 主文件退化为「hook → CourseScheduleView」的薄装配。
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api, { CourseSchedule, ClassPeriod, ClassInfo, Subject } from '../../services/api';
import { useStableToast, useForm, useModal, useSubmitGuard, usePermissions } from '../../hooks';
import { useConfirm, type ColumnType } from '../../components';
import { formatHourMinute } from '../../utils/format';
import type { FormData, ConflictResult, WeekDay, TeacherItem } from './types';
import type { CourseScheduleViewProps } from './types';
import { buildCourseColumns } from './columns';

/**
 * 课程表页逻辑 hook。
 */
export function useCourseScheduleLogic(): CourseScheduleViewProps {
  const { showToast } = useStableToast();
  const showToastRef = React.useRef(showToast);
  const { submitting, run: runSubmit } = useSubmitGuard();

  React.useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [schedulesError, setSchedulesError] = useState(false);
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
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
    messages: Array<{
      class_name: string;
      subject_name: string;
      action: string;
      message: string;
      row_data?: Record<string, unknown>;
      error_fields?: string[];
    }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importConfigs, setImportConfigs] = useState<Array<{ id: number; config_name: string }>>(
    []
  );
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'update' | 'error'>('update');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const confirmFn = useConfirm();
  const confirmRef = React.useRef(confirmFn);
  confirmRef.current = confirmFn;

  usePermissions();

  // 使用 useForm 管理表单状态
  const { formData, setFormData, resetForm } = useForm<FormData>(
    {
      class_info_id: 0,
      subject_id: 0,
      day_of_week: 0,
      period_number: 1,
      teacher_name: '',
      classroom: '',
      description: '',
      color: '#3B82F6',
      is_active: true,
    },
    {
      class_info_id: { required: true },
      subject_id: { required: true },
      day_of_week: { required: true },
      period_number: { required: true },
    }
  );

  // 使用 useModal 管理弹窗状态
  const {
    isOpen: showModal,
    open: openModal,
    close: closeModal,
  } = useModal<CourseSchedule | null>({
    onClose: () => {
      resetForm();
      setEditingSchedule(null);
      setConflictResult(null);
    },
  });

  const {
    isOpen: showImportModal,
    open: openImportModal,
    close: closeImportModal,
  } = useModal<null>({
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
    '#3B82F6',
    '#EF4444',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#6366F1',
    '#EC4899',
    '#14B8A6',
  ];

  const fetchData = useCallback(async (skipCache = false) => {
    setIsLoading(true);
    try {
      const [scheduleData, periodData, classData, subjectData, teacherData] = await Promise.all([
        api.courseSchedules.getAll({ skipCache }),
        api.classPeriods.getAll(),
        api.classes.getAll(),
        api.subjects.getAll().catch((): Subject[] => []),
        api.admins.getAll().catch((): TeacherItem[] => []),
      ]);
      setSchedules(scheduleData);
      setPeriods(periodData.periods || []);
      setClasses(classData.classes || []);
      setSubjects(Array.isArray(subjectData) ? subjectData : []);
      setTeachers(Array.isArray(teacherData) ? teacherData : []);
    } catch (error) {
      logger.error('获取数据失败:', error);
      showToastRef.current('error', '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (classes.length > 0 && selectedClass === 0) {
      setSelectedClass(classes[0].id);
      setFormData((prev) => ({ ...prev, class_info_id: classes[0].id }));
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
      logger.error('获取课程表失败:', error);
      setSchedulesError(true);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass > 0 || classes.length > 0) {
      fetchSchedules();
    }
  }, [selectedClass, classes.length, fetchSchedules]);

  const filteredSchedules = useMemo(() => {
    return selectedClass ? schedules.filter((s) => s.class_info_id === selectedClass) : schedules;
  }, [schedules, selectedClass]);

  const getScheduleForCell = useCallback(
    (day: number, period: number): CourseSchedule | undefined => {
      return filteredSchedules.find((s) => s.day_of_week === day && s.period_number === period);
    },
    [filteredSchedules]
  );

  const getPeriodTime = useCallback(
    (periodNumber: number): string => {
      const period = periods.find((p) => parseInt(String(p.period_number), 10) === periodNumber);
      if (!period) return `${periodNumber}节`;
      const startHour = parseInt(String(period.start_hour), 10) || 0;
      const startMinute = parseInt(String(period.start_minute), 10) || 0;
      const endHour = parseInt(String(period.end_hour), 10) || 0;
      const endMinute = parseInt(String(period.end_minute), 10) || 0;
      const start = formatHourMinute(startHour, startMinute);
      const end = formatHourMinute(endHour, endMinute);
      return `${start}-${end}`;
    },
    [periods]
  );

  const getSubjectColor = useCallback(
    (subjectId: number): string => {
      const subject = subjects.find((s) => s.id === subjectId);
      if (subject?.color) return subject.color;
      return subjectColors[(subjectId - 1) % subjectColors.length];
    },
    [subjects, subjectColors]
  );

  const checkConflicts = useCallback(async (): Promise<ConflictResult | null> => {
    try {
      const result = (await api.courseSchedules.checkConflict({
        class_info_id: formData.class_info_id,
        teacher_name: formData.teacher_name || undefined,
        classroom: formData.classroom || undefined,
        day_of_week: formData.day_of_week,
        period_number: formData.period_number,
        exclude_id: editingSchedule?.id,
      })) as ConflictResult;
      setConflictResult(result);
      return result;
    } catch (error) {
      logger.error('冲突检测失败:', error);
      return null;
    }
  }, [formData, editingSchedule]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!formData.class_info_id || !formData.subject_id) {
        showToast('error', '请选择班级和科目');
        return;
      }

      const conflictData = await checkConflicts();
      if (conflictData?.has_conflict) {
        const messages = conflictData.conflicts.map((c) => c.message).join('\n');
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
      } catch (error: unknown) {
        logger.error('保存失败:', error);
        const errorMessage =
          (error as Error).message || (editingSchedule ? '更新失败' : '添加失败');
        showToast('error', errorMessage);
      }
    },
    [
      formData,
      editingSchedule,
      selectedClass,
      showToast,
      checkConflicts,
      fetchData,
      closeModal,
      setFormData,
    ]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除这个课程安排吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.courseSchedules.delete(id);
        showToast('success', '删除成功');
        fetchData(true);
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', '删除失败');
      }
    },
    [showToast, fetchData]
  );

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
    api.importConfig
      .list({ module_name: 'course_schedule' })
      .then((res) => {
        if (res) {
          setImportConfigs(res.map((c) => ({ id: c.id, config_name: c.config_name })));
        }
      })
      .catch((e) => logger.error(e)); // 导入配置列表加载失败静默：仅影响弹窗下拉选项，主功能不受影响
  }, [openImportModal]);

  const closeImportModalWithReset = useCallback(() => {
    closeImportModal();
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [closeImportModal]);

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
          showToast(
            'success',
            `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          );
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
          showToast(
            'success',
            `导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
          );
          fetchData();
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
  }, [importFile, selectedConfigId, conflictStrategy, showToast, fetchData]);

  const handleEdit = useCallback(
    (schedule: CourseSchedule) => {
      setEditingSchedule(schedule);
      const subject = subjects.find((s) => s.id === schedule.subject_id);
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
    },
    [subjects, openModal, setFormData]
  );

  const handleAdd = useCallback(
    (day?: number, period?: number) => {
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
    },
    [selectedClass, classes, openModal, setFormData]
  );

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subjectId = parseInt(e.target.value);
    setFormData((prev) => ({
      ...prev,
      subject_id: subjectId,
      color: getSubjectColor(subjectId),
    }));
  };

  const handleFormChange = (
    field: keyof FormData,
    value: string | number | boolean | null | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (conflictResult) {
      setConflictResult(null);
    }
  };

  const activePeriods = useMemo(() => {
    return periods.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order);
  }, [periods]);

  // Statistics
  const { totalSchedules, uniqueSubjects, uniqueTeachers } = useMemo(() => {
    return {
      totalSchedules: filteredSchedules.length,
      uniqueSubjects: new Set(filteredSchedules.map((s) => s.subject_id)).size,
      uniqueTeachers: new Set(
        filteredSchedules.filter((s) => s.teacher_name).map((s) => s.teacher_name)
      ).size,
    };
  }, [filteredSchedules]);

  const columns = useMemo<ColumnType<ClassPeriod>[]>(
    () =>
      buildCourseColumns({
        weekDays,
        getScheduleForCell,
        getPeriodTime,
        handleEdit,
        handleDelete,
        handleAdd,
      }),
    [weekDays, getScheduleForCell, getPeriodTime, handleEdit, handleDelete, handleAdd]
  );
  const viewProps: CourseScheduleViewProps = {
    schedulesError,
    exportFormat,
    setExportFormat,
    exportSchedule,
    handleAdd,
    openImportModalWithData,
    totalSchedules,
    uniqueSubjects,
    uniqueTeachers,
    classes,
    selectedClass,
    setSelectedClass,
    showClassDropdown,
    setShowClassDropdown,
    filteredSchedules,
    columns,
    activePeriods,
    isLoading,
    showModal,
    closeModal,
    editingSchedule,
    setEditingSchedule,
    conflictResult,
    setConflictResult,
    formData,
    handleFormChange,
    handleSubjectChange,
    subjects,
    weekDays,
    getPeriodTime,
    teachers,
    checkConflicts,
    submitting,
    handleSubmit,
    runSubmit,
    showImportModal,
    closeImportModalWithReset,
    importConfigs,
    selectedConfigId,
    setSelectedConfigId,
    conflictStrategy,
    setConflictStrategy,
    fileInputRef,
    handleFileChange,
    importFile,
    setImportFile,
    importResult,
    isImporting,
    handleImport,
    showToast,
  };

  return viewProps;
}
