import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck } from 'lucide-react';
import api from '../services/api';
import {
  useStableToast,
  useSubmitGuard,
  useAutoSave,
  useWorkbenchClass,
  useListData,
  useClientFilter,
} from '../hooks';
import type { ColumnType } from '../components';
import type {
  Attendance,
  AttendanceRecordInput,
  LeaveApplication,
  LeaveApplyInput,
  AttendanceStats,
} from '../types';
import type { QuickRecordForm, LeaveFormData, AttendanceDraft } from './attendanceManage/types';
import AttendanceManageView from './attendanceManage/AttendanceManageView';

const defaultQuickRecord: QuickRecordForm = {
  class_id: 0,
  student_id: 0,
  date: new Date().toISOString().split('T')[0],
  period: '上午',
  status: 'present',
};

const defaultLeaveForm: LeaveFormData = {
  student_id: 0,
  leave_type: 'personal',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date().toISOString().split('T')[0],
  reason: '',
};

function AttendanceManage() {
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [leavesError, setLeavesError] = useState(false);
  const [leavesTotal, setLeavesTotal] = useState(0);
  const [leavesPage, setLeavesPage] = useState(1);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  // M9 P1: 服务端分页状态（考勤记录列表）
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceTotal, setAttendanceTotal] = useState(0);
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
      const resp = await api.attendance.getAll(filterClassId || undefined, undefined, undefined, {
        page: attendancePage,
        per_page: 50,
      });
      setAttendanceTotal(resp.total);
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
  }, [
    leaveForm,
    showToast,
    handleCloseLeaveModal,
    fetchLeaves,
    validateLeaveForm,
    submitting,
    clearDraft,
  ]);

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
    <AttendanceManageView
      draftAvailable={draftAvailable}
      handleRestoreDraft={handleRestoreDraft}
      handleDiscardDraft={handleDiscardDraft}
      stats={stats}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      showLeavesPanel={showLeavesPanel}
      setShowLeavesPanel={setShowLeavesPanel}
      pendingLeaves={pendingLeaves}
      handleOpenLeaveModal={handleOpenLeaveModal}
      handleOpenRecordModal={handleOpenRecordModal}
      leavesError={leavesError}
      leavesPage={leavesPage}
      leavesTotal={leavesTotal}
      setLeavesPage={setLeavesPage}
      handleApproveLeave={handleApproveLeave}
      columns={columns}
      filteredAttendances={filteredAttendances}
      isLoading={isLoading}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterStatus={filterStatus}
      setFilterStatus={setFilterStatus}
      attendancePage={attendancePage}
      attendanceTotal={attendanceTotal}
      setAttendancePage={setAttendancePage}
      showRecordModal={showRecordModal}
      closeRecordModal={handleCloseRecordModal}
      recordForm={recordForm}
      setRecordForm={setRecordForm}
      handleBatchRecord={handleBatchRecord}
      handleRecordSubmit={handleRecordSubmit}
      showLeaveModal={showLeaveModal}
      closeLeaveModal={handleCloseLeaveModal}
      leaveForm={leaveForm}
      setLeaveForm={setLeaveForm}
      handleLeaveSubmit={handleLeaveSubmit}
      errors={errors}
      submitting={submitting}
      runSubmit={runSubmit}
    />
  );
}

export default AttendanceManage;
