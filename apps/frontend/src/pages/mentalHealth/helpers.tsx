import { Frown, Meh, Smile } from 'lucide-react';

export const getMoodIcon = (level: number) => {
  if (level <= 2) return <Frown className='w-5 h-5 text-red-500' />;
  if (level === 3) return <Meh className='w-5 h-5 text-amber-500' />;
  return <Smile className='w-5 h-5 text-emerald-500' />;
};

export const getMoodLabel = (level: number) => {
  const labels: Record<number, string> = {
    1: '很差',
    2: '较差',
    3: '一般',
    4: '良好',
    5: '优秀',
  };
  return labels[level] || '未知';
};

export const getStressLabel = (level: number) => {
  const labels: Record<number, string> = {
    1: '极低',
    2: '较低',
    3: '中等',
    4: '较高',
    5: '极高',
  };
  return labels[level] || '未知';
};

export const getAlertSeverityColor = (severity: number) => {
  if (severity >= 4)
    return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
  if (severity >= 3)
    return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
};

export const getAlertSeverityLabel = (severity: number) => {
  if (severity >= 4) return '高危';
  if (severity >= 3) return '中等';
  return '低';
};
