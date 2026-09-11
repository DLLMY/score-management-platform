import { Badge, Modal } from '../../components';
import type { Device } from '../../types';
import type { Heartbeat } from '../../services/api';
import { formatUptime, formatDateTime } from '../../utils/format';

interface DeviceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device | null;
  heartbeats: Heartbeat[];
}

export function DeviceDetailModal({ isOpen, onClose, device, heartbeats }: DeviceDetailModalProps) {
  return (
    <Modal
      title={`设备详情 - ${device?.name || device?.device_id}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      {device && (
        <div className='space-y-6'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-sm text-gray-500'>设备ID</p>
              <p className='font-medium'>{device.device_id}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>设备名称</p>
              <p className='font-medium'>{device.name || '-'}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>状态</p>
              <Badge variant={device.is_online ? 'success' : 'danger'}>
                {device.is_online ? '在线' : '离线'}
              </Badge>
            </div>
            <div>
              <p className='text-sm text-gray-500'>信号强度</p>
              <p className='font-medium'>
                {device.wifi_signal ? `${device.wifi_signal} dBm` : '-'}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>运行时长</p>
              <p className='font-medium'>{formatUptime(device.uptime)}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>最后心跳</p>
              <p className='font-medium'>{formatDateTime(device.last_heartbeat, '-')}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>A箱状态</p>
              <Badge
                variant={
                  device.box_a_status === 'opened'
                    ? 'warning'
                    : device.box_a_status === 'closed'
                    ? 'success'
                    : 'default'
                }
              >
                {device.box_a_status === 'opened'
                  ? '打开'
                  : device.box_a_status === 'closed'
                  ? '关闭'
                  : '未知'}
              </Badge>
            </div>
            <div>
              <p className='text-sm text-gray-500'>B箱状态</p>
              <Badge
                variant={
                  device.box_b_status === 'opened'
                    ? 'warning'
                    : device.box_b_status === 'closed'
                    ? 'success'
                    : 'default'
                }
              >
                {device.box_b_status === 'opened'
                  ? '打开'
                  : device.box_b_status === 'closed'
                  ? '关闭'
                  : '未知'}
              </Badge>
            </div>
          </div>

          <div>
            <h4 className='text-sm font-medium text-gray-700 mb-3'>最近心跳记录</h4>
            <div className='space-y-2 max-h-48 overflow-y-auto'>
              {heartbeats.length === 0 ? (
                <p className='text-sm text-gray-500 text-center py-4'>暂无心跳记录</p>
              ) : (
                heartbeats.map((h) => (
                  <div
                    key={h.id}
                    className='flex items-center justify-between text-sm p-2 bg-gray-50 rounded'
                  >
                    <span>{formatDateTime(h.timestamp, '--')}</span>
                    <Badge
                      variant={
                        h.status === 'online'
                          ? 'success'
                          : h.status === 'offline'
                          ? 'danger'
                          : 'default'
                      }
                    >
                      {h.status === 'online'
                        ? '在线'
                        : h.status === 'offline'
                        ? '离线'
                        : h.status || '未知'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
