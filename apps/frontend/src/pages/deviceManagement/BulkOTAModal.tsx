import { Button, Modal } from '../../components';
import type { OTAForm } from './types';

interface BulkOTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  otaForm: OTAForm;
  onChange: (field: keyof OTAForm, value: unknown) => void;
  onlineCount: number;
  submitting: boolean;
  onSubmit: () => void;
}

export function BulkOTAModal({
  isOpen,
  onClose,
  otaForm,
  onChange,
  onlineCount,
  submitting,
  onSubmit,
}: BulkOTAModalProps) {
  return (
    <Modal
      title='批量OTA固件升级'
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !otaForm.firmware_url}>
            开始批量升级
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <p className='text-sm text-gray-600'>
          将向所有在线设备发送OTA升级指令。升级过程中设备将自动下载固件并重启。当前在线设备数：
          <span className='font-medium text-green-600'>{onlineCount}</span>
        </p>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>固件下载URL *</label>
          <input
            type='text'
            value={otaForm.firmware_url}
            onChange={(e) => onChange('firmware_url', e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='输入固件下载地址'
          />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>目标版本</label>
          <input
            type='text'
            value={otaForm.version}
            onChange={(e) => onChange('version', e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='如: v1.2.0（可选）'
          />
        </div>
        <div>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input
              type='checkbox'
              checked={otaForm.force}
              onChange={(e) => onChange('force', e.target.checked)}
              className='w-4 h-4 text-blue-600 rounded'
            />
            <span className='text-sm text-gray-600'>强制升级（忽略版本检查）</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
