// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出的通用展示原语。
// 四个均为无状态小组件（合计 <100 行），按「避免碎文件」原则聚合为一个文件，
// 各区块组件从本文件按需引用，行为逐字节等价。
import React from 'react';
import { AlertTriangle, CheckCircle, HelpCircle, XCircle } from 'lucide-react';
import { StatusBadge, StatusBadgeEntry } from '../../../components';

// ---------- 健康状态指示器 ----------
export const HealthStatusBadge: React.FC<{ status?: string; message?: string }> = ({
  status,
  message,
}) => {
  const map: Record<string, StatusBadgeEntry> = {
    healthy: { color: 'bg-green-100 text-green-600', icon: CheckCircle, label: '正常' },
    degraded: { color: 'bg-yellow-100 text-yellow-600', icon: AlertTriangle, label: '降级' },
    unhealthy: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '异常' },
    warning: { color: 'bg-orange-100 text-orange-600', icon: AlertTriangle, label: '警告' },
    critical: { color: 'bg-red-100 text-red-600', icon: XCircle, label: '严重' },
    unknown: { color: 'bg-gray-100 text-gray-600', icon: HelpCircle, label: '未知' },
  };
  return (
    <StatusBadge
      status={status || 'unknown'}
      statusMap={map}
      fallbackKey='unknown'
      size='sm'
      message={message}
    />
  );
};

// ---------- 百分比条 ----------
export const PercentBar: React.FC<{ percent?: number; label: string; icon: React.ReactNode }> = ({
  percent,
  label,
  icon,
}) => {
  const pct = typeof percent === 'number' ? Math.min(100, Math.max(0, percent)) : 0;
  const color = pct < 80 ? 'bg-green-500' : pct < 95 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-sm text-gray-600 dark:text-slate-300 flex items-center gap-2'>
          {icon}
          {label}
        </span>
        <span className='text-sm font-semibold text-gray-800 dark:text-slate-100'>
          {typeof percent === 'number' ? `${percent.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className='w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden'>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ---------- 指标卡片 ----------
export const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, unit, icon, color = 'text-blue-500' }) => (
  <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
    <div className='flex items-center justify-between mb-2'>
      <span className='text-sm text-gray-500 dark:text-slate-400'>{title}</span>
      <span className={color}>{icon}</span>
    </div>
    <div className='flex items-baseline gap-1'>
      <span className='text-2xl font-bold text-gray-800 dark:text-slate-100'>{value}</span>
      {unit && <span className='text-sm text-gray-500 dark:text-slate-400'>{unit}</span>}
    </div>
  </div>
);

// ---------- 区块标题 ----------
export const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <h3 className='flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-slate-100 mb-3'>
    <span className='text-primary-500'>{icon}</span>
    {title}
  </h3>
);
