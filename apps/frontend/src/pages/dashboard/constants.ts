/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
// T12-10a 拆分：CLUSTER_COLORS 自 DashboardView.tsx 原样搬出。
export const CLUSTER_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  全面优秀型: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
  遵纪但学业吃力型: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' },
  聪明但散漫型: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
  双困型: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' },
};
