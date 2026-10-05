import { getErrMsg } from '../utils/getErrMsg';
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, XCircle } from 'lucide-react';
import api, { PhoneBoxLeave } from '../services/api';
import { Button, Card, PermissionGuard, WorkbenchBreadcrumb } from '../components';
import { formatDateTime } from '../utils/format';
import { useStableToast, useSubmitGuard } from '../hooks';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: '病假',
  personal: '事假',
  other: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '生效中',
  cancelled: '已取消',
  expired: '已过期',
  rejected: '已驳回',
};

const CANCELLABLE = new Set(['pending', 'approved']);

const leaveTypeLabel = (t: string): string => LEAVE_TYPE_LABELS[t] ?? t;
const statusLabel = (s: string): string => STATUS_LABELS[s] ?? s;

const LeaveManagementInner: React.FC = () => {
  const { showToast } = useStableToast();
  const { submitting, run: runSubmit } = useSubmitGuard();

  const [active, setActive] = useState<PhoneBoxLeave[]>([]);
  const [pending, setPending] = useState<PhoneBoxLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, p] = await Promise.all([api.leave.getActive(), api.leave.getPending()]);
      setActive(a);
      setPending(p);
    } catch (err) {
      setError(getErrMsg(err, '加载请假数据失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = (leave: PhoneBoxLeave) => {
    if (
      !window.confirm(
        `确认代销假？学生「${leave.user_name ?? leave.student_id}」的该请假将被取消。`
      )
    ) {
      return;
    }
    runSubmit(async () => {
      try {
        await api.leave.cancel(leave.id);
        showToast('success', '已代销假');
        await load();
      } catch (err) {
        showToast('error', getErrMsg(err, '代销假失败'));
      }
    });
  };

  const renderLeave = (leave: PhoneBoxLeave) => {
    const cancellable = CANCELLABLE.has(leave.status);
    return (
      <div key={leave.id} className='flex items-center justify-between px-5 py-4'>
        <div>
          <p className='font-medium text-gray-800 dark:text-slate-200'>
            {leave.user_name ?? `学生 #${leave.student_id}`}
          </p>
          <p className='text-sm text-gray-500 dark:text-slate-400'>
            {leaveTypeLabel(leave.leave_type)} · {formatDateTime(leave.start_time)} 至{' '}
            {formatDateTime(leave.end_time)}
            {leave.reason ? ` · ${leave.reason}` : ''}
          </p>
          {leave.device_id && (
            <p className='text-xs text-gray-400 mt-0.5'>设备 {leave.device_id}</p>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'>
            {statusLabel(leave.status)}
          </span>
          {cancellable && (
            <Button variant='outline' disabled={submitting} onClick={() => handleCancel(leave)}>
              <XCircle className='w-4 h-4 mr-1' /> 代销假
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='p-6 max-w-4xl mx-auto space-y-6'>
      <WorkbenchBreadcrumb current='请假管理' />
      <div className='flex items-center gap-3'>
        <Calendar className='w-7 h-7 text-primary-600' />
        <div>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-slate-100'>请假管理</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400'>
            查看硬件端提交的请假（生效中 / 待审批），并可代销假。
          </p>
        </div>
      </div>

      {loading ? (
        <Card className='p-8 text-center text-gray-400'>加载中…</Card>
      ) : error ? (
        <Card className='p-8 text-center'>
          <p className='text-red-500'>{error}</p>
          <Button variant='outline' className='mt-3' onClick={() => load()}>
            重试
          </Button>
        </Card>
      ) : (
        <>
          <Card className='p-5'>
            <h2 className='text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2'>
              生效中的请假（{active.length}）
            </h2>
            {active.length === 0 ? (
              <p className='text-sm text-gray-400 py-4'>当前没有生效中的请假</p>
            ) : (
              <div className='divide-y divide-gray-100 dark:divide-slate-700'>
                {active.map(renderLeave)}
              </div>
            )}
          </Card>

          <Card className='p-5'>
            <h2 className='text-lg font-semibold text-gray-800 dark:text-slate-100 mb-2'>
              待审批的请假（{pending.length}）
            </h2>
            {pending.length === 0 ? (
              <p className='text-sm text-gray-400 py-4'>暂无待审批的请假</p>
            ) : (
              <div className='divide-y divide-gray-100 dark:divide-slate-700'>
                {pending.map(renderLeave)}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

const LeaveManagement: React.FC = () => (
  <PermissionGuard requiredPermission='phonebox.unlock.manage'>
    <LeaveManagementInner />
  </PermissionGuard>
);

export default LeaveManagement;
