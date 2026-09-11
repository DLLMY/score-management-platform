import { Button, Modal } from '../../components';
import type { FormErrors } from '../../hooks';
import type { NewDeviceForm } from './types';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  device_id: string;
  name: string;
  errors: FormErrors<NewDeviceForm>;
  onChange: (field: 'device_id' | 'name', value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function AddDeviceModal({
  isOpen,
  onClose,
  device_id,
  name,
  errors,
  onChange,
  submitting,
  onSubmit,
}: AddDeviceModalProps) {
  return (
    <Modal
      title='添加设备'
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            确认添加
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>设备ID *</label>
          <input
            type='text'
            value={device_id}
            onChange={(e) => onChange('device_id', e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='输入设备ID'
          />
          {errors.device_id && <p className='text-sm text-red-500 mt-1'>{errors.device_id}</p>}
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>设备名称</label>
          <input
            type='text'
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='输入设备名称'
          />
        </div>
      </div>
    </Modal>
  );
}
