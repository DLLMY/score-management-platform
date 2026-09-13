// T12-6 拆分（2026-09-12）：常量自 CommitteeListView.tsx 原样搬出。
import { User, Star, Calendar } from 'lucide-react';
import type { ColumnType } from '../../components';
import type { ClassCommittee } from '../../types';
export const POSITION_OPTIONS = [
  { value: 'monitor', label: '班长' },
  { value: 'vice_monitor', label: '副班长' },
  { value: 'study', label: '学习委员' },
  { value: 'life', label: '生活委员' },
  { value: 'sports', label: '体育委员' },
  { value: 'art', label: '文艺委员' },
  { value: 'propaganda', label: '宣传委员' },
  { value: 'organization', label: '组织委员' },
  { value: 'other', label: '其他' },
];

export const getPositionLabel = (value: string) => {
  return POSITION_OPTIONS.find((p) => p.value === value)?.label || value;
};

export const getPositionIcon = (position: string) => {
  const icons: Record<string, string> = {
    monitor: '🎖️',
    vice_monitor: '🥇',
    study: '📚',
    life: '🏠',
    sports: '⚽',
    art: '🎨',
    propaganda: '📢',
    organization: '🎯',
    other: '⭐',
  };
  return icons[position] || '⭐';
};

export const columns: ColumnType<ClassCommittee>[] = [
  {
    title: '职位',
    key: 'position',
    dataIndex: 'position',
    render: (_, item) => (
      <div className='flex items-center gap-2'>
        <span className='text-lg'>{getPositionIcon(item.position)}</span>
        <span className='font-medium text-slate-800 dark:text-slate-200'>
          {getPositionLabel(item.position)}
        </span>
      </div>
    ),
  },
  {
    title: '学生',
    key: 'student_name',
    dataIndex: 'student_name',
    render: (_, item) => (
      <div className='flex items-center gap-2'>
        <div className='w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
          <User className='w-4 h-4 text-white' />
        </div>
        <span className='text-sm text-slate-700 dark:text-slate-300'>
          {item.student_name || `学生${item.student_id}`}
        </span>
      </div>
    ),
  },
  {
    title: '职责',
    key: 'responsibilities',
    dataIndex: 'responsibilities',
    render: (_, item) => (
      <span className='text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate block'>
        {item.responsibilities || '-'}
      </span>
    ),
  },
  {
    title: '任期',
    key: 'term',
    dataIndex: 'term_start',
    render: (_, item) => (
      <div className='flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400'>
        <Calendar className='w-3 h-3' />
        <span>
          {item.term_start || '-'} ~ {item.term_end || '至今'}
        </span>
      </div>
    ),
  },
  {
    title: '评价',
    key: 'rating',
    dataIndex: 'rating',
    align: 'center',
    render: (_, item) =>
      item.rating ? (
        <div className='flex items-center justify-center gap-1'>
          <Star className='w-4 h-4 text-amber-500 fill-amber-500' />
          <span className='font-medium text-slate-700 dark:text-slate-300'>
            {item.rating.toFixed(1)}
          </span>
        </div>
      ) : (
        <span className='text-slate-400'>-</span>
      ),
  },
  {
    title: '状态',
    key: 'is_active',
    dataIndex: 'is_active',
    align: 'center',
    render: (_, item) => (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          item.is_active
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            item.is_active ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
        {item.is_active ? '在任' : '离任'}
      </span>
    ),
  },
];
