// 远程通知 - 发送模式切换（广播/指定设备/测试/积分变化）
import { Radio, Monitor, TestTube, Bookmark } from 'lucide-react';
import type { NotifyMode } from './types';

interface ModeSelectorProps {
  mode: NotifyMode;
  setMode: (mode: NotifyMode) => void;
}

export function ModeSelector({ mode, setMode }: ModeSelectorProps) {
  return (
    <div className='flex gap-4 mb-6'>
      <button
        onClick={() => setMode('broadcast')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          mode === 'broadcast'
            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
            : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'
        }`}
      >
        <Radio className='w-5 h-5' />
        广播通知
      </button>
      <button
        onClick={() => setMode('device')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          mode === 'device'
            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
            : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'
        }`}
      >
        <Monitor className='w-5 h-5' />
        指定设备
      </button>
      <button
        onClick={() => setMode('test')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          mode === 'test'
            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
            : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'
        }`}
      >
        <TestTube className='w-5 h-5' />
        测试通知
      </button>
      <button
        onClick={() => setMode('score_change')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          mode === 'score_change'
            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
            : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'
        }`}
      >
        <Bookmark className='w-5 h-5' />
        积分变化
      </button>
    </div>
  );
}
