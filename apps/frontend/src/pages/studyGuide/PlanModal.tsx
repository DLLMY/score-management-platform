import { Target, X, Check, User } from 'lucide-react';
import { StudentSelect, SubjectSelect } from '../../components';
import type { PlanFormData, RunSubmit } from './types';

interface PlanModalProps {
  closePlanModal: () => void;
  planForm: PlanFormData;
  handlePlanChange: (field: keyof PlanFormData, value: string | number | null) => void;
  planErrors: Record<string, string>;
  handlePlanSubmit: () => void;
  runSubmit: RunSubmit;
  editingPlanId: number | null;
  planTypes: string[];
  submitting: boolean;
}

export default function PlanModal({
  closePlanModal,
  planForm,
  handlePlanChange,
  planErrors,
  handlePlanSubmit,
  runSubmit,
  editingPlanId,
  planTypes,
  submitting,
}: PlanModalProps) {
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={closePlanModal}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-900/20 dark:to-slate-800'>
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500' />
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center'>
                <Target className='w-5 h-5 text-white' />
              </div>
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                {editingPlanId ? '编辑改进计划' : '创建改进计划'}
              </h3>
            </div>
            <button
              onClick={closePlanModal}
              aria-label='关闭改进计划弹窗'
              className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto'>
          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              学生 <span className='text-red-500'>*</span>
            </label>
            <div className='relative'>
              <User className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
              <StudentSelect
                value={planForm.student_id}
                onChange={(id) => handlePlanChange('student_id', id)}
                allowEmpty
                emptyLabel='请选择学生'
                className={`w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100 ${
                  planErrors.student_id
                    ? 'border-red-500'
                    : 'border-slate-200 dark:border-slate-600 focus:border-cyan-500'
                }`}
              />
            </div>
            {planErrors.student_id && (
              <p className='mt-1 text-xs text-red-500'>{planErrors.student_id}</p>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                计划类型
              </label>
              <select
                value={planForm.plan_type}
                onChange={(e) => handlePlanChange('plan_type', e.target.value)}
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
              >
                {planTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                科目
              </label>
              <SubjectSelect
                value={planForm.subject_id ?? null}
                onChange={(id) => handlePlanChange('subject_id', id || null)}
                allowEmpty
                emptyLabel='不指定科目'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                当前分数
              </label>
              <input
                type='number'
                value={planForm.current_score ?? ''}
                onChange={(e) =>
                  handlePlanChange('current_score', e.target.value ? Number(e.target.value) : null)
                }
                placeholder='当前分数'
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
              />
            </div>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                目标分数
              </label>
              <input
                type='number'
                value={planForm.target_score ?? ''}
                onChange={(e) =>
                  handlePlanChange('target_score', e.target.value ? Number(e.target.value) : null)
                }
                placeholder='目标分数'
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
              />
            </div>
          </div>

          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              计划内容 <span className='text-red-500'>*</span>
            </label>
            <textarea
              value={planForm.plan_content}
              onChange={(e) => handlePlanChange('plan_content', e.target.value)}
              placeholder='输入改进计划的详细内容'
              rows={4}
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 ${
                planErrors.plan_content
                  ? 'border-red-500'
                  : 'border-slate-200 dark:border-slate-600 focus:border-cyan-500'
              }`}
            />
            {planErrors.plan_content && (
              <p className='mt-1 text-xs text-red-500'>{planErrors.plan_content}</p>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                开始日期
              </label>
              <input
                type='date'
                value={planForm.start_date}
                onChange={(e) => handlePlanChange('start_date', e.target.value)}
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
              />
            </div>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                结束日期
              </label>
              <input
                type='date'
                value={planForm.end_date}
                onChange={(e) => handlePlanChange('end_date', e.target.value)}
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSubmit(handlePlanSubmit);
          }} /* L8: 支持回车提交（经 run 防重） */
          className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'
        >
          <button
            type='button'
            onClick={closePlanModal}
            className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
          >
            取消
          </button>
          <button
            type='submit'
            disabled={submitting}
            className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Check className='w-5 h-5' />
            {submitting ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
