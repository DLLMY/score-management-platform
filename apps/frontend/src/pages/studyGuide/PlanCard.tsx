import { TrendingUp, Edit2, Trash2, Calendar } from 'lucide-react';
import type { ImprovementPlan } from '../../types';

interface PlanCardProps {
  plan: ImprovementPlan;
  index: number;
  getProgressColor: (progress: number) => string;
  getProgressBg: (progress: number) => string;
  setEditingPlanId: (id: number | null) => void;
  handleOpenPlanEdit: (plan: ImprovementPlan) => void;
  handleDeletePlan: (planId: number) => void;
  handleUpdateProgress: (planId: number, progress: number) => void;
}

export default function PlanCard({
  plan,
  index,
  getProgressColor,
  getProgressBg,
  setEditingPlanId,
  handleOpenPlanEdit,
  handleDeletePlan,
  handleUpdateProgress,
}: PlanCardProps) {
  return (
    <div
      className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5 hover:shadow-md transition-all duration-300 group'
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-center gap-3'>
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getProgressColor(
              plan.progress
            )} flex items-center justify-center shadow-lg`}
          >
            <TrendingUp className='w-5 h-5 text-white' />
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <h3 className='font-semibold text-slate-800 dark:text-slate-100'>
                {plan.student_name || `学生 #${plan.student_id}`}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getProgressBg(plan.progress)}`}>
                {plan.plan_type || '未分类'}
              </span>
            </div>
            <p className='text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5'>
              {plan.plan_content}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity'>
          <button
            onClick={() => {
              setEditingPlanId(plan.id);
              handleOpenPlanEdit(plan);
            }}
            className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
            title='编辑'
          >
            <Edit2 className='w-4 h-4' />
          </button>
          <button
            onClick={() => handleDeletePlan(plan.id)}
            className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
            title='删除'
          >
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </div>

      <div className='flex items-center gap-4 mb-3'>
        <div className='flex-1'>
          <div className='flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1'>
            <span>完成进度</span>
            <span className='font-medium'>{plan.progress}%</span>
          </div>
          <div className='h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden'>
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(
                plan.progress
              )} rounded-full transition-all duration-500`}
              style={{ width: `${plan.progress}%` }}
            />
          </div>
        </div>
        <div className='flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400'>
          {plan.current_score !== undefined && plan.current_score !== null && (
            <span>
              当前:{' '}
              <span className='font-medium text-slate-700 dark:text-slate-200'>
                {plan.current_score}
              </span>
            </span>
          )}
          {plan.target_score !== undefined && plan.target_score !== null && (
            <span>
              目标:{' '}
              <span className='font-medium text-slate-700 dark:text-slate-200'>
                {plan.target_score}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className='flex items-center gap-2 flex-wrap'>
        {[0, 25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => handleUpdateProgress(plan.id, p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              plan.progress === p
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {p}%
          </button>
        ))}
        {plan.start_date && (
          <div className='flex items-center gap-1 text-xs text-slate-400 ml-auto'>
            <Calendar className='w-3 h-3' />
            <span>{plan.start_date}</span>
            {plan.end_date && <span> ~ {plan.end_date}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
