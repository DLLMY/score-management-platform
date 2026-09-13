// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import { FileText, Layers, ListChecks, Server, Users } from 'lucide-react';
import type { SystemStats } from '../types';
import { MetricCard, SectionTitle } from './primitives';

/** 系统统计（用户 / 积分记录 / 积分规则 / 设备 / 管理员） */
export const SystemStatsSection: React.FC<{ sysStats: SystemStats | null }> = ({ sysStats }) => (
  <section>
    <SectionTitle icon={<Layers size={18} />} title='系统统计' />
    <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
      <MetricCard
        title='用户'
        value={sysStats?.users ?? '—'}
        icon={<Users size={16} />}
        color='text-blue-500'
      />
      <MetricCard
        title='积分记录'
        value={sysStats?.records ?? '—'}
        icon={<FileText size={16} />}
        color='text-green-500'
      />
      <MetricCard
        title='积分规则'
        value={sysStats?.rules ?? '—'}
        icon={<ListChecks size={16} />}
        color='text-purple-500'
      />
      <MetricCard
        title='设备'
        value={sysStats?.devices ?? '—'}
        icon={<Server size={16} />}
        color='text-orange-500'
      />
      <MetricCard
        title='管理员'
        value={sysStats?.admins ?? '—'}
        icon={<Users size={16} />}
        color='text-red-500'
      />
    </div>
  </section>
);
