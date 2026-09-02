import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pagination } from 'antd';
import {
  Calendar,
  UserCheck,
  Clock,
  FileText,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Check,
  Filter,
  Briefcase,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { useAutoSave } from '../hooks/useAutoSave';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import WorkbenchBreadcrumb from '../components/workbench/WorkbenchBreadcrumb';
import { ClassSelect, StudentSelect } from '../components/form/EntitySelect';
import { DataTable, StatCard, DateRangeField } from '../components';
import { useListData, useClientFilter } from '../hooks';
import type { ColumnType } from '../components/data-display/DataTable';
import {
  Attendance,
  AttendanceRecordInput,
  LeaveApplication,
  LeaveApplyInput,
  AttendanceStats,
} from '../types';

interface QuickRecordForm {
  class_id: number;
  student_id: number;
  date: string;
  period: string;
  status: string;
}

const defaultQuickRecord: QuickRecordForm = {
  class_id: 0,
  student_id: 0,
  date: new Date().toISOString().split('T')[0],
  period: '上午',
  status: 'present',
};

interface LeaveFormData {
  student_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

const defaultLeaveForm: LeaveFormData = {
  student_id: 0,
  leave_type: 'personal',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date().toISOString().split('T')[0],
  reason: '',
};

// M3: 考勤录入草稿（记录/请假表单 + 当前打开的弹窗）
interface AttendanceDraft {
  recordForm: QuickRecordForm;
  leaveForm: LeaveFormData;
  activeModal: 'record' | 'leave' | null;
}

function AttendanceManage() {
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [leavesError, setLeavesError] = useState(false);
  const [leavesTotal, setLeavesTotal] = useState(0);
  const [leavesPage, setLeavesPage] = useState(1);
  const [leavesPages, setLeavesPages] = useState(1);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  // M9 P1: 服务端分页状态（考勤记录列表）
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceTotal, setAttendanceTotal] = useState(0);
  const [attendancePages, setAttendancePages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [showLeavesPanel, setShowLeavesPanel] = useState<boolean>(false);
  const [recordForm, setRecordForm] = useState<QuickRecordForm>(defaultQuickRecord);
  const [leaveForm, setLeaveForm] = useState<LeaveFormData>(defaultLeaveForm);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  const {
    data: attendances,
    loading: isLoading,
    refetch: fetchAttendances,
  } = useListData<Attendance>({
    fetcher: async () => {
      // 后端 /api/attendance 支持 class_id 过滤，直接服务端筛选（M9 P1 服务端分页信封）
      const resp = await api.attendance.getAll(
        filterClassId || undefined,
        undefined,
        undefined,
        { page: attendancePage, per_page: 50 }
      );
      setAttendanceTotal(resp.total);
      setAttendancePages(resp.pages);
      setRecordForm((prev) => (prev.class_id > 0 ? prev : { ...prev, class_id: 0 }));
      return resp.records || [];
    },
    deps: [filterClassId, attendancePage],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取考勤列表失败:', e);
      showToast('error', '获取考勤列表失败');
    },
  });

  // M3: 考勤录入本地草稿——记录/请假表单 + 当前弹窗，中途刷新可恢复
  const draftData = useMemo<AttendanceDraft>(
    () => ({
      recordForm,
      leaveForm,
      activeModal: showRecordModal ? 'record' : showLeaveModal ? 'leave' : null,
    }),
    [recordForm, leaveForm, showRecordModal, showLeaveModal]
  );

  const { draftAvailable, loadDraft, restoreDraft, discardChanges, clearDraft } =
    useAutoSave<AttendanceDraft>({
      key: 'attendance-entry',
      data: draftData,
    });

  // 空草稿静默清理：两个表单均为默认值时恢复条不出现
  useEffect(() => {
    if (!draftAvailable) return;
    const d = loadDraft();
    if (
      d &&
      JSON.stringify(d.recordForm) === JSON.stringify(defaultQuickRecord) &&
      JSON.stringify(d.leaveForm) === JSON.stringify(defaultLeaveForm)
    ) {
      clearDraft();
    }
  }, [draftAvailable, loadDraft, clearDraft]);

  const handleRestoreDraft = useCallback((): void => {
    const draft = restoreDraft();
    if (!draft) return;
    setRecordForm({ ...draft.recordForm });
    setLeaveForm({ ...draft.leaveForm });
    setErrors({});
    if (draft.activeModal === 'leave') {
      setShowLeaveModal(true);
    } else {
      setShowRecordModal(true);
    }
  }, [restoreDraft]);

  const handleDiscardDraft = useCallback((): void => {
    discardChanges();
  }, [discardChanges]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.attendance.getStats(filterClassId || 0);
      setStats(data);
    } catch (error) {
      logger.error('获取考勤统计失败:', error);
      setStats(null);
      showToast('error', getErrMsg(error, '获取考勤统计失败，请稍后重试'));
    }
  }, [showToast, filterClassId]);

  const fetchLeaves = useCallback(async () => {
    try {
      // M9 P1: 服务端分页信封（leaves 资源 key）
      const resp = await api.attendance.getLeaves(undefined, undefined, {
        page: leavesPage,
        per_page: 50,
      });
      setLeaves(resp.leaves || []);
      setLeavesTotal(resp.total);
      setLeavesPages(resp.pages);
      setLeavesError(false);
    } catch (error) {
      logger.error('获取请假列表失败:', error);
      setLeavesError(true);
    }
  }, [leavesPage]);

  useEffect(() => {
    fetchStats();
    fetchLeaves();
  }, [fetchStats, fetchLeaves]);

  // M9 P1: 切换班级筛选时重置考勤分页到首页，避免空页
  useEffect(() => {
    setAttendancePage(1);
  }, [filterClassId]);

  const filteredAttendances = useClientFilter(
    attendances,
    (a) => {
      const matchesSearch =
        (a.student_name && a.student_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        a.date.includes(searchTerm);
      const matchesStatus = !filterStatus || a.status === filterStatus;
      return matchesSearch && matchesStatus;
    },
    [searchTerm, filterStatus]
  );

  const handleOpenRecordModal = useCallback(() => {
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setRecordForm({ ...defaultQuickRecord, class_id: filterClassId > 0 ? filterClassId : 0 });
    setErrors({});
    setShowRecordModal(true);
  }, [filterClassId]);

  const handleCloseRecordModal = useCallback(() => {
    setShowRecordModal(false);
    setRecordForm(defaultQuickRecord);
    setErrors({});
  }, []);

  const validateRecordForm = useCallback((): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!recordForm.class_id || recordForm.class_id <= 0) newErrors.class_id = '请输入班级 ID';
    if (!recordForm.student_id || recordForm.student_id <= 0)
      newErrors.student_id = '请输入学生 ID';
    if (!recordForm.date) newErrors.date = '请选择日期';
    if (!recordForm.status) newErrors.status = '请选择状态';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [recordForm]);

  const handleRecordSubmit = useCallback(async () => {
    if (!validateRecordForm()) return;
    if (submitting) return; // M2: 防重复提交
    setSubmitting(true);

    try {
      const data: AttendanceRecordInput = {
        class_id: recordForm.class_id,
        student_id: recordForm.student_id,
        date: recordForm.date,
        period: recordForm.period,
        status: recordForm.status,
      };
      await api.attendance.record(data);
      showToast('success', '考勤记录成功');
      clearDraft();
      handleCloseRecordModal();
      fetchAttendances();
      fetchStats();
    } catch (error) {
      logger.error('记录失败:', error);
      showToast('error', getErrMsg(error, '考勤记录失败'));
    } finally {
      setSubmitting(false);
    }
  }, [
    recordForm,
    showToast,
    handleCloseRecordModal,
    fetchAttendances,
    fetchStats,
    validateRecordForm,
    submitting,
    clearDraft,
  ]);

  const handleBatchRecord = useCallback(
    async (status: string) => {
      // M11: 批量操作按班级生效——需班级+日期+节次；不再要求单个学生
      if (!recordForm.class_id) {
        showToast('warning', '请先选择班级');
        return;
      }
      if (!recordForm.date || !recordForm.period) {
        showToast('warning', '请选择日期与节次');
        return;
      }
      if (submitting) return; // 防连点
      setSubmitting(true);
      try {
        const usersRes = await api.users.getAll({
          class_id: Number(recordForm.class_id),
          per_page: 500,
          skipCache: true,
        });
        const userList = Array.isArray(usersRes)
          ? usersRes
          : (usersRes as { users?: { id: number; role: string }[] }).users || [];
        const students = userList.filter((u) => u.role === 'student');
        if (students.length === 0) {
          showToast('warning', '该班级暂无学生，无法批量记录');
          return;
        }
        const records: AttendanceRecordInput[] = students.map((u) => ({
          class_id: recordForm.class_id,
          student_id: Number(u.id),
          date: recordForm.date,
          period: recordForm.period,
          status,
        }));
        await api.attendance.batchRecord(records);
        showToast(
          'success',
          `已批量记录 ${students.length} 名学生${status === 'present' ? '出勤' : '缺勤'}`
        );
        clearDraft();
        fetchAttendances();
        fetchStats();
      } catch (error) {
        logger.error('批量记录失败:', error);
        showToast('error', getErrMsg(error, '批量记录失败'));
      } finally {
        setSubmitting(false);
      }
    },
    [recordForm, submitting, showToast, fetchAttendances, fetchStats, clearDraft]
  );

  const handleOpenLeaveModal = useCallback(() => {
    setLeaveForm(defaultLeaveForm);
    setErrors({});
    setShowLeaveModal(true);
  }, []);

  const handleCloseLeaveModal = useCallback(() => {
    setShowLeaveModal(false);
    setLeaveForm(defaultLeaveForm);
    setErrors({});
  }, []);

  const validateLeaveForm = useCallback((): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!leaveForm.student_id || leaveForm.student_id <= 0) newErrors.student_id = '请输入学生 ID';
    if (!leaveForm.start_date) newErrors.start_date = '请选择开始日期';
    if (!leaveForm.end_date) newErrors.end_date = '请选择结束日期';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [leaveForm]);

  const handleLeaveSubmit = useCallback(async () => {
    if (!validateLeaveForm()) return;
    if (submitting) return; // M2: 防重复提交
    setSubmitting(true);

    try {
      const data: LeaveApplyInput = {
        student_id: leaveForm.student_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason,
      };
      await api.attendance.applyLeave(data);
      showToast('success', '请假申请已提交');
      clearDraft();
      handleCloseLeaveModal();
      fetchLeaves();
    } catch (error) {
      logger.error('提交失败:', error);
      showToast('error', getErrMsg(error, '提交请假申请失败'));
    } finally {
      setSubmitting(false);
    }
  }, [leaveForm, showToast, handleCloseLeaveModal, fetchLeaves, validateLeaveForm, submitting, clearDraft]);

  const handleApproveLeave = useCallback(
    async (leaveId: number, approve: boolean) => {
      try {
        await api.attendance.approveLeave(leaveId, approve);
        showToast('success', approve ? '请假已批准' : '请假已驳回');
        fetchLeaves();
      } catch (error) {
        logger.error('审批失败:', error);
        showToast('error', getErrMsg(error, '审批操作失败'));
      }
    },
    [showToast, fetchLeaves]
  );

  const getStatusBadge = useCallback((status: string) => {
    const config: Record<string, { bg: string; dot: string; text: string; label: string }> = {
      present: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/30',
        dot: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        label: '出勤',
      },
      absent: {
        bg: 'bg-red-50 dark:bg-red-900/30',
        dot: 'bg-red-500',
        text: 'text-red-600 dark:text-red-400',
        label: '缺勤',
      },
      late: {
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        dot: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        label: '迟到',
      },
      leave: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        dot: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        label: '请假',
      },
      unknown: {
        bg: 'bg-gray-50 dark:bg-gray-800',
        dot: 'bg-gray-400',
        text: 'text-gray-600 dark:text-gray-400',
        label: '未知',
      },
    };
    const c = config[status] || config.unknown;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${c.dot}`} />
        {c.label}
      </span>
    );
  }, []);

  const columns = useMemo<ColumnType<Attendance>[]>(
    () => [
      {
        title: '学生',
        key: 'student',
        render: (_value, record) => (
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center'>
              <UserCheck className='w-5 h-5 text-emerald-600 dark:text-emerald-400' />
            </div>
            <div>
              <p className='font-medium text-slate-800 dark:text-slate-200'>
                {record.student_name || `学生 #${record.student_id}`}
              </p>
              <p className='text-xs text-slate-400 dark:text-slate-500'>
                {record.class_name || `班级 #${record.class_id}`}
              </p>
            </div>
          </div>
        ),
      },
      {
        title: '日期',
        key: 'date',
        dataIndex: 'date',
        render: (value) => (
          <span className='text-sm text-slate-600 dark:text-slate-300'>{value as string}</span>
        ),
      },
      {
        title: '时段',
        key: 'period',
        dataIndex: 'period',
        render: (value) => (
          <span className='text-sm text-slate-600 dark:text-slate-300'>{value as string}</span>
        ),
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'status',
        align: 'center',
        render: (value) => getStatusBadge(value as string),
      },
      {
        title: '备注',
        key: 'notes',
        dataIndex: 'notes',
        render: (value) => (
          <span className='text-sm text-slate-500 dark:text-slate-400'>
            {value ? (value as string) : '-'}
          </span>
        ),
      },
    ],
    [getStatusBadge]
  );

  const pendingLeaves = leaves.filter((l) => l.status === 'pending');

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {draftAvailable && (
        <div className='px-6 pt-5'>
          <div className='flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm'>
            <span className='text-amber-800'>检测到上次未提交的内容，是否恢复？</span>
            <div className='flex items-center gap-2'>
              <button
                onClick={handleRestoreDraft}
                className='px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-xs'
              >
                恢复
              </button>
              <button
                onClick={handleDiscardDraft}
                className='px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs'
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
              <Calendar className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                考勤管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>记录考勤、请假审批与统计</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='考勤管理' />
            <CurrentClassLabel />
            {pendingLeaves.length > 0 && (
              <button
                onClick={() => setShowLeavesPanel(!showLeavesPanel)}
                className='relative flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl hover:shadow-md transition-all font-medium'
              >
                <AlertCircle className='w-5 h-5' />
                <span>待审批</span>
                <span className='absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center'>
                  {pendingLeaves.length}
                </span>
              </button>
            )}
            <button
              onClick={handleOpenLeaveModal}
              className='flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <FileText className='w-5 h-5' />
              请假申请
            </button>
            <button
              onClick={handleOpenRecordModal}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              快速记录
            </button>
          </div>
        </div>
      </div>

      <div className='px-6 py-5'>
        <div className='grid grid-cols-2 md:grid-cols-5 gap-4 mb-5'>
          <StatCard
            size='sm'
            label='出勤'
            value={stats ? stats.present : '—'}
            icon={<CheckCircle className='w-6 h-6 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
          />
          <StatCard
            size='sm'
            label='缺勤'
            value={stats ? stats.absent : '—'}
            icon={<XCircle className='w-6 h-6 text-white' />}
            iconGradient='from-red-500 to-pink-500'
            decoGradient='from-red-500/10 to-pink-500/10'
          />
          <StatCard
            size='sm'
            label='迟到'
            value={stats ? stats.late : '—'}
            icon={<Clock className='w-6 h-6 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
          />
          <StatCard
            size='sm'
            label='请假'
            value={stats ? stats.leave : '—'}
            icon={<Briefcase className='w-6 h-6 text-white' />}
            iconGradient='from-blue-500 to-indigo-500'
            decoGradient='from-blue-500/10 to-indigo-500/10'
          />
          <StatCard
            size='sm'
            label='出勤率'
            value={stats ? `${(stats.attendance_rate * 100).toFixed(1)}%` : '—'}
            icon={<UserCheck className='w-6 h-6 text-white' />}
            iconGradient='from-purple-500 to-pink-500'
            decoGradient='from-purple-500/10 to-pink-500/10'
            className='col-span-2 md:col-span-1'
          />
        </div>
      </div>

      {showLeavesPanel && (
        <div className='px-6 pb-4'>
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-amber-200/50 dark:border-amber-800/50 overflow-hidden'>
            <div className='px-5 py-4 border-b border-amber-100 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-between'>
              <h3 className='flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200'>
                <AlertCircle className='w-5 h-5' />
                待审批请假申请
              </h3>
              <button
                onClick={() => setShowLeavesPanel(false)}
                aria-label='关闭待审批面板'
                className='p-1 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
            <div className='divide-y divide-amber-50 dark:divide-amber-900/30'>
              {leavesError ? (
                <div className='px-5 py-8 text-center'>
                  <p className='text-amber-600 dark:text-amber-400 font-medium'>请假列表加载失败</p>
                  <p className='text-sm text-slate-500 dark:text-slate-400 mt-1'>请刷新页面重试</p>
                </div>
              ) : pendingLeaves.length === 0 ? (
                <div className='px-5 py-8 text-center text-slate-500 dark:text-slate-400'>
                  暂无待审批的请假申请
                </div>
              ) : (
                pendingLeaves.map((leave) => (
                  <div key={leave.id} className='px-5 py-4 flex items-center justify-between'>
                    <div>
                      <p className='font-medium text-slate-800 dark:text-slate-200'>
                        {leave.student_name || `学生 #${leave.student_id}`}
                      </p>
                      <p className='text-sm text-slate-500 dark:text-slate-400'>
                        {leave.leave_type} · {leave.start_date} 至 {leave.end_date}
                        {leave.reason && ` · ${leave.reason}`}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => runSubmit(() => handleApproveLeave(leave.id, false))}
                        disabled={submitting}
                        className='px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors font-medium'
                      >
                        驳回
                      </button>
                      <button
                        onClick={() => runSubmit(() => handleApproveLeave(leave.id, true))}
                        disabled={submitting}
                        className='px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors font-medium'
                      >
                        批准
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {leavesTotal > 50 && (
              <div className='px-5 py-4 flex justify-center border-t border-amber-100 dark:border-amber-900/50'>
                <Pagination
                  current={leavesPage}
                  total={leavesTotal}
                  pageSize={50}
                  onChange={(p) => setLeavesPage(p)}
                  showSizeChanger={false}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className='flex-1 px-6 pb-6'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center gap-4 flex-wrap'>
              <div className='relative flex-1 max-w-md'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
                <input
                  type='text'
                  aria-label='搜索考勤记录'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder='搜索学生姓名或日期...'
                  className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
                />
              </div>
              <div className='relative'>
                <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className='pl-9 pr-8 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm appearance-none'
                >
                  <option value=''>全部状态</option>
                  <option value='present'>出勤</option>
                  <option value='absent'>缺勤</option>
                  <option value='late'>迟到</option>
                  <option value='leave'>请假</option>
                </select>
              </div>
            </div>
          </div>

          <DataTable<Attendance>
            columns={columns}
            dataSource={filteredAttendances}
            loading={isLoading}
            rowKey='id'
            empty={{
              icon: 'data',
              title: '暂无考勤数据',
            }}
          />
          {attendanceTotal > 50 && (
            <div className='px-5 py-4 flex justify-center border-t border-slate-200/50 dark:border-slate-700/50'>
              <Pagination
                current={attendancePage}
                total={attendanceTotal}
                pageSize={50}
                onChange={(p) => setAttendancePage(p)}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      </div>

      {showRecordModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseRecordModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                    <UserCheck className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    快速考勤记录
                  </h3>
                </div>
                <button
                  onClick={handleCloseRecordModal}
                  aria-label='关闭考勤记录弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    班级 <span className='text-red-500'>*</span>
                  </label>
                  <ClassSelect
                    value={recordForm.class_id}
                    onChange={(id) => setRecordForm((prev) => ({ ...prev, class_id: id }))}
                    emptyPlaceholder='暂无班级'
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                      errors.class_id
                        ? 'border-red-500'
                        : 'border-slate-200 dark:border-slate-600 focus:border-emerald-500'
                    }`}
                  />
                  {errors.class_id && (
                    <p className='mt-1 text-xs text-red-500'>{errors.class_id}</p>
                  )}
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    学生 <span className='text-red-500'>*</span>
                  </label>
                  <StudentSelect
                    value={recordForm.student_id}
                    onChange={(id) => setRecordForm((prev) => ({ ...prev, student_id: id }))}
                    allowEmpty
                    emptyLabel='请选择学生'
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                      errors.student_id
                        ? 'border-red-500'
                        : 'border-slate-200 dark:border-slate-600 focus:border-emerald-500'
                    }`}
                  />
                  {errors.student_id && (
                    <p className='mt-1 text-xs text-red-500'>{errors.student_id}</p>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    日期
                  </label>
                  <input
                    type='date'
                    value={recordForm.date}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, date: e.target.value }))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-800 dark:text-slate-100 focus:border-emerald-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    时段
                  </label>
                  <select
                    value={recordForm.period}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, period: e.target.value }))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-800 dark:text-slate-100 focus:border-emerald-500'
                  >
                    <option value='上午'>上午</option>
                    <option value='下午'>下午</option>
                    <option value='晚上'>晚上</option>
                  </select>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  状态
                </label>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                  {/* 窄屏 2 列，防挤压 */}
                  {[
                    {
                      value: 'present',
                      label: '出勤',
                      active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
                    },
                    {
                      value: 'absent',
                      label: '缺勤',
                      active: 'bg-red-500 text-white shadow-lg shadow-red-500/25',
                    },
                    {
                      value: 'late',
                      label: '迟到',
                      active: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25',
                    },
                    {
                      value: 'leave',
                      label: '请假',
                      active: 'bg-blue-500 text-white shadow-lg shadow-blue-500/25',
                    },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setRecordForm((prev) => ({ ...prev, status: s.value }))}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                        recordForm.status === s.value
                          ? s.active
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  批量操作
                </label>
                <div className='flex gap-2'>
                  <button
                    onClick={() => runSubmit(() => handleBatchRecord('present'))}
                    disabled={submitting}
                    className='flex-1 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all text-sm font-medium'
                  >
                    批量出勤
                  </button>
                  <button
                    onClick={() => runSubmit(() => handleBatchRecord('absent'))}
                    disabled={submitting}
                    className='flex-1 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-all text-sm font-medium'
                  >
                    批量缺勤
                  </button>
                </div>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseRecordModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleRecordSubmit)}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存记录'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseLeaveModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <FileText className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>请假申请</h3>
                </div>
                <button
                  onClick={handleCloseLeaveModal}
                  aria-label='关闭请假申请弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  学生 <span className='text-red-500'>*</span>
                </label>
                <StudentSelect
                  value={leaveForm.student_id}
                  onChange={(id) => setLeaveForm((prev) => ({ ...prev, student_id: id }))}
                  allowEmpty
                  emptyLabel='请选择学生'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                    errors.student_id
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />
                {errors.student_id && (
                  <p className='mt-1 text-xs text-red-500'>{errors.student_id}</p>
                )}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  请假类型
                </label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) =>
                    setLeaveForm((prev) => ({ ...prev, leave_type: e.target.value }))
                  }
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100'
                >
                  <option value='personal'>事假</option>
                  <option value='sick'>病假</option>
                  <option value='bereavement'>丧假</option>
                  <option value='maternity'>产假</option>
                  <option value='other'>其他</option>
                </select>
              </div>

              <DateRangeField
                startValue={leaveForm.start_date}
                endValue={leaveForm.end_date}
                onStartChange={(v) => setLeaveForm((prev) => ({ ...prev, start_date: v }))}
                onEndChange={(v) => setLeaveForm((prev) => ({ ...prev, end_date: v }))}
                startError={errors.start_date}
                endError={errors.end_date}
                focusColor='focus:ring-blue-500/50'
                alwaysClass='transition-all'
                okClass='focus:border-blue-500'
              />

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  请假原因
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder='请输入请假原因'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500'
                />
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseLeaveModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleLeaveSubmit)}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceManage;
