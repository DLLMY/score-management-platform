import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Undo2, X, CheckCircle, AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  undoAction?: () => void;
  undoLabel?: string;
  details?: string;
  errorFields?: string[];
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, options?: { undoAction?: () => void; undoLabel?: string; details?: string; errorFields?: string[] }) => void;
  removeToast: (id: number) => void;
}

interface ToastProviderProps {
  children: ReactNode;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [expandedToasts, setExpandedToasts] = useState<Set<number>>(new Set());

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, options?: { undoAction?: () => void; undoLabel?: string; details?: string; errorFields?: string[] }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, ...options }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    setExpandedToasts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleUndo = (toast: ToastItem) => {
    if (toast.undoAction) {
      toast.undoAction();
    }
    removeToast(toast.id);
  };

  const toggleExpand = (id: number) => {
    setExpandedToasts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const timers = toasts.map((toast) => {
      const duration = toast.undoAction ? 5000 : 5000;
      return setTimeout(() => {
        removeToast(toast.id);
      }, duration);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts]);

  const getToastStyles = (type: string) => {
    const styles = {
      success: {
        bg: 'bg-white',
        border: 'border-green-100',
        text: 'text-green-800',
        iconBg: 'bg-green-100 text-green-600',
        icon: CheckCircle,
      },
      error: {
        bg: 'bg-white',
        border: 'border-red-100',
        text: 'text-red-800',
        iconBg: 'bg-red-100 text-red-600',
        icon: AlertCircle,
      },
      warning: {
        bg: 'bg-white',
        border: 'border-amber-100',
        text: 'text-amber-800',
        iconBg: 'bg-amber-100 text-amber-600',
        icon: AlertTriangle,
      },
      info: {
        bg: 'bg-white',
        border: 'border-blue-100',
        text: 'text-blue-800',
        iconBg: 'bg-blue-100 text-blue-600',
        icon: Info,
      },
    };
    return styles[type as keyof typeof styles] || styles.info;
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className='fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm'>
        {toasts.map((toast) => {
          const style = getToastStyles(toast.type);
          const Icon = style.icon;
          const isExpanded = expandedToasts.has(toast.id);

          return (
            <div
              key={toast.id}
              className={`${style.bg} ${style.border} border rounded-xl shadow-lg px-4 py-3 animate-in slide-in-from-right-full duration-300`}
            >
              <div className='flex items-start gap-3'>
                <div className={`w-10 h-10 rounded-lg ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className='w-5 h-5' />
                </div>
                
                <div className='flex-1 min-w-0'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className={`font-semibold text-sm ${style.text}`}>
                      {toast.message}
                    </p>
                    <button
                      onClick={() => removeToast(toast.id)}
                      className='p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0'
                    >
                      <X className='w-4 h-4 text-gray-400 hover:text-gray-600' />
                    </button>
                  </div>
                  
                  {(toast.details || toast.errorFields) && (
                    <div className='mt-2'>
                      <button
                        onClick={() => toggleExpand(toast.id)}
                        className='flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors'
                      >
                        {isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
                        {isExpanded ? '收起详情' : '查看详情'}
                      </button>
                      
                      {isExpanded && (
                        <div className='mt-2 pl-2 border-l-2 border-gray-200'>
                          {toast.errorFields && toast.errorFields.length > 0 && (
                            <div className='mb-2'>
                              <div className='text-xs font-medium text-gray-500 mb-1'>错误字段：</div>
                              <div className='flex flex-wrap gap-1'>
                                {toast.errorFields.map((field, idx) => (
                                  <span key={idx} className='px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-xs'>
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {toast.details && (
                            <div className='text-sm text-gray-600 whitespace-pre-wrap'>
                              {toast.details}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {toast.undoAction && (
                    <button
                      onClick={() => handleUndo(toast)}
                      className='mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700'
                    >
                      <Undo2 className='w-4 h-4' />
                      {toast.undoLabel || '撤销'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastContext;
