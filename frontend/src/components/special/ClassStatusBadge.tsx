import { memo } from 'react';
import { AlertTriangle, CheckCircle, Clock, HelpCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import type { ClassNowStatusResult } from '../../hooks/useClassNowStatus';

export interface ClassStatusBadgeProps {
  /** useClassNowStatus() 的返回值 */
  state: ClassNowStatusResult;
  /** 强制发送开关（受控）。不传则不渲染复选框 */
  forceSend?: boolean;
  onForceSendChange?: (value: boolean) => void;
  /** 复选框旁的说明文案 */
  forceSendLabel?: string;
  className?: string;
}

/**
 * 「班级实时状态」徽章 + 强制发送开关。
 *
 * 注意：内联权限门控**不能**用 PermissionGuard —— 它在无权限时会渲染整屏「权限不足」页，
 * 会把整个下发页面顶掉。这里直接用 usePermissions 判断，无权限时静默隐藏复选框。
 */
function ClassStatusBadge({
  state,
  forceSend,
  onForceSendChange,
  forceSendLabel = '强制发送（跳过上课时间限制，将记入审计）',
  className = '',
}: ClassStatusBadgeProps) {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canForceSend = isSuperAdmin || hasPermission('notification.force_send');

  const { loading, error, blocked, label, refresh } = state;

  const tone = loading || error
    ? {
        wrap: 'bg-gray-50 border-gray-200 dark:bg-slate-800 dark:border-slate-700',
        text: 'text-gray-600 dark:text-slate-300',
        Icon: error ? HelpCircle : Clock,
      }
    : blocked
      ? {
          wrap: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900',
          text: 'text-red-700 dark:text-red-300',
          Icon: AlertTriangle,
        }
      : {
          wrap: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-900',
          text: 'text-green-700 dark:text-green-300',
          Icon: CheckCircle,
        };

  const { Icon } = tone;
  const showForceSend = canForceSend && typeof forceSend === 'boolean' && !!onForceSendChange;

  return (
    <div className={`rounded-lg border px-3 py-2 ${tone.wrap} ${className}`}>
      <div className='flex items-center gap-2 flex-wrap'>
        <Icon className={`w-4 h-4 shrink-0 ${tone.text} ${loading ? 'animate-pulse' : ''}`} aria-hidden='true' />
        <span className={`text-sm font-medium ${tone.text}`} role='status' aria-live='polite'>
          {label}
        </span>
        <button
          type='button'
          onClick={refresh}
          title='刷新上课状态'
          aria-label='刷新上课状态'
          className={`ml-auto p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${tone.text}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showForceSend && (
        <label className='mt-2 flex items-start gap-2 cursor-pointer select-none'>
          <input
            type='checkbox'
            checked={forceSend}
            onChange={(e) => onForceSendChange?.(e.target.checked)}
            className='mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer'
          />
          <span className='text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1'>
            <ShieldAlert className='w-3.5 h-3.5 shrink-0' aria-hidden='true' />
            {forceSendLabel}
          </span>
        </label>
      )}
    </div>
  );
}

export default memo(ClassStatusBadge);
