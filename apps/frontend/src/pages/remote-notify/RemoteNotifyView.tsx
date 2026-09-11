import { AlertTriangle, History, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Pagination } from '../../components';
import type { RemoteNotifyDeps } from './types';
import { PresetsPanel } from './PresetsPanel';
import { TemplatesPanel } from './TemplatesPanel';
import { ScheduledPanel } from './ScheduledPanel';
import { SendForm } from './SendForm';
import { HistoryPanel } from './HistoryPanel';

interface RemoteNotifyViewProps {
  deps: RemoteNotifyDeps;
  draftAvailable: boolean;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  loadError: boolean;
  openHistory: () => void;
  mqttConnected: boolean | null;
  scheduled: { total: number };
  scheduledPage: number;
  setScheduledPage: (p: number) => void;
  scheduledPerPage: number;
}

export default function RemoteNotifyView({
  deps,
  draftAvailable,
  handleRestoreDraft,
  handleDiscardDraft,
  loadError,
  openHistory,
  mqttConnected,
  scheduled,
  scheduledPage,
  setScheduledPage,
  scheduledPerPage,
}: RemoteNotifyViewProps) {
  const { showHistory, closeHistory } = deps;
  return (
    <div className='max-w-6xl mx-auto'>
      {draftAvailable && (
        <div className='flex items-center justify-between gap-3 px-4 py-2.5 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-sm'>
          <span className='text-amber-800'>检测到上次未提交的内容，是否恢复？</span>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleRestoreDraft}
              className='px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-xs'
            >
              恢复
            </button>
            <button
              onClick={handleDiscardDraft}
              className='px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs'
            >
              放弃
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            部分数据加载失败（模板/定时通知/历史记录），当前列表可能不完整，请刷新重试
          </p>
        </div>
      )}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-white'>远程通知</h1>
          <p className='text-gray-500 dark:text-slate-400 mt-1'>
            通过MQTT向远程电脑客户端发送通知消息
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => (showHistory ? closeHistory() : openHistory())}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              showHistory
                ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600'
                : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300'
            }`}
          >
            <History className='w-4 h-4' />
            历史记录
          </button>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              mqttConnected === true
                ? 'bg-green-100/80 dark:bg-green-500/20'
                : mqttConnected === false
                ? 'bg-red-100/80 dark:bg-red-500/20'
                : 'bg-gray-100/80 dark:bg-slate-700/50'
            }`}
          >
            {mqttConnected === true ? (
              <Wifi className='w-4 h-4 text-green-600' />
            ) : mqttConnected === false ? (
              <WifiOff className='w-4 h-4 text-red-600' />
            ) : (
              <Loader2 className='w-4 h-4 text-gray-500 animate-spin' />
            )}
            <span
              className={`text-sm font-medium ${
                mqttConnected === true
                  ? 'text-green-700'
                  : mqttConnected === false
                  ? 'text-red-700'
                  : 'text-gray-600'
              }`}
            >
              {mqttConnected === true
                ? 'MQTT已连接'
                : mqttConnected === false
                ? 'MQTT未连接'
                : '检查中...'}
            </span>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* 左侧：快捷预设和模板 */}
        <div className='lg:col-span-1 space-y-6'>
          <PresetsPanel deps={deps} />
          <TemplatesPanel deps={deps} />
          <ScheduledPanel deps={deps} />
          {scheduled.total > 0 && (
            <Pagination
              currentPage={scheduledPage}
              totalPages={Math.max(1, Math.ceil(scheduled.total / scheduledPerPage))}
              onPageChange={setScheduledPage}
              totalItems={scheduled.total}
              itemsPerPage={scheduledPerPage}
            />
          )}
        </div>

        {/* 右侧：发送表单 */}
        <SendForm deps={deps} />
      </div>

      {/* 通知历史记录弹窗 */}
      <HistoryPanel deps={deps} />

      {/* 使用说明 */}
      <div className='mt-6 bg-blue-50/60 dark:bg-blue-500/10 rounded-xl border border-blue-200/50 dark:border-blue-500/20 p-5'>
        <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3'>使用说明</h3>
        <ul className='space-y-2 text-sm text-blue-700 dark:text-blue-400'>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>快捷预设</strong>：点击左侧预设按钮快速加载常用通知内容
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>我的模板</strong>：保存常用通知为模板，支持自定义样式和分类
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>样式设置</strong>：自定义弹窗背景色、文字颜色和播报语言
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>客户端安装</strong>：在{' '}
              <code className='px-2 py-1 bg-white dark:bg-slate-700 rounded text-blue-800'>
                remote_notify
              </code>{' '}
              目录运行{' '}
              <code className='px-2 py-1 bg-white dark:bg-slate-700 rounded text-blue-800'>
                install.bat
              </code>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
