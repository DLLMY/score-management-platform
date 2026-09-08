import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * 替代 window.confirm 的异步确认钩子。
 * 若上层未挂载 ConfirmProvider，则降级为 window.confirm（保证不破坏既有调用）。
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return (options: ConfirmOptions) =>
      Promise.resolve(window.confirm(typeof options.message === 'string' ? options.message : '确认操作？'));
  }
  return ctx.confirm;
}

const typeMeta: Record<ConfirmType, { icon: typeof Info; accent: string; confirmBg: string }> = {
  danger: { icon: AlertCircle, accent: 'text-red-500', confirmBg: 'bg-red-500 hover:bg-red-600' },
  warning: { icon: AlertTriangle, accent: 'text-amber-500', confirmBg: 'bg-amber-500 hover:bg-amber-600' },
  info: { icon: Info, accent: 'text-blue-500', confirmBg: 'bg-blue-500 hover:bg-blue-600' },
  success: { icon: CheckCircle2, accent: 'text-green-500', confirmBg: 'bg-green-500 hover:bg-green-600' },
};

function ConfirmDialogUI({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const type = options.type ?? 'warning';
  const meta = typeMeta[type];
  const Icon = meta.icon;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4'
      onClick={onCancel}
      role='presentation'
    >
      <div
        className='w-full max-w-md rounded-2xl bg-white shadow-2xl'
        onClick={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
      >
        <div className='flex items-start gap-4 p-6'>
          <div className={`mt-0.5 shrink-0 ${meta.accent}`}>
            <Icon className='h-7 w-7' />
          </div>
          <div className='flex-1'>
            <h3 className='text-lg font-semibold text-slate-800'>
              {options.title ?? '确认操作'}
            </h3>
            <div className='mt-1.5 text-sm leading-relaxed text-slate-600'>
              {options.message}
            </div>
          </div>
          <button
            onClick={onCancel}
            className='shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
            aria-label='关闭'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
        <div className='flex justify-end gap-3 border-t border-slate-100 px-6 py-4'>
          <button
            onClick={onCancel}
            className='rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50'
          >
            {options.cancelText ?? '取消'}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${meta.confirmBg}`}
          >
            {options.confirmText ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 全局确认弹窗 Provider：在应用根部挂载一次，页面内用 useConfirm() 调用。
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolver(() => resolve);
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver?.(result);
    setIsOpen(false);
    setOptions(null);
    setResolver(null);
  }, [resolver]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <ConfirmDialogUI
          options={options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export default ConfirmDialogUI;
