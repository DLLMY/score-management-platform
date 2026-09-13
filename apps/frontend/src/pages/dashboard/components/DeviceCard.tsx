/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
import { memo, useState } from 'react';
import { Wifi } from 'lucide-react';
import type { Device } from '../../../types';

export const DeviceCard = memo(({ device }: { device: Device }) => {
  // is_online 由后端按 last_heartbeat 时效判定（单点真理），不叠加陈旧的 status 字段
  const isOnline = !!device.is_online;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative rounded-lg p-3 transition-all duration-300 cursor-pointer bg-white border ${
        isOnline
          ? 'border-green-200/60 hover:border-green-300/70 hover:shadow-md hover:shadow-green-500/10'
          : 'border-red-200/60 hover:border-red-300/70 hover:shadow-md hover:shadow-red-500/10'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${
          isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      />

      <div className='flex items-center gap-2.5'>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
            isOnline ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          } ${isHovered ? 'scale-110' : ''}`}
        >
          {isOnline ? <Wifi className='w-5 h-5' /> : <Wifi className='w-5 h-5 opacity-50' />}
        </div>

        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-gray-900 truncate'>
            {device.device_name || device.name || device.device_id}
          </p>
          <p className='text-xs text-gray-500'>{device.device_id}</p>
        </div>

        <div className='flex items-center gap-2'>
          {isOnline ? (
            <span className='text-xs text-green-500 font-medium'>在线</span>
          ) : (
            <span className='text-xs text-red-500 font-medium'>离线</span>
          )}
        </div>
      </div>
    </div>
  );
});
