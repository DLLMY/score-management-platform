// T12-4 拆分（2026-09-12）：本文件退化为布局编排 View；区块组件见 ./components，
// 类型见 ./types，常量见 ./constants；全部逻辑见 ./useSubjectManagementLogic。
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  HeaderBar,
  StatisticsCards,
  SearchAndGrid,
  SubjectFormModal,
  ClassLinkModal,
  EditTeacherModal,
} from './components';
import type { SubjectManagementViewProps } from './types';

export type { FormData, AdminUser, StatusFilter, SubjectManagementViewProps } from './types';
export { defaultForm } from './constants';

export function SubjectManagementView(props: SubjectManagementViewProps): React.ReactElement {
  const { loadError } = props;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {loadError && (
        <div className='px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            科目/教师/班级数据加载失败，当前数据可能不完整，请刷新重试
          </p>
        </div>
      )}
      <HeaderBar {...props} />
      <StatisticsCards {...props} />
      <SearchAndGrid {...props} />
      <SubjectFormModal {...props} />
      <ClassLinkModal {...props} />
      <EditTeacherModal {...props} />
    </div>
  );
}
