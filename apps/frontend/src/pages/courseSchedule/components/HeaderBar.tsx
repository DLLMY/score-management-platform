// T12-4 拆分（2026-09-12）：自 CourseScheduleView.tsx 原样搬出，行为逐字节等价。
import { Plus, Calendar, Download, Upload } from 'lucide-react';
import { PermissionButton } from '../../../components';
import type { CourseScheduleViewProps } from '../types';

export function HeaderBar({
  exportFormat,
  setExportFormat,
  exportSchedule,
  handleAdd,
  openImportModalWithData,
}: CourseScheduleViewProps) {
  return (
    <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='relative'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
              <Calendar className='w-6 h-6 text-white' />
            </div>
            <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
              <div className='w-2 h-2 bg-white rounded-full' />
            </div>
          </div>
          <div>
            <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
              课程表管理
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400'>
              管理班级课程安排，支持可视化时间表和冲突检测
            </p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <PermissionButton
            permission='schedule.manage'
            onClick={exportSchedule}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Download className='w-5 h-5' />
            导出课程表
          </PermissionButton>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'excel')}
            className='px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
          >
            <option value='excel'>Excel 格式</option>
            <option value='json'>JSON 格式</option>
          </select>
          <button
            onClick={openImportModalWithData}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Upload className='w-5 h-5' />
            导入课程表
          </button>
          <PermissionButton
            permission='schedule.manage'
            onClick={() => handleAdd()}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            添加课程安排
          </PermissionButton>
        </div>
      </div>
    </div>
  );
}
