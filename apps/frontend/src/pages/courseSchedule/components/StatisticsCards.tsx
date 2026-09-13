// T12-4 拆分（2026-09-12）：自 CourseScheduleView.tsx 原样搬出，行为逐字节等价。
import { Building2, User, ClipboardList, Table } from 'lucide-react';
import type { CourseScheduleViewProps } from '../types';

export function StatisticsCards({
  totalSchedules,
  uniqueSubjects,
  uniqueTeachers,
  classes,
}: CourseScheduleViewProps) {
  return (
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
              <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                {totalSchedules}
              </p>
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
              <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                {uniqueSubjects}
              </p>
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
              <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                {uniqueTeachers}
              </p>
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
              <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                {classes.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
