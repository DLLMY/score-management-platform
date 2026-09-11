import { Button, Modal } from '../../components';
import type { DeviceSettings } from './types';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceLabel: string;
  deviceSettings: DeviceSettings;
  onChange: (field: keyof DeviceSettings, value: unknown) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function DeviceSettingsModal({
  isOpen,
  onClose,
  deviceLabel,
  deviceSettings,
  onChange,
  submitting,
  onSubmit,
}: DeviceSettingsModalProps) {
  return (
    <Modal
      title={`设备设置 - ${deviceLabel}`}
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            保存设置
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>设备名称</label>
          <input
            type='text'
            value={deviceSettings.name}
            onChange={(e) => onChange('name', e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='输入设备名称'
          />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>启用告警通知</label>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={deviceSettings.alert_enabled}
              onChange={(e) => onChange('alert_enabled', e.target.checked)}
              className='w-4 h-4 text-blue-600 rounded'
            />
            <span className='text-sm text-gray-600'>
              {deviceSettings.alert_enabled ? '已启用' : '已禁用'}
            </span>
          </label>
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>心跳超时时间（秒）</label>
          <input
            type='number'
            value={deviceSettings.heartbeat_timeout}
            onChange={(e) => onChange('heartbeat_timeout', parseInt(e.target.value) || 30)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            min='10'
            max='300'
          />
        </div>
      </div>
    </Modal>
  );
}
