import { X } from 'lucide-react';
import { Modal, Button, EmptyState } from '../../components';
import type { DeviceGroup, DeviceInGroup } from './types';

interface DevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGroup: DeviceGroup | null;
  groupDevices: DeviceInGroup[];
  onRemoveDevices: (deviceIds: string[]) => void;
  onOpenAddDevicesModal: (group: DeviceGroup) => void;
}

export default function DevicesModal({
  isOpen,
  onClose,
  selectedGroup,
  groupDevices,
  onRemoveDevices,
  onOpenAddDevicesModal,
}: DevicesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${selectedGroup?.name || ''} - 设备列表`}
      size='lg'
    >
      {groupDevices.length === 0 ? (
        <EmptyState
          icon='folder'
          title='暂无设备'
          description='该分组下还没有设备，请添加设备'
          actionLabel='添加设备'
          onAction={() => {
            onClose();
            onOpenAddDevicesModal(selectedGroup!);
          }}
        />
      ) : (
        <div className='space-y-2'>
          {groupDevices.map((mapping) => (
            <div
              key={mapping.id}
              className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
            >
              <div className='flex items-center'>
                <div
                  className={`w-2 h-2 rounded-full mr-3 ${
                    mapping.device?.is_online
                      ? 'bg-green-500'
                      : mapping.device && mapping.device.is_online === false
                      ? 'bg-red-500'
                      : 'bg-gray-400'
                  }`}
                />
                <div>
                  <p className='font-medium text-gray-800'>{mapping.device?.name || '未知设备'}</p>
                  <p className='text-sm text-gray-500'>{mapping.device?.device_id}</p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                icon={X}
                onClick={() => onRemoveDevices([mapping.device_id])}
              >
                移除
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
