import { RefreshCw } from 'lucide-react';
import { Button, Modal, Badge } from '../../components';
import { formatRelativeTime } from '../../utils/format';
import type { OTAProgressData } from './types';

interface OTAProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  otaProgressData: OTAProgressData;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function OTAProgressModal({
  isOpen,
  onClose,
  otaProgressData,
  isRefreshing,
  onRefresh,
}: OTAProgressModalProps) {
  return (
    <Modal
      title='OTA升级进度'
      isOpen={isOpen}
      onClose={onClose}
      size='lg'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            关闭
          </Button>
          <Button onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='grid grid-cols-3 gap-4 mb-4'>
          <div className='bg-yellow-50 p-3 rounded-lg text-center'>
            <p className='text-2xl font-bold text-yellow-600'>
              {otaProgressData.summary.in_progress_count}
            </p>
            <p className='text-sm text-yellow-600'>进行中</p>
          </div>
          <div className='bg-green-50 p-3 rounded-lg text-center'>
            <p className='text-2xl font-bold text-green-600'>
              {otaProgressData.summary.completed_count}
            </p>
            <p className='text-sm text-green-600'>已完成</p>
          </div>
          <div className='bg-red-50 p-3 rounded-lg text-center'>
            <p className='text-2xl font-bold text-red-600'>
              {otaProgressData.summary.failed_count}
            </p>
            <p className='text-sm text-red-600'>失败</p>
          </div>
        </div>
        {otaProgressData.in_progress.length === 0 ? (
          <p className='text-center text-gray-500 py-4'>暂无正在进行的升级</p>
        ) : (
          <div className='space-y-3'>
            {otaProgressData.in_progress.map((item) => (
              <div key={item.id} className='border border-gray-200 rounded-lg p-4'>
                <div className='flex items-center justify-between mb-2'>
                  <div>
                    <p className='font-medium text-gray-900'>
                      {item.device_name || item.device_id}
                    </p>
                    <p className='text-sm text-gray-500 font-mono'>{item.device_id}</p>
                  </div>
                  <div className='text-right'>
                    <Badge variant='warning'>升级中</Badge>
                  </div>
                </div>
                <div className='flex items-center gap-4 text-sm text-gray-600'>
                  <span>
                    {item.from_version || '未知'} → {item.to_version}
                  </span>
                  <span>开始时间: {formatRelativeTime(item.started_at, '-')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
