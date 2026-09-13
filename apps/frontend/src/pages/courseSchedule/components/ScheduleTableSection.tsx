// T12-4 拆分（2026-09-12）：自 CourseScheduleView.tsx 原样搬出，行为逐字节等价。
import { Clock, Building2, ChevronDown } from 'lucide-react';
import type { ClassPeriod } from '../../../services/api';
import { DataTable } from '../../../components';
import type { CourseScheduleViewProps } from '../types';

export function ScheduleTableSection({
  classes,
  selectedClass,
  setSelectedClass,
  showClassDropdown,
  setShowClassDropdown,
  filteredSchedules,
  columns,
  activePeriods,
  isLoading,
}: CourseScheduleViewProps) {
  return (
    <div className='flex-1 px-6 pb-6 overflow-auto'>
      <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
        {/* Class Selector Bar */}
        <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
          <div className='flex items-center justify-between'>
            <div className='relative'>
              <button
                onClick={() => setShowClassDropdown(!showClassDropdown)}
                className='flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-200 min-w-[200px] justify-between shadow-sm'
              >
                <div className='flex items-center gap-3'>
                  <Building2 className='w-5 h-5 text-cyan-500' />
                  <span className='text-slate-700 dark:text-slate-200 font-medium'>
                    {classes.find((c) => c.id === selectedClass)?.name || '选择班级'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    showClassDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {showClassDropdown && (
                <>
                  <div className='fixed inset-0 z-40' onClick={() => setShowClassDropdown(false)} />
                  <div className='absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden'>
                    {classes.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => {
                          setSelectedClass(cls.id);
                          setShowClassDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 ${
                          selectedClass === cls.id
                            ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Building2 className='w-4 h-4' />
                        <span className='font-medium'>{cls.name}</span>
                        {cls.grade && <span className='text-xs text-slate-400'>{cls.grade}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg'>
                <Clock className='w-4 h-4' />
                <span>
                  共{' '}
                  <strong className='text-slate-700 dark:text-slate-200'>
                    {filteredSchedules.length}
                  </strong>{' '}
                  节课程
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Table */}
        <DataTable<ClassPeriod>
          columns={columns}
          dataSource={activePeriods}
          loading={isLoading}
          rowKey='id'
          empty={{
            icon: 'settings',
            title: '暂无课程节次设置',
            description: '请先设置课程节次，再添加课程安排',
            actionLabel: '设置课程节次',
            onAction: () => {
              window.location.hash = '#/class-period-settings';
            },
          }}
          scroll={{ x: 1100 }}
        />
      </div>
    </div>
  );
}
