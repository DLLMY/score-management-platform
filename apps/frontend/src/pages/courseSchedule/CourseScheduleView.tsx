// T12-4 拆分（2026-09-12）：本文件退化为布局编排 View；区块组件见 ./components，
// 类型见 ./types；全部逻辑见 ./useCourseScheduleLogic，页面装配层见 ../CourseSchedule。
import { AlertTriangle } from 'lucide-react';
import {
  HeaderBar,
  StatisticsCards,
  ScheduleTableSection,
  ScheduleModal,
  ImportSection,
} from './components';
import type { CourseScheduleViewProps } from './types';

function CourseScheduleView(props: CourseScheduleViewProps) {
  const { schedulesError } = props;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {schedulesError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            课程表加载失败，当前课表可能不完整，请刷新重试
          </p>
        </div>
      )}
      <HeaderBar {...props} />
      <StatisticsCards {...props} />
      <ScheduleTableSection {...props} />
      <ScheduleModal {...props} />
      <ImportSection {...props} />
    </div>
  );
}

export default CourseScheduleView;
