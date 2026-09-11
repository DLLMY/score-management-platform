import { CheckCircle, Settings, Bell, Activity } from 'lucide-react';
import { Badge, Button } from '../../components';
import type { Alert } from '../../services/api';
import type { Device } from '../../types';
import { formatRelativeTime } from '../../utils/format';
import { getSeverityIcon } from './helpers';

interface SignalDistribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

interface DeviceMonitorViewProps {
  devices: Device[];
  signalDistribution: SignalDistribution;
  alerts: Alert[];
  onControl: (device: Device) => void;
  onSettings: (device: Device) => void;
  onResolveAlert: (deviceId: string, alertId: number) => void;
}

export function DeviceMonitorView({
  devices,
  signalDistribution,
  alerts,
  onControl,
  onSettings,
  onResolveAlert,
}: DeviceMonitorViewProps) {
  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      <div className='card'>
        <div className='card-header'>
          <h3 className='text-lg font-semibold'>信号强度分布</h3>
        </div>
        <div className='card-body'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='text-center p-4 bg-green-50 rounded-lg'>
              <p className='text-2xl font-bold text-green-600'>{signalDistribution.excellent}</p>
              <p className='text-sm text-gray-600'>优秀 (-50dBm以上)</p>
            </div>
            <div className='text-center p-4 bg-blue-50 rounded-lg'>
              <p className='text-2xl font-bold text-blue-600'>{signalDistribution.good}</p>
              <p className='text-sm text-gray-600'>良好 (-50~-70dBm)</p>
            </div>
            <div className='text-center p-4 bg-yellow-50 rounded-lg'>
              <p className='text-2xl font-bold text-yellow-600'>{signalDistribution.fair}</p>
              <p className='text-sm text-gray-600'>一般 (-70~-80dBm)</p>
            </div>
            <div className='text-center p-4 bg-red-50 rounded-lg'>
              <p className='text-2xl font-bold text-red-600'>{signalDistribution.poor}</p>
              <p className='text-sm text-gray-600'>较差 (-80dBm以下)</p>
            </div>
          </div>
        </div>
      </div>

      <div className='card'>
        <div className='card-header flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>实时设备状态</h3>
          <Badge variant='primary'>
            <Activity className='w-3 h-3 mr-1' />
            实时监控
          </Badge>
        </div>
        <div className='card-body'>
          {devices.length === 0 ? (
            <p className='text-center text-gray-500 py-8'>暂无设备数据</p>
          ) : (
            <div className='space-y-3'>
              {devices.map((device) => (
                <div
                  key={device.device_id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    device.is_online ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          device.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`}
                      />
                      <div>
                        <p className='font-medium text-gray-900'>
                          {device.name || device.device_id}
                        </p>
                        <p className='text-sm text-gray-500'>{device.device_id}</p>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant={device.is_online ? 'success' : 'default'}>
                        {device.is_online ? '在线' : '离线'}
                      </Badge>
                      {device.is_online && device.wifi_signal !== null && (
                        <span className='text-sm text-gray-500'>{device.wifi_signal}dBm</span>
                      )}
                    </div>
                  </div>
                  <div className='mt-3 flex items-center justify-between text-sm'>
                    <div className='flex items-center gap-4 text-gray-500'>
                      <span>
                        A箱:{' '}
                        {device.box_a_status === 'opened'
                          ? '打开'
                          : device.box_a_status === 'closed'
                          ? '关闭'
                          : '未知'}
                      </span>
                      <span>
                        B箱:{' '}
                        {device.box_b_status === 'opened'
                          ? '打开'
                          : device.box_b_status === 'closed'
                          ? '关闭'
                          : '未知'}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => onControl(device)}
                        disabled={!device.is_online}
                      >
                        <Settings className='w-3 h-3' />
                      </Button>
                      <Button variant='secondary' size='sm' onClick={() => onSettings(device)}>
                        <Bell className='w-3 h-3' />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className='card lg:col-span-2'>
        <div className='card-header flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>设备告警</h3>
          <Badge variant='danger'>{alerts.length} 条未处理</Badge>
        </div>
        <div className='card-body'>
          {alerts.length === 0 ? (
            <div className='text-center py-8'>
              <CheckCircle className='w-12 h-12 text-green-500 mx-auto mb-3' />
              <p className='text-gray-600'>暂无告警</p>
              <p className='text-sm text-gray-400'>所有设备运行正常</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.severity === 'critical'
                      ? 'border-purple-500 bg-purple-50'
                      : alert.severity === 'error'
                      ? 'border-red-500 bg-red-50'
                      : alert.severity === 'warning'
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex items-start gap-3'>
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <p className='font-medium text-gray-900'>
                          {alert.device_name || alert.device_id}
                        </p>
                        <p className='text-sm text-gray-600'>{alert.message}</p>
                        <p className='text-xs text-gray-400 mt-1'>
                          {formatRelativeTime(alert.created_at, '-')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant='success'
                      size='sm'
                      onClick={() => onResolveAlert(alert.device_id, alert.id)}
                    >
                      <CheckCircle className='w-3 h-3' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
