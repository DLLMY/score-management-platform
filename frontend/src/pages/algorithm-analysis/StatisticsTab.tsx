import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { AlgorithmAnalysisDeps } from './types';

export function StatisticsTab({ deps }: { deps: AlgorithmAnalysisDeps }): React.ReactElement {
  const { loadWarn, statistics } = deps;

  if (loadWarn) {
    // 加载失败 ≠ 无数据：区分展示，避免引导用户"去导入数据"
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <BarChart3 className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>统计数据加载失败</p>
        <p className='text-sm mt-1'>请稍后重试，或检查后端服务是否可用</p>
      </div>
    );
  }
  if (!statistics) {
    return (
      <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
        <BarChart3 className='w-12 h-12 mx-auto mb-3 text-gray-400' />
        <p>暂无统计数据</p>
        <p className='text-sm mt-1'>请确保已导入学生数据</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>学生总数</div>
          <div className='text-3xl font-bold text-gray-800 dark:text-white mt-1'>
            {statistics.student_count != null ? statistics.student_count : '—'}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>平均行为积分</div>
          <div className='text-3xl font-bold text-blue-600 mt-1'>
            {statistics.avg_behavior_score != null
              ? statistics.avg_behavior_score.toFixed(1)
              : '—'}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>平均学业成绩</div>
          <div className='text-3xl font-bold text-green-600 mt-1'>
            {statistics.avg_academic_score != null
              ? statistics.avg_academic_score.toFixed(1)
              : '—'}
          </div>
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='text-sm text-gray-500 dark:text-slate-400'>积分-成绩相关性</div>
          <div className='text-3xl font-bold text-purple-600 mt-1'>
            {statistics.correlation != null ? statistics.correlation.toFixed(2) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
