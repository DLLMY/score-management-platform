// T12-3 拆分（2026-09-12）：自 pages/ClassManagement.tsx 原样搬出，行为逐字节等价。
// 原为组件内 useMemo（deps 为 []，即全生命周期恒定），改为模块级常量后取值与
// 引用稳定性等价或更优，渲染输出逐字节相同。
import { GraduationCap } from 'lucide-react';
import type { ColumnType } from '../../components';
import type { ClassInfo } from '../../services/api';

export const classColumns: ColumnType<ClassInfo>[] = [
  {
    title: '班级名称',
    key: 'name',
    dataIndex: 'name',
    render: (_, cls) => (
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center'>
          <GraduationCap className='w-5 h-5 text-blue-600 dark:text-blue-400' />
        </div>
        <div>
          <p className='font-medium text-slate-800 dark:text-slate-200'>{cls.name}</p>
          {cls.description && (
            <p className='text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs'>
              {cls.description}
            </p>
          )}
        </div>
      </div>
    ),
  },
  {
    title: '年级',
    key: 'grade',
    dataIndex: 'grade',
    render: (_, cls) => (
      <span className='inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium'>
        {cls.grade || '-'}
      </span>
    ),
  },
  {
    title: '班主任',
    key: 'head_teacher_name',
    dataIndex: 'head_teacher_name',
    render: (_, cls) =>
      cls.head_teacher_name ? (
        <div className='flex items-center gap-2'>
          <div className='w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
            <span className='text-xs font-medium text-white'>
              {cls.head_teacher_name.charAt(0)}
            </span>
          </div>
          <span className='text-sm text-slate-700 dark:text-slate-300'>
            {cls.head_teacher_name}
          </span>
        </div>
      ) : (
        <span className='text-sm text-slate-400 dark:text-slate-500'>未分配</span>
      ),
  },
  {
    title: '关联状态',
    key: 'head_teacher_id',
    dataIndex: 'head_teacher_id',
    align: 'center',
    render: (_, cls) => (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          cls.head_teacher_id
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            cls.head_teacher_id ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
        {cls.head_teacher_id ? '已关联' : '未关联'}
      </span>
    ),
  },
  {
    title: '学生数',
    key: 'student_count',
    dataIndex: 'student_count',
    align: 'center',
    render: (_, cls) => (
      <span className='inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold'>
        {cls.student_count != null ? cls.student_count : '--'}
      </span>
    ),
  },
  {
    title: '状态',
    key: 'is_active',
    dataIndex: 'is_active',
    align: 'center',
    render: (_, cls) => (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          cls.is_active
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            cls.is_active ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
        {cls.is_active ? '启用' : '禁用'}
      </span>
    ),
  },
];
