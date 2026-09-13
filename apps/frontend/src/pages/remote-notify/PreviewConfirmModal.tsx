// 远程通知 - M6: 发送前预览确认弹窗（防误发；preview 失败时不含名单仍可发送）
import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import type { PreviewConfirmState, NotifyPayload } from './types';

interface PreviewConfirmModalProps {
  previewConfirm: PreviewConfirmState;
  isSending: boolean;
  setPreviewConfirm: Dispatch<SetStateAction<PreviewConfirmState | null>>;
  performSend: (
    notifyData: NotifyPayload,
    kind: 'broadcast' | 'device',
    deviceId?: string
  ) => Promise<void>;
}

export function PreviewConfirmModal({
  previewConfirm,
  isSending,
  setPreviewConfirm,
  performSend,
}: PreviewConfirmModalProps) {
  return (
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
      onClick={() => setPreviewConfirm((p) => (p ? { ...p, open: false } : p))}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg mx-auto flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between border-b border-gray-100 dark:border-slate-700 px-6 py-4'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white'>确认发送通知</h3>
          <button
            onClick={() => setPreviewConfirm((p) => (p ? { ...p, open: false } : p))}
            className='rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
            aria-label='关闭'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='px-6 py-4 space-y-3 overflow-y-auto max-h-[60vh]'>
          <p className='text-sm text-gray-700 dark:text-slate-300'>
            将发送到{' '}
            <span className='font-semibold'>
              {previewConfirm.kind === 'broadcast'
                ? '全部设备（广播）'
                : `设备 ${previewConfirm.deviceId}`}
            </span>
          </p>

          {previewConfirm.preview ? (
            <div className='rounded-xl border border-gray-200 dark:border-slate-600 p-4'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-sm text-gray-700 dark:text-slate-300'>
                  设备总数{' '}
                  <span className='font-semibold'>{previewConfirm.preview.total_devices}</span> 台 ·
                  当前在线{' '}
                  <span className='font-semibold'>{previewConfirm.preview.online_count}</span> 台 （
                  {previewConfirm.preview.cutoff_minutes} 分钟内心跳）
                </p>
                {previewConfirm.preview.online_count > 0 &&
                  previewConfirm.preview.online_sample.length > 0 && (
                    <button
                      onClick={() =>
                        setPreviewConfirm((p) => (p ? { ...p, expanded: !p.expanded } : p))
                      }
                      className='shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline'
                    >
                      {previewConfirm.expanded ? '收起名单' : '展开名单'}
                    </button>
                  )}
              </div>

              {previewConfirm.expanded && (
                <div className='mt-3 border-t border-gray-100 dark:border-slate-700 pt-3'>
                  {/* M1 规范：小名单用 div 网格而非原生 table */}
                  <div className='grid grid-cols-12 gap-2 text-xs'>
                    <div className='col-span-4 font-medium text-gray-500 dark:text-slate-400'>
                      设备ID
                    </div>
                    <div className='col-span-3 font-medium text-gray-500 dark:text-slate-400'>
                      班级
                    </div>
                    <div className='col-span-5 font-medium text-gray-500 dark:text-slate-400'>
                      最近心跳
                    </div>
                  </div>
                  {previewConfirm.preview.online_sample.map((item) => (
                    <div
                      key={item.device_id}
                      className='grid grid-cols-12 gap-2 border-t border-gray-50 py-1.5 text-xs dark:border-slate-700/60'
                    >
                      <div className='col-span-4 truncate font-mono text-gray-700 dark:text-slate-300'>
                        {item.device_id}
                      </div>
                      <div className='col-span-3 truncate text-gray-600 dark:text-slate-400'>
                        {item.class_name || '—'}
                      </div>
                      <div className='col-span-5 truncate text-gray-500 dark:text-slate-400'>
                        {formatDateTime(item.last_heartbeat, '—')}
                      </div>
                    </div>
                  ))}
                  <p className='mt-2 text-xs text-gray-400 dark:text-slate-500'>
                    仅显示最近活跃前 20 台
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className='text-sm text-gray-400 dark:text-slate-500'>
              （在线预览暂不可用，仍可发送）
            </p>
          )}

          <p className='text-xs text-amber-600 dark:text-amber-400'>
            上课时间可能被系统拦截，可在选项勾选强制发送
          </p>
        </div>

        <div className='flex justify-end gap-3 border-t border-gray-100 dark:border-slate-700 px-6 py-4'>
          <button
            onClick={() => setPreviewConfirm((p) => (p ? { ...p, open: false } : p))}
            className='rounded-lg border border-gray-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700'
          >
            取消
          </button>
          <button
            onClick={() => {
              const pc = previewConfirm;
              setPreviewConfirm(null);
              void performSend(pc.notifyData, pc.kind, pc.deviceId);
            }}
            disabled={isSending}
            className='rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-60'
          >
            确认发送
          </button>
        </div>
      </div>
    </div>
  );
}
