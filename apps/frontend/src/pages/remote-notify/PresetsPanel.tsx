// 远程通知 - 左侧「快捷预设」卡片
import { Clock } from 'lucide-react';
import { QUICK_PRESETS, type RemoteNotifyDeps } from './types';

export function PresetsPanel({ deps }: { deps: RemoteNotifyDeps }) {
  return (
    <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-4'>
      <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2'>
        <Clock className='w-5 h-5 text-primary-500' />
        快捷预设
      </h3>
      <div className='space-y-2'>
        {QUICK_PRESETS.map((preset, index) => (
          <button
            key={index}
            onClick={() => deps.handleUsePreset(preset)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
              preset.urgent
                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20'
                : 'bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600/50'
            }`}
          >
            <span className='font-medium'>{preset.name}</span>
            {preset.urgent && (
              <span className='ml-2 text-xs bg-red-500 text-white px-1 rounded'>紧急</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
