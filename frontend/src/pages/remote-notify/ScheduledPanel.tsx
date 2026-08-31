// 远程通知 - 左侧「定时通知」卡片 + 定时通知编辑弹窗
import { Calendar, Plus, Play, Pause, Trash2 } from 'lucide-react';
import { PermissionButton, ClassStatusBadge } from '../../components';
import { type RemoteNotifyDeps } from './types';

export function ScheduledPanel({ deps }: { deps: RemoteNotifyDeps }) {
  const {
    scheduledNotifications,
    scheduledForceSend,
    setScheduledForceSend,
    scheduledClassNow,
    editingScheduled,
    scheduledForm,
    setScheduledForm,
    showScheduledModal,
    closeScheduledModal,
    handleUseCurrentFormForScheduled,
    handleTriggerScheduled,
    handleCancelScheduled,
    handleDeleteScheduled,
    handleSaveScheduled,
  } = deps;

  return (
    <>
      <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <Calendar className='w-5 h-5 text-primary-500' />
            定时通知
          </h3>
          <PermissionButton
            permission='notification.send'
            onClick={handleUseCurrentFormForScheduled}
            className='flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 text-sm hover:bg-primary-200 dark:hover:bg-primary-500/30'
          >
            <Plus className='w-4 h-4' />
            新建
          </PermissionButton>
        </div>
        <ClassStatusBadge
          state={scheduledClassNow}
          forceSend={scheduledForceSend}
          onForceSendChange={setScheduledForceSend}
          forceSendLabel='强制发送（跳过上课时间限制，作用于「立即发送」，将记入审计）'
        />
        {scheduledNotifications.length === 0 ? (
          <p className='text-sm text-gray-500 dark:text-slate-400 text-center py-4'>
            暂无定时通知
          </p>
        ) : (
          <div className='space-y-2 max-h-60 overflow-y-auto'>
            {scheduledNotifications.map((item) => (
              <div
                key={item.id}
                className='flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 group'
              >
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'sent'
                          ? 'bg-green-500'
                          : item.status === 'pending'
                          ? 'bg-yellow-500'
                          : item.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    ></span>
                    <span className='text-sm text-gray-700 dark:text-slate-300 truncate'>
                      {item.text}
                    </span>
                  </div>
                  <div className='flex items-center gap-2 mt-1'>
                    <Calendar className='w-3 h-3 text-gray-400' />
                    <span className='text-xs text-gray-500'>
                      {item.next_send_at || item.scheduled_at
                        ? new Date(item.next_send_at || item.scheduled_at).toLocaleString('zh-CN')
                        : '--'}
                    </span>
                    {item.repeat_type !== 'once' && (
                      <span className='text-xs text-primary-500'>
                        {item.repeat_type === 'daily'
                          ? '每天'
                          : item.repeat_type === 'weekly'
                          ? '每周'
                          : '每月'}
                      </span>
                    )}
                  </div>
                </div>
                <div className='hidden group-hover:flex items-center gap-1'>
                  <PermissionButton
                    permission='notification.send'
                    onClick={() => handleTriggerScheduled(item.id)}
                    className='p-1 rounded text-gray-500 hover:text-green-600'
                    title='立即发送'
                  >
                    <Play className='w-4 h-4' />
                  </PermissionButton>
                  {item.status === 'pending' && (
                    <PermissionButton
                      permission='notification.send'
                      onClick={() => handleCancelScheduled(item.id)}
                      className='p-1 rounded text-gray-500 hover:text-yellow-600'
                      title='取消'
                    >
                      <Pause className='w-4 h-4' />
                    </PermissionButton>
                  )}
                  <PermissionButton
                    permission='notification.send'
                    onClick={() => handleDeleteScheduled(item.id)}
                    className='p-1 rounded text-gray-500 hover:text-red-600'
                    title='删除'
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 定时通知编辑弹窗 */}
      {showScheduledModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          {' '}
          {/* L6: 移动端留边 */}
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-lg mx-auto'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-4'>
              {editingScheduled ? '编辑定时通知' : '新建定时通知'}
            </h3>
            <div className='space-y-4 max-h-[70vh] overflow-y-auto'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                  通知内容
                </label>
                <textarea
                  value={scheduledForm.text}
                  onChange={(e) => setScheduledForm((prev) => ({ ...prev, text: e.target.value }))}
                  placeholder='输入通知文本...'
                  rows={3}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 resize-none'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                    发送时间
                  </label>
                  <input
                    type='datetime-local'
                    value={scheduledForm.scheduled_at}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({ ...prev, scheduled_at: e.target.value }))
                    }
                    className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                    重复类型
                  </label>
                  <select
                    value={scheduledForm.repeat_type}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({ ...prev, repeat_type: e.target.value }))
                    }
                    className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                  >
                    <option value='once'>一次性</option>
                    <option value='daily'>每天</option>
                    <option value='weekly'>每周</option>
                    <option value='monthly'>每月</option>
                  </select>
                </div>
              </div>
              {scheduledForm.repeat_type !== 'once' && (
                <>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                        重复间隔
                      </label>
                      <input
                        type='number'
                        min='1'
                        value={scheduledForm.repeat_interval}
                        onChange={(e) =>
                          setScheduledForm((prev) => ({
                            ...prev,
                            repeat_interval: parseInt(e.target.value) || 1,
                          }))
                        }
                        className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                        结束时间（可选）
                      </label>
                      <input
                        type='datetime-local'
                        value={scheduledForm.repeat_end_at}
                        onChange={(e) =>
                          setScheduledForm((prev) => ({ ...prev, repeat_end_at: e.target.value }))
                        }
                        className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                      />
                    </div>
                  </div>
                  {scheduledForm.repeat_type === 'weekly' && (
                    <div className='mt-4'>
                      <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                        选择星期
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              const dayNum = index;
                              setScheduledForm((prev) => ({
                                ...prev,
                                repeat_day_of_week: prev.repeat_day_of_week.includes(dayNum)
                                  ? prev.repeat_day_of_week.filter((d) => d !== dayNum)
                                  : [...prev.repeat_day_of_week, dayNum].sort(),
                              }));
                            }}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              scheduledForm.repeat_day_of_week.includes(index)
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                  发送模式
                </label>
                <select
                  value={scheduledForm.send_mode}
                  onChange={(e) =>
                    setScheduledForm((prev) => ({ ...prev, send_mode: e.target.value }))
                  }
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                >
                  <option value='broadcast'>广播通知</option>
                  <option value='device'>指定设备</option>
                </select>
              </div>
              {scheduledForm.send_mode === 'device' && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                    设备ID
                  </label>
                  <input
                    type='text'
                    value={scheduledForm.device_id}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({ ...prev, device_id: e.target.value }))
                    }
                    placeholder='输入设备ID'
                    className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                  />
                </div>
              )}
              <div className='flex items-center gap-4'>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={scheduledForm.speak}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({ ...prev, speak: e.target.checked }))
                    }
                    className='rounded border-gray-300 text-primary-600 focus:ring-primary-500'
                  />
                  <span className='text-sm text-gray-700 dark:text-slate-300'>语音播报</span>
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={scheduledForm.popup}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({ ...prev, popup: e.target.checked }))
                    }
                    className='rounded border-gray-300 text-primary-600 focus:ring-primary-500'
                  />
                  <span className='text-sm text-gray-700 dark:text-slate-300'>弹窗显示</span>
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={scheduledForm.urgent}
                    onChange={(e) =>
                      setScheduledForm((prev) => ({ ...prev, urgent: e.target.checked }))
                    }
                    className='rounded border-gray-300 text-red-600 focus:ring-red-500'
                  />
                  <span className='text-sm text-gray-700 dark:text-slate-300'>紧急通知</span>
                </label>
              </div>
            </div>
            <div className='flex gap-3 mt-6'>
              <button
                onClick={handleSaveScheduled}
                className='flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600'
              >
                保存
              </button>
              <button
                onClick={closeScheduledModal}
                className='px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
