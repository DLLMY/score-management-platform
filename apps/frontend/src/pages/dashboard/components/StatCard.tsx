/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
import React, { memo } from 'react';
import { ArrowUp, TrendingDown as TrendingDownIcon } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  subValue?: string;
  trend?: number;
  gradient: string;
  description?: string;
  isAlgorithm?: boolean;
  'aria-label'?: string;
}
export const StatCard = memo(
  ({
    icon: Icon,
    label,
    value,
    subValue,
    trend,
    gradient,
    description,
    isAlgorithm = false,
    'aria-label': ariaLabel,
  }: StatCardProps) => {
    return (
      <div
        className={`group relative overflow-hidden rounded-xl p-3 bg-white border border-gray-200/60 shadow-sm hover:shadow-md transition-colors duration-150 ${
          isAlgorithm
            ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/40 to-transparent'
            : ''
        }`}
        role='listitem'
        aria-label={ariaLabel}
      >
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient}`} />

        <div className='relative z-10'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}
              >
                <Icon className='w-4.5 h-4.5 text-white' />
              </div>
              <div className='flex flex-col'>
                <span className='text-sm font-semibold text-gray-800 whitespace-nowrap'>
                  {label}
                </span>
                {description && <span className='text-[11px] text-gray-500'>{description}</span>}
              </div>
            </div>
            <div className='flex items-center gap-2.5'>
              <span className='text-xl font-bold text-gray-900'>
                <AnimatedNumber value={typeof value === 'number' ? value : 0} />
              </span>
              {trend && (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                    trend > 0
                      ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 border border-green-500/30'
                      : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-700 border border-red-500/30'
                  }`}
                >
                  {trend > 0 ? (
                    <ArrowUp className='w-3 h-3' />
                  ) : (
                    <TrendingDownIcon className='w-3 h-3' />
                  )}
                  {Math.abs(trend)}%
                </div>
              )}
            </div>
          </div>
          {subValue && (
            <div className='mt-2 flex items-center gap-1.5'>
              <span className='w-1.5 h-1.5 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full' />
              <span className='text-[11px] text-gray-500 font-medium'>{subValue}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
