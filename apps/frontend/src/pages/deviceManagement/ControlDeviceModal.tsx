import { RefreshCw, Unlock, Monitor } from 'lucide-react';
import { Button, Modal } from '../../components';

interface ControlDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceLabel: string;
  controlAction: string;
  setControlAction: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function ControlDeviceModal({
  isOpen,
  onClose,
  deviceLabel,
  controlAction,
  setControlAction,
  submitting,
  onSubmit,
}: ControlDeviceModalProps) {
  return (
    <Modal
      title={`远程控制 - ${deviceLabel}`}
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !controlAction}>
            发送指令
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <p className='text-sm text-gray-600'>选择要执行的远程操作（设备必须在线才能执行操作）</p>
        <div className='grid grid-cols-2 gap-3'>
          <button
            onClick={() => setControlAction('restart')}
            className={`p-4 rounded-lg border-2 transition-all ${
              controlAction === 'restart'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <RefreshCw className='w-6 h-6 mx-auto mb-2 text-blue-600' />
            <p className='font-medium'>重启设备</p>
            <p className='text-xs text-gray-500'>远程重启ESP32</p>
          </button>
          <button
            onClick={() => setControlAction('unlock_a')}
            className={`p-4 rounded-lg border-2 transition-all ${
              controlAction === 'unlock_a'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Unlock className='w-6 h-6 mx-auto mb-2 text-green-600' />
            <p className='font-medium'>开A箱</p>
            <p className='text-xs text-gray-500'>远程打开A箱门</p>
          </button>
          <button
            onClick={() => setControlAction('unlock_b')}
            className={`p-4 rounded-lg border-2 transition-all ${
              controlAction === 'unlock_b'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Unlock className='w-6 h-6 mx-auto mb-2 text-green-600' />
            <p className='font-medium'>开B箱</p>
            <p className='text-xs text-gray-500'>远程打开B箱门</p>
          </button>
          <button
            onClick={() => setControlAction('status')}
            className={`p-4 rounded-lg border-2 transition-all ${
              controlAction === 'status'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Monitor className='w-6 h-6 mx-auto mb-2 text-blue-600' />
            <p className='font-medium'>状态查询</p>
            <p className='text-xs text-gray-500'>获取设备状态</p>
          </button>
        </div>
      </div>
    </Modal>
  );
}
