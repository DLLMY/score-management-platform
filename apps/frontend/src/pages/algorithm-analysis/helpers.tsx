import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { BatchAttributionStudent } from '../../types';

// 趋势图标（纯函数，无组件状态依赖）
export const getTrendIcon = (trend: string): React.ReactElement => {
  switch (trend) {
    case 'rising':
    case 'up':
      return <ArrowUp className='w-4 h-4 text-green-500' />;
    case 'falling':
    case 'down':
      return <ArrowDown className='w-4 h-4 text-red-500' />;
    default:
      return <Minus className='w-4 h-4 text-gray-400' />;
  }
};

export const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'rising':
    case 'up':
      return 'text-green-600 bg-green-50 dark:bg-green-500/10';
    case 'falling':
    case 'down':
      return 'text-red-600 bg-red-50 dark:bg-red-500/10';
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-500/10';
  }
};

// 参与度等级徽章配色（参与度排名榜列定义使用）
export const engagementLevelBadge = (level: string): string => {
  if (level === 'high') return 'bg-green-100 dark:bg-green-500/20 text-green-600';
  if (level === 'medium') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600';
  return 'bg-gray-100 dark:bg-gray-500/20 text-gray-500';
};

// 成绩波动主要归因摘要（归因表列定义使用）
export const topFactors = (s: BatchAttributionStudent): string =>
  (s.factors || [])
    .slice(0, 2)
    .map((f) => `${f.name}${f.contribution >= 0 ? '+' : ''}${f.contribution.toFixed(1)}`)
    .join('、') || '—';
