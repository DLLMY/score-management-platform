import { Brain, Moon, Clock } from 'lucide-react';
import { ColumnType } from '../../components';
import type { MentalHealthRecord } from '../../types';
import { getMoodIcon, getMoodLabel, getStressLabel } from './helpers';

export const columns: ColumnType<MentalHealthRecord>[] = [
  {
    title: '学生',
    key: 'student',
    render: (_value, record) => (
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center'>
          <Brain className='w-5 h-5 text-cyan-600 dark:text-cyan-400' />
        </div>
        <p className='font-medium text-slate-800 dark:text-slate-200'>
          {record.student_name || `学生 #${record.student_id}`}
        </p>
      </div>
    ),
  },
  {
    title: '心情',
    key: 'mood_level',
    dataIndex: 'mood_level',
    align: 'center',
    render: (value) => (
      <div className='flex items-center justify-center gap-1.5'>
        {value != null ? (
          getMoodIcon(value as number)
        ) : (
          <span className='w-5 h-5 text-slate-400 dark:text-slate-500'>--</span>
        )}
        <span className='text-sm text-slate-600 dark:text-slate-300'>
          {value != null ? getMoodLabel(value as number) : '--'}
        </span>
      </div>
    ),
  },
  {
    title: '压力',
    key: 'stress_level',
    dataIndex: 'stress_level',
    align: 'center',
    render: (value) => (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          value == null
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            : (value as number) >= 4
            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : (value as number) >= 3
            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {value != null ? getStressLabel(value as number) : '--'}
      </span>
    ),
  },
  {
    title: '睡眠',
    key: 'sleep_hours',
    dataIndex: 'sleep_hours',
    align: 'center',
    render: (value) => (
      <span className='inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300'>
        <Moon className='w-4 h-4 text-indigo-400' />
        {value as number}h
      </span>
    ),
  },
  {
    title: '备注',
    key: 'notes',
    dataIndex: 'notes',
    render: (value) => (
      <span className='text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate'>
        {value ? (value as string) : '-'}
      </span>
    ),
  },
  {
    title: '时间',
    key: 'created_at',
    dataIndex: 'created_at',
    render: (value) => (
      <div className='flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400'>
        <Clock className='w-4 h-4' />
        {value as string}
      </div>
    ),
  },
];
