import { Modal, Button, Badge } from '../../components';
import type { Device } from '../../types';
import type { DeviceGroup, DeviceInGroup } from './types';

interface AddDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGroup: DeviceGroup | null;
  devices: Device[];
  groupDevices: DeviceInGroup[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export default function AddDevicesModal({
  isOpen,
  onClose,
  selectedGroup,
  devices,
  groupDevices,
  selectedDeviceIds,
  setSelectedDeviceIds,
  onSubmit,
  submitting,
}: AddDevicesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`添加设备到 ${selectedGroup?.name || ''}`}
      size='lg'
    >
      <div className='mb-4'>
        <p className='text-sm text-gray-600'>选择要添加到此分组的设备。未分组的设备将优先显示。</p>
      </div>

      <div className='max-h-96 overflow-y-auto space-y-2'>
        {devices.length === 0 ? (
          <p className='text-center text-gray-500 py-8'>暂无可添加的设备</p>
        ) : (
          devices.map((device) => {
            // 检查设备是否已在分组中（device_id 为业务键）
            const isInGroup = groupDevices.some((gd) => gd.device_id === device.device_id);
            const isSelected = selectedDeviceIds.includes(device.device_id);

            return (
              <div
                key={device.id}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${
                  isInGroup
                    ? 'bg-gray-100 opacity-50'
                    : isSelected
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => {
                  if (!isInGroup) {
                    setSelectedDeviceIds((prev) =>
                      isSelected
                        ? prev.filter((id) => id !== device.device_id)
                        : [...prev, device.device_id]
                    );
                  }
                }}
              >
                <div className='flex items-center'>
                  <input
                    type='checkbox'
                    checked={isSelected || isInGroup}
                    onChange={() => {}}
                    disabled={isInGroup}
                    className='w-4 h-4 text-blue-600 rounded mr-3'
                  />
                  <div
                    className={`w-2 h-2 rounded-full mr-3 ${
                      device.is_online
                        ? 'bg-green-500'
                        : device.is_online === false
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <div>
                    <p className='font-medium text-gray-800'>{device.name}</p>
                    <p className='text-sm text-gray-500'>{device.device_id}</p>
                  </div>
                </div>
                {isInGroup && <Badge variant='default'>已在分组中</Badge>}
              </div>
            );
          })
        )}
      </div>

      <div className='flex justify-between items-center mt-4 pt-4 border-t'>
        <p className='text-sm text-gray-500'>已选择: {selectedDeviceIds.length} 个设备</p>
        <div className='flex space-x-3'>
          <Button variant='outline' onClick={onClose}>
            取消
          </Button>
          <Button
            variant='primary'
            onClick={onSubmit}
            disabled={submitting || selectedDeviceIds.length === 0}
          >
            添加选中设备
          </Button>
        </div>
      </div>
    </Modal>
  );
}
