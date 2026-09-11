import { Layers, Monitor, CheckCircle, XCircle } from 'lucide-react';
import type { DeviceGroup, GroupStats } from './types';

interface StatisticsCardsProps {
  groups: DeviceGroup[];
  stats: GroupStats[];
}

export default function StatisticsCards({ groups, stats }: StatisticsCardsProps) {
  const totalDevices = Array.isArray(stats)
    ? stats.reduce((sum, s) => sum + (s.total_devices || 0), 0)
    : 0;
  const onlineDevices = Array.isArray(stats)
    ? stats.reduce((sum, s) => sum + (s.online_devices || 0), 0)
    : 0;
  const offlineDevices = Array.isArray(stats)
    ? stats.reduce((sum, s) => sum + (s.offline_devices || 0), 0)
    : 0;

  return (
    <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
      <div className='bg-white rounded-lg shadow p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-gray-500 text-sm'>总分组数</p>
            <p className='text-2xl font-bold text-gray-800'>{groups.length}</p>
          </div>
          <Layers className='w-8 h-8 text-blue-500' />
        </div>
      </div>
      <div className='bg-white rounded-lg shadow p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-gray-500 text-sm'>总设备数</p>
            <p className='text-2xl font-bold text-gray-800'>{totalDevices}</p>
          </div>
          <Monitor className='w-8 h-8 text-green-500' />
        </div>
      </div>
      <div className='bg-white rounded-lg shadow p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-gray-500 text-sm'>在线设备</p>
            <p className='text-2xl font-bold text-green-600'>{onlineDevices}</p>
          </div>
          <CheckCircle className='w-8 h-8 text-green-500' />
        </div>
      </div>
      <div className='bg-white rounded-lg shadow p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-gray-500 text-sm'>离线设备</p>
            <p className='text-2xl font-bold text-red-600'>{offlineDevices}</p>
          </div>
          <XCircle className='w-8 h-8 text-red-500' />
        </div>
      </div>
    </div>
  );
}
