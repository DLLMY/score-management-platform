import logger from '../utils/logger';
import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, Undo2, X } from 'lucide-react';

interface Operation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'batch';
  description: string;
  timestamp: number;
  undo?: () => void | Promise<void>;
  redo?: () => void | Promise<void>;
}

interface UseUndoRedoOptions {
  maxHistory?: number;
  autoHideDelay?: number;
}

export function useUndoRedo(options: UseUndoRedoOptions = {}) {
  const { maxHistory = 50, autoHideDelay = 5000 } = options;

  const [history, setHistory] = useState<Operation[]>([]);
  const [currentPosition, setCurrentPosition] = useState<number>(-1);
  const [visibleNotifications, setVisibleNotifications] = useState<Set<string>>(new Set());

  const addOperation = useCallback(
    (operation: Omit<Operation, 'id' | 'timestamp'>) => {
      const newOperation: Operation = {
        ...operation,
        id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const newHistory = [...prev.slice(0, currentPosition + 1), newOperation];
        return newHistory.slice(-maxHistory);
      });

      setCurrentPosition((prev) => Math.min(prev + 1, maxHistory - 1));

      setVisibleNotifications((prev) => new Set(prev).add(newOperation.id));

      setTimeout(() => {
        setVisibleNotifications((prev) => {
          const next = new Set(prev);
          next.delete(newOperation.id);
          return next;
        });
      }, autoHideDelay);
    },
    [currentPosition, maxHistory, autoHideDelay]
  );

  const undo = useCallback(async () => {
    if (currentPosition < 0) return;

    const operation = history[currentPosition];
    if (operation.undo) {
      try {
        await operation.undo();
        setCurrentPosition((prev) => prev - 1);
      } catch (error) {
        logger.error('撤销失败:', error);
      }
    }
  }, [currentPosition, history]);

  const redo = useCallback(async () => {
    if (currentPosition >= history.length - 1) return;

    const operation = history[currentPosition + 1];
    if (operation.redo) {
      try {
        await operation.redo();
        setCurrentPosition((prev) => prev + 1);
      } catch (error) {
        logger.error('重做失败:', error);
      }
    }
  }, [currentPosition, history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentPosition(-1);
    setVisibleNotifications(new Set());
  }, []);

  return {
    history,
    currentPosition,
    canUndo: currentPosition >= 0,
    canRedo: currentPosition < history.length - 1,
    addOperation,
    undo,
    redo,
    clearHistory,
    visibleNotifications,
  };
}

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmDialogOptions | null>(null);

  const show = useCallback((options: ConfirmDialogOptions) => {
    setDialog(options);
  }, []);

  const cancel = useCallback(() => {
    dialog?.onCancel?.();
    setDialog(null);
  }, [dialog]);

  return {
    show,
    cancel,
  };
}

interface ToastNotificationProps {
  operation: Operation;
  onUndo?: () => void;
  onDismiss: () => void;
}

function ToastNotification({ operation, onUndo, onDismiss }: ToastNotificationProps) {
  const isSuccess = operation.type !== 'delete';

  return (
    <div className='fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300'>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
          isSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}
      >
        {isSuccess ? (
          <CheckCircle className='w-5 h-5 text-green-500 flex-shrink-0' />
        ) : (
          <XCircle className='w-5 h-5 text-red-500 flex-shrink-0' />
        )}
        <div className='flex-1 min-w-0'>
          <p className={`text-sm font-medium ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>
            {operation.description}
          </p>
        </div>
        {operation.undo && (
          <button
            onClick={onUndo}
            className='flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors'
          >
            <Undo2 className='w-3 h-3' />
            撤销
          </button>
        )}
        <button
          onClick={onDismiss}
          className='p-1 text-gray-400 hover:text-gray-600 transition-colors'
        >
          <X className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}

export { ToastNotification };
export default useUndoRedo;
