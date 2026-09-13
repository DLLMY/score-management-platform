// T12-1 拆分（2026-09-12）：自 OpsCenterView.tsx 原样搬出，行为逐字节等价。
import React from 'react';
import { AlertTriangle, Network, Signal, Wifi, WifiOff } from 'lucide-react';
import type { DeviceStats, MqttStatus } from '../types';
import { HealthStatusBadge, MetricCard, SectionTitle } from './primitives';

/** MQTT 连接状态 + 设备概览双栏区块 */
export const MqttDeviceSection: React.FC<{
  mqtt: MqttStatus | null;
  deviceStats: DeviceStats | null;
}> = ({ mqtt, deviceStats }) => (
  <section className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
    <div>
      <SectionTitle icon={<Network size={18} />} title='MQTT 连接' />
      <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700'>
        <div className='flex items-center gap-3'>
          {mqtt?.connected ? (
            <Wifi size={28} className='text-green-500' />
          ) : (
            <WifiOff size={28} className='text-red-500' />
          )}
          <div>
            <div className='flex items-center gap-2'>
              <span className='text-base font-bold text-gray-800 dark:text-slate-100'>
                {mqtt?.connected ? '已连接' : '未连接'}
              </span>
              <HealthStatusBadge status={mqtt?.connected ? 'healthy' : 'unhealthy'} />
            </div>
            <p className='text-sm text-gray-500 dark:text-slate-400 mt-0.5'>
              已订阅主题: {mqtt?.subscribed_topics?.length ?? 0} 个
            </p>
          </div>
        </div>
      </div>
    </div>
    <div>
      <SectionTitle icon={<Signal size={18} />} title='设备概览' />
      <div className='grid grid-cols-2 gap-3'>
        <MetricCard
          title='在线设备'
          value={deviceStats?.online_devices ?? '—'}
          unit={`/ ${deviceStats?.total_devices ?? '?'} 台`}
          icon={<Signal size={16} />}
          color='text-green-500'
        />
        <MetricCard
          title='离线设备'
          value={deviceStats?.offline_devices ?? '—'}
          unit='台'
          icon={<WifiOff size={16} />}
          color='text-gray-500'
        />
        <MetricCard
          title='异常设备'
          value={deviceStats?.error_devices ?? '—'}
          unit='台'
          icon={<AlertTriangle size={16} />}
          color='text-red-500'
        />
        <MetricCard
          title='未处理告警'
          value={deviceStats?.unresolved_alerts ?? '—'}
          unit='条'
          icon={<AlertTriangle size={16} />}
          color='text-orange-500'
        />
      </div>
    </div>
  </section>
);
