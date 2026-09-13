// T12-1 拆分（2026-09-12）：原 AnalysisSections.tsx 中的色板/映射表搬迁至此，纯常量无 JSX。

export const CLUSTER_COLORS: Record<
  string,
  { bg: string; text: string; light: string; border: string }
> = {
  全面优秀型: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    light: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
  },
  遵纪但学业吃力型: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50 dark:bg-yellow-500/10',
    border: 'border-yellow-200 dark:border-yellow-500/30',
  },
  聪明但散漫型: {
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    light: 'bg-orange-50 dark:bg-orange-500/10',
    border: 'border-orange-200 dark:border-orange-500/30',
  },
  双困型: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    light: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/30',
  },
};

export const RISK_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  high: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
  medium: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50 dark:bg-yellow-500/10',
  },
  low: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-500/10' },
};

export const getClusterColor = (label: string): string => {
  const colorMap: Record<string, string> = {
    全面优秀型: '#3b82f6',
    遵纪但学业吃力型: '#eab308',
    聪明但散漫型: '#f97316',
    双困型: '#ef4444',
  };
  return colorMap[label] || '#6b7280';
};
