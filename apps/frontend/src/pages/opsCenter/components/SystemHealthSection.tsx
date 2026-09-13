// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import { Cpu, Database, HardDrive, Heart, MemoryStick, Network } from 'lucide-react';
import type { HealthComponent, HealthData } from '../types';
import { HealthStatusBadge, SectionTitle } from './primitives';

/** 系统健康组件网格（数据库 / 缓存 / MQTT / CPU / 内存 / 磁盘） */
export const SystemHealthSection: React.FC<{ health: HealthData | null }> = ({ health }) => {
  const healthItems: {
    key: string;
    label: string;
    icon: React.ReactNode;
    data?: HealthComponent;
  }[] = [
    {
      key: 'database',
      label: '数据库',
      icon: <Database size={16} />,
      data: health?.components?.database,
    },
    {
      key: 'redis',
      label: '缓存(Redis)',
      icon: <MemoryStick size={16} />,
      data: health?.components?.redis,
    },
    { key: 'mqtt', label: 'MQTT', icon: <Network size={16} />, data: health?.components?.mqtt },
    { key: 'cpu', label: 'CPU', icon: <Cpu size={16} />, data: health?.components?.cpu },
    {
      key: 'memory',
      label: '内存',
      icon: <MemoryStick size={16} />,
      data: health?.components?.memory,
    },
    { key: 'disk', label: '磁盘', icon: <HardDrive size={16} />, data: health?.components?.disk },
  ];

  return (
    <section>
      <SectionTitle icon={<Heart size={18} />} title='系统健康' />
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
        {healthItems.map((it) => (
          <div
            key={it.key}
            className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'
          >
            <div className='flex items-center gap-2 mb-2 text-gray-700 dark:text-slate-200'>
              <span className='text-primary-500'>{it.icon}</span>
              <span className='text-sm font-medium'>{it.label}</span>
            </div>
            {it.data ? (
              <HealthStatusBadge status={it.data.status} message={it.data.message} />
            ) : (
              <span className='text-xs text-gray-400'>无数据</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
