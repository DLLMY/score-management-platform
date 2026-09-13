// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import { Heart } from 'lucide-react';
import { formatDateTime } from '../../../utils/format';
import type { HealthData, StatusType } from '../types';

/** 整体健康横幅（系统运行正常 / 部分降级 / 存在异常 + 检查时间） */
export const OverallHealthBanner: React.FC<{ health: HealthData | null }> = ({ health }) => {
  const overallStatus = (health?.status as StatusType) || 'unknown';
  const overallColor =
    overallStatus === 'healthy'
      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
      : overallStatus === 'degraded'
      ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700';
  const overallText =
    overallStatus === 'healthy'
      ? '系统运行正常'
      : overallStatus === 'degraded'
      ? '系统部分降级'
      : '系统存在异常';

  return (
    <div className={`p-4 rounded-xl border ${overallColor}`}>
      <div className='flex items-center gap-3'>
        <Heart
          size={30}
          className={
            overallStatus === 'healthy'
              ? 'text-green-500'
              : overallStatus === 'degraded'
              ? 'text-yellow-500'
              : 'text-red-500'
          }
        />
        <div>
          <span className='text-lg font-bold text-gray-800 dark:text-slate-100'>{overallText}</span>
          <p className='text-sm text-gray-600 dark:text-slate-300 mt-0.5'>
            检查时间: {formatDateTime(health?.timestamp, '—')}
          </p>
        </div>
      </div>
    </div>
  );
};
