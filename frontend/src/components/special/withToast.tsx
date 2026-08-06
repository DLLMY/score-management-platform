import { useState, useEffect, ComponentType, CSSProperties, MouseEventHandler } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: string;
}

interface ShowToastFunction {
  (message: string, type?: string): void;
}

interface WithToastProps {
  showToast: ShowToastFunction;
}

function withToast<P extends object>(Component: ComponentType<P & WithToastProps>) {
  return function WithToast(props: P) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast: ShowToastFunction = (message, type = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
    };

    const removeToast = (id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    useEffect(() => {
      const timers = toasts.map((toast) => {
        return setTimeout(() => {
          removeToast(toast.id);
        }, 3000);
      });

      return () => {
        timers.forEach(clearTimeout);
      };
    }, [toasts]);

    const getToastStyle = (type: string): CSSProperties => ({
      backgroundColor: type === 'success' ? '#22c55e' : '#ef4444',
      color: 'white',
    });

    const handleRemoveToast: MouseEventHandler<HTMLButtonElement> = (e) => {
      const toastId = Number(e.currentTarget.dataset.toastId);
      removeToast(toastId);
    };

    return (
      <>
        <Component {...props} showToast={showToast} />

        <div className='fixed top-6 right-6 z-50 space-y-3'>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className='animate-slide-in flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg min-w-[200px] max-w-[350px]'
              style={getToastStyle(toast.type)}
            >
              {toast.type === 'success' ? (
                <CheckCircle className='w-5 h-5 flex-shrink-0' />
              ) : (
                <AlertCircle className='w-5 h-5 flex-shrink-0' />
              )}
              <span className='font-medium flex-1'>{toast.message}</span>
              <button
                data-toast-id={toast.id}
                onClick={handleRemoveToast}
                className='ml-2 hover:opacity-80 transition-opacity'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes slide-in {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
        `}</style>
      </>
    );
  };
}

export default withToast;