/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
import type { ClusterData, ClusterStudent } from './useDashboardLogic';
import type { ID } from '../../types';

export const getRankColor = (index: number): string => {
  const colors = [
    'from-yellow-400 via-amber-500 to-orange-500',
    'from-gray-300 via-gray-400 to-gray-500',
    'from-amber-600 via-orange-600 to-amber-700',
    'from-green-400 via-emerald-500 to-green-600',
    'from-blue-400 via-blue-500 to-blue-600',
    'from-purple-400 via-purple-500 to-purple-600',
    'from-pink-400 via-pink-500 to-pink-600',
    'from-cyan-400 via-cyan-500 to-cyan-600',
    'from-red-400 via-red-500 to-red-600',
    'from-indigo-400 via-indigo-500 to-indigo-600',
  ];
  return colors[index] || 'from-slate-500 via-slate-600 to-slate-700';
};

export const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-green-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 30) return 'text-yellow-500';
  return 'text-red-500';
};

export const getLevel = (score: number): { text: string; icon: string; color: string } => {
  if (score >= 95)
    return {
      text: '领航者',
      icon: '🏆',
      color: 'from-yellow-500/40 to-amber-500/30 text-yellow-500 border-yellow-500/50',
    };
  if (score >= 85)
    return {
      text: '自律星',
      icon: '⭐',
      color: 'from-blue-500/40 to-cyan-500/30 text-blue-500 border-blue-500/50',
    };
  if (score >= 75)
    return {
      text: '进取者',
      icon: '🚀',
      color: 'from-green-500/40 to-emerald-500/30 text-green-500 border-green-500/50',
    };
  if (score >= 65)
    return {
      text: '稳定区',
      icon: '📊',
      color: 'from-teal-500/40 to-cyan-500/30 text-teal-500 border-teal-500/50',
    };
  if (score >= 60)
    return {
      text: '安全基准',
      icon: '✅',
      color: 'from-cyan-500/40 to-blue-500/30 text-cyan-500 border-cyan-500/50',
    };
  if (score >= 50)
    return {
      text: '浅观察',
      icon: '⚠️',
      color: 'from-orange-500/40 to-amber-500/30 text-orange-500 border-orange-500/50',
    };
  if (score >= 40)
    return {
      text: '深观察',
      icon: '🔴',
      color: 'from-red-500/40 to-rose-500/30 text-red-500 border-red-500/50',
    };
  if (score >= 30)
    return {
      text: '限行区',
      icon: '🚨',
      color: 'from-pink-500/40 to-rose-500/30 text-pink-500 border-pink-500/50',
    };
  if (score >= 20)
    return {
      text: '重启预备',
      icon: '🔄',
      color: 'from-purple-500/40 to-violet-500/30 text-purple-500 border-purple-500/50',
    };
  if (score >= 10)
    return {
      text: '护航区',
      icon: '🛡️',
      color: 'from-indigo-500/40 to-purple-500/30 text-indigo-500 border-indigo-500/50',
    };
  return {
    text: '重生点',
    icon: '💀',
    color: 'from-gray-500/40 to-slate-500/30 text-gray-500 border-gray-500/50',
  };
};

export function getUserCluster(
  clusters: ClusterData | null | undefined,
  userId: ID
): ClusterStudent | undefined {
  if (!clusters?.students) return undefined;
  return clusters.students.find((s) => s.user_id === Number(userId));
}
