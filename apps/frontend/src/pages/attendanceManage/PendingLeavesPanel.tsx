import { Pagination } from 'antd';
import { AlertCircle, X } from 'lucide-react';
import type { LeaveApplication } from '../../types';
import type { RunSubmit } from './types';

interface PendingLeavesPanelProps {
  leavesError: boolean;
  pendingLeaves: LeaveApplication[];
  submitting: boolean;
  handleApproveLeave: (leaveId: number, approve: boolean) => void;
  runSubmit: RunSubmit;
  setShowLeavesPanel: (v: boolean) => void;
  leavesPage: number;
  leavesTotal: number;
  setLeavesPage: (p: number) => void;
}

export default function PendingLeavesPanel({
  leavesError,
  pendingLeaves,
  submitting,
  handleApproveLeave,
  runSubmit,
  setShowLeavesPanel,
  leavesPage,
  leavesTotal,
  setLeavesPage,
}: PendingLeavesPanelProps) {
  return (
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
  );
}
