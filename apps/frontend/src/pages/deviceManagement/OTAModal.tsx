import { Button, Modal } from '../../components';
import type { OTAForm } from './types';

interface OTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceLabel: string;
  otaForm: OTAForm;
  onChange: (field: keyof OTAForm, value: unknown) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function OTAModal({
  isOpen,
  onClose,
  deviceLabel,
  otaForm,
  onChange,
  submitting,
  onSubmit,
}: OTAModalProps) {
  return (
    <Modal
      title={`OTA固件升级 - ${deviceLabel}`}
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !otaForm.firmware_url}>
            开始升级
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <p className='text-sm text-gray-600'>
          设备必须在线才能执行OTA升级。升级过程中设备将自动下载固件并重启。
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
