import { Plus, Edit2, Trash2, Clock, User, MapPin } from 'lucide-react';

import type { CourseSchedule, ClassPeriod } from '../../services/api';
import { PermissionButton, type ColumnType } from '../../components';
import type { WeekDay } from './types';

/**
 * CourseSchedule 表格列定义（E6a 抽取：渲染配置，依赖周历数据 + 3 个操作 handler）。
 * 原为 CourseSchedulePage 内的 useMemo，行为完全一致；调用方仍用 useMemo 包裹
 * 以保持引用稳定（依赖数组与原实现相同）。
 */
export interface CourseColumnsDeps {
  weekDays: WeekDay[];
  getScheduleForCell: (day: number, period: number) => CourseSchedule | undefined;
  getPeriodTime: (periodNumber: number) => string;
  handleEdit: (schedule: CourseSchedule) => void;
  handleDelete: (id: number) => void | Promise<void>;
  handleAdd: (day?: number, period?: number) => void;
}

export function buildCourseColumns(deps: CourseColumnsDeps): ColumnType<ClassPeriod>[] {
  const { weekDays, getScheduleForCell, getPeriodTime, handleEdit, handleDelete, handleAdd } = deps;
  return [
    {
      title: (
        <div className='flex items-center gap-2'>
          <Clock className='w-4 h-4 text-cyan-500' />
          节次 / 时间
        </div>
      ),
      key: 'period_name',
      dataIndex: 'name',
      width: 140,
      className: 'sticky left-0 z-10 bg-white/80 dark:bg-slate-800/80',
      render: (_, period) => (
        <div>
          <div className='font-bold text-slate-700 dark:text-slate-200 text-lg'>{period.name}</div>
          <div className='text-xs text-slate-400 mt-0.5 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md inline-block'>
            {getPeriodTime(period.period_number)}
          </div>
        </div>
      ),
    },
    ...weekDays.map<ColumnType<ClassPeriod>>((day) => ({
      title: (
        <div className='flex flex-col items-center gap-1'>
          <span className='text-xs text-slate-400 uppercase tracking-wider'>{day.shortLabel}</span>
          <span className='font-bold text-slate-700 dark:text-white text-base'>{day.label}</span>
        </div>
      ),
      key: `day_${day.day}`,
      align: 'center',
      width: 160,
      render: (_, period) => {
        const schedule = getScheduleForCell(day.day, period.period_number);
        return schedule ? (
          <div
            className='group/schedule relative rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-gray-100 dark:border-slate-600'
            style={{
              backgroundColor: `${schedule.subject_color}12`,
              borderColor: `${schedule.subject_color}30`,
            }}
            onClick={() => handleEdit(schedule)}
          >
            <div className='absolute top-2 right-2 flex gap-1 opacity-0 group-hover/schedule:opacity-100 transition-all duration-200 transform translate-x-2 group-hover/schedule:translate-x-0'>
              <PermissionButton
                permission='schedule.manage'
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(schedule);
                }}
                className='p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-md hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors'
              >
                <Edit2 className='w-3.5 h-3.5 text-slate-600 dark:text-slate-300' />
              </PermissionButton>
              <PermissionButton
                permission='schedule.manage'
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(schedule.id);
                }}
                className='p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors'
              >
                <Trash2 className='w-3.5 h-3.5 text-red-500' />
              </PermissionButton>
            </div>
            <div
              className='text-white text-xs font-bold px-2.5 py-1 rounded-lg mb-3 inline-block shadow-sm'
              style={{ backgroundColor: schedule.subject_color }}
            >
              {schedule.subject_name}
            </div>
            {schedule.teacher_name && (
              <div className='flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-1.5'>
                <User className='w-3.5 h-3.5 text-slate-400' />
                <span className='font-medium'>{schedule.teacher_name}</span>
              </div>
            )}
            {schedule.classroom && (
              <div className='flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500'>
                <MapPin className='w-3.5 h-3.5 text-slate-400' />
                <span>{schedule.classroom}</span>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => handleAdd(day.day, period.period_number)}
            className='w-full h-full min-h-[100px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-all duration-200 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-cyan-500'
          >
            <Plus className='w-5 h-5' />
          </button>
        );
      },
    })),
  ];
}
