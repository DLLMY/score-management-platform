import { UserCheck, X, Check } from 'lucide-react';
import { ClassSelect, StudentSelect } from '../../components';
import type { QuickRecordForm, SetRecordForm, RunSubmit } from './types';

interface RecordModalProps {
  closeRecordModal: () => void;
  recordForm: QuickRecordForm;
  setRecordForm: SetRecordForm;
  errors: Partial<Record<string, string>>;
  submitting: boolean;
  handleBatchRecord: (status: string) => void;
  handleRecordSubmit: () => void;
  runSubmit: RunSubmit;
}

export default function RecordModal({
  closeRecordModal,
  recordForm,
  setRecordForm,
  errors,
  submitting,
  handleBatchRecord,
  handleRecordSubmit,
  runSubmit,
}: RecordModalProps) {
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={closeRecordModal}
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
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>快速考勤记录</h3>
            </div>
            <button
              onClick={closeRecordModal}
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
              {errors.class_id && <p className='mt-1 text-xs text-red-500'>{errors.class_id}</p>}
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
            onClick={closeRecordModal}
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
  );
}
