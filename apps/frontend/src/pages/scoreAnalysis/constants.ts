// T12-2 拆分（2026-09-12）：原 ScoreAnalysisSections.tsx 中的分群配色搬迁至此，纯常量无 JSX。

// 分群配色
export const CLUSTER_COLORS: Record<
  string,
  { bg: string; text: string; light: string; border: string }
> = {
  全面优秀型: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    light: 'bg-blue-50',
    border: 'border-blue-200',
  },
  遵纪但学业吃力型: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50',
    border: 'border-yellow-200',
  },
  聪明但散漫型: {
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    light: 'bg-orange-50',
    border: 'border-orange-200',
  },
  双困型: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    light: 'bg-red-50',
    border: 'border-red-200',
  },
};
