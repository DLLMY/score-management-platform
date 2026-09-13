// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
  TrendingUp,
} from 'lucide-react';
import type { PerformanceData } from '../types';
import { MetricCard, PercentBar, SectionTitle } from './primitives';

/** 资源性能（CPU/内存/磁盘/进程）+ API 性能（请求/查询/慢请求）双栏区块 */
export const PerformanceSection: React.FC<{ perf: PerformanceData | null }> = ({ perf }) => (
  <section className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
    <div>
      <SectionTitle icon={<Cpu size={18} />} title='资源性能' />
      <div className='space-y-3'>
        <PercentBar label='CPU' icon={<Cpu size={15} />} percent={perf?.system?.cpu?.percent} />
        <PercentBar
          label='内存'
          icon={<MemoryStick size={15} />}
          percent={perf?.system?.memory?.percent}
        />
        <PercentBar
          label='磁盘'
          icon={<HardDrive size={15} />}
          percent={perf?.system?.disk?.percent}
        />
        <div className='grid grid-cols-3 gap-3'>
          <MetricCard
            title='进程数'
            value={perf?.system?.process?.threads ?? '—'}
            icon={<Server size={16} />}
            color='text-purple-500'
          />
          <MetricCard
            title='CPU核'
            value={perf?.system?.cpu?.count ?? '—'}
            icon={<Cpu size={16} />}
            color='text-blue-500'
          />
          <MetricCard
            title='运行时长'
            value={perf?.api_performance?.uptime ?? '—'}
            icon={<Clock size={16} />}
            color='text-green-500'
          />
        </div>
      </div>
    </div>
    <div>
      <SectionTitle icon={<TrendingUp size={18} />} title='API 性能' />
      <div className='space-y-3'>
        <div className='grid grid-cols-3 gap-3'>
          <MetricCard
            title='总请求'
            value={perf?.api_performance?.total_requests ?? '—'}
            unit='次'
            icon={<Activity size={16} />}
            color='text-blue-500'
          />
          <MetricCard
            title='总查询'
            value={perf?.api_performance?.total_queries ?? '—'}
            unit='次'
            icon={<Database size={16} />}
            color='text-green-500'
          />
          <MetricCard
            title='慢请求'
            value={perf?.slow_requests?.length ?? 0}
            unit='个'
            icon={<AlertTriangle size={16} />}
            color='text-orange-500'
          />
        </div>
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden'>
          <div className='px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 flex items-center gap-2'>
            <Clock size={15} className='text-orange-500' />
            <span className='text-sm font-semibold text-gray-700 dark:text-slate-200'>
              最近慢请求
            </span>
          </div>
          <div className='divide-y divide-gray-50 dark:divide-slate-700 max-h-56 overflow-y-auto'>
            {perf?.slow_requests && perf.slow_requests.length > 0 ? (
              perf.slow_requests.slice(0, 6).map((r, i) => (
                <div key={i} className='px-4 py-2 flex items-center justify-between text-sm'>
                  <span className='text-gray-700 dark:text-slate-200 truncate'>
                    {r.method} {r.endpoint}
                  </span>
                  <span className='text-red-500 font-medium flex-shrink-0 ml-2'>
                    {(r.duration ?? 0).toFixed(2)}s
                  </span>
                </div>
              ))
            ) : (
              <div className='px-4 py-6 text-center text-sm text-gray-400'>暂无慢请求记录</div>
            )}
          </div>
        </div>
      </div>
    </div>
  </section>
);
