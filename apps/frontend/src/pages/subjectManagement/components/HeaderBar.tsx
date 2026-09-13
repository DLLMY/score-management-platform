// T12-4 拆分（2026-09-12）：自 SubjectManagementSections.tsx 原样搬出，行为逐字节等价。
import { Plus, BookOpen } from 'lucide-react';
import { PermissionButton } from '../../../components';
import type { SubjectManagementViewProps } from '../types';

export function HeaderBar({ handleOpenModal }: SubjectManagementViewProps) {
  return (
    <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='relative'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/20'>
              <BookOpen className='w-6 h-6 text-white' />
            </div>
            <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
              <div className='w-2 h-2 bg-white rounded-full' />
            </div>
          </div>
          <div>
            <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
              科目管理
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400'>
              管理科目信息、科目代码和班级关联
            </p>
          </div>
        </div>
        <PermissionButton
          permission='score.entry'
          onClick={() => handleOpenModal(false)}
          className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
        >
          <Plus className='w-5 h-5' />
          添加科目
        </PermissionButton>
      </div>
    </div>
  );
}
