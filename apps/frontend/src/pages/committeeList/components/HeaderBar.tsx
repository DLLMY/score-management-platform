// T12-6 拆分（2026-09-12）：自 CommitteeListView.tsx 原样搬出，行为逐字节等价。
import { Award, History, Plus } from 'lucide-react';
import { ClassSelect, WorkbenchBreadcrumb, CurrentClassLabel } from '../../../components';
import type { CommitteeListViewProps } from '../types';

export function HeaderBar({
  filterClassId,
  setFilterClassId,
  openTermModal,
  openCreateModal,
}: CommitteeListViewProps) {
  return (
    <>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/20'>
              <Award className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                班委名单管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级班委职位、任期与评价
              </p>
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
            <WorkbenchBreadcrumb current='班委名单管理' />
            <CurrentClassLabel />
            <button
              onClick={openTermModal}
              className='flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:shadow-md transition-all font-medium'
            >
              <History className='w-4 h-4' />
              任期管理
            </button>
            <button
              onClick={openCreateModal}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              添加班委
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
