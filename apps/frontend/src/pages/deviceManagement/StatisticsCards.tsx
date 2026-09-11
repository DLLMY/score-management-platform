import { Server, Wifi, WifiOff, AlertTriangle, Activity } from 'lucide-react';
import type { AdvancedStats } from './types';

interface StatisticsCardsProps {
  statsDisplay: { total: number; online: number; offline: number; todayHeartbeats: number };
  statsError: boolean;
  initialLoading: boolean;
  advancedStats: AdvancedStats | null;
  alertsCount: number;
}

export function StatisticsCards({
  statsDisplay,
  statsError,
  initialLoading,
  advancedStats,
  alertsCount,
}: StatisticsCardsProps) {
  const showDash = initialLoading || statsError;
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
      <div className='card-gradient p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-blue-100 text-sm'>设备总数</p>
            <p className='text-3xl font-bold mt-1'>{showDash ? '--' : statsDisplay.total}</p>
          </div>
          <Server className='w-10 h-10 text-white/50' />
        </div>
        {advancedStats && (
          <div className='mt-2 flex items-center gap-2 text-sm text-blue-200'>
            <span>
              在线率: {advancedStats.online_rate != null ? `${advancedStats.online_rate}%` : '--'}
            </span>
          </div>
        )}
      </div>

      <div className='card-gradient-green p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-green-100 text-sm'>在线设备</p>
            <p className='text-3xl font-bold mt-1'>{showDash ? '--' : statsDisplay.online}</p>
          </div>
          <Wifi className='w-10 h-10 text-white/50' />
        </div>
        {advancedStats && (
          <div className='mt-2 flex items-center gap-2 text-sm text-green-200'>
            <Activity className='w-4 h-4' />
            <span>
              平均信号:{' '}
              {advancedStats.avg_signal_strength != null
                ? `${advancedStats.avg_signal_strength} dBm`
                : '--'}
            </span>
          </div>
        )}
      </div>

      <div className='card-gradient-red p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-red-100 text-sm'>离线设备</p>
            <p className='text-3xl font-bold mt-1'>{showDash ? '--' : statsDisplay.offline}</p>
          </div>
          <WifiOff className='w-10 h-10 text-white/50' />
        </div>
        {advancedStats && (
          <div className='mt-2 flex items-center gap-2 text-sm text-red-200'>
            <span>
              故障: {advancedStats.error_devices != null ? advancedStats.error_devices : '--'}
            </span>
          </div>
        )}
      </div>

      <div className={`p-6 ${(alertsCount || 0) > 0 ? 'card-gradient-yellow' : 'bg-gray-600'}`}>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-yellow-100 text-sm'>未处理告警</p>
            <p className='text-3xl font-bold mt-1'>{showDash ? '--' : alertsCount}</p>
          </div>
          <AlertTriangle className='w-10 h-10 text-white/50' />
        </div>
        {advancedStats && (
          <div className='mt-2 flex items-center gap-2 text-sm text-yellow-200'>
            <span>
              严重: {advancedStats.critical_alerts != null ? advancedStats.critical_alerts : '--'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
