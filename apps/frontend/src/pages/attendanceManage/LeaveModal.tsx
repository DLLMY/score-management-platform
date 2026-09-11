import { FileText, X, Check } from 'lucide-react';
import { StudentSelect, DateRangeField } from '../../components';
import type { LeaveFormData, SetLeaveForm, RunSubmit } from './types';

interface LeaveModalProps {
  closeLeaveModal: () => void;
  leaveForm: LeaveFormData;
  setLeaveForm: SetLeaveForm;
  errors: Partial<Record<string, string>>;
  submitting: boolean;
  handleLeaveSubmit: () => void;
  runSubmit: RunSubmit;
}

export default function LeaveModal({
  closeLeaveModal,
  leaveForm,
  setLeaveForm,
  errors,
  submitting,
  handleLeaveSubmit,
  runSubmit,
}: LeaveModalProps) {
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={closeLeaveModal}
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
              onClick={closeLeaveModal}
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
            {errors.student_id && <p className='mt-1 text-xs text-red-500'>{errors.student_id}</p>}
          </div>

          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              请假类型
            </label>
            <select
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm((prev) => ({ ...prev, leave_type: e.target.value }))}
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
            onClick={closeLeaveModal}
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
  );
}
