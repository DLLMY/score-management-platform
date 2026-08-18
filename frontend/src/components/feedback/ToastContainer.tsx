import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { CSSProperties, MouseEventHandler } from 'react';
import { useToast } from '../../context/ToastContext';

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts || toasts.length === 0) {
    return null;
  }

  const containerStyle: CSSProperties = {
    top: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    padding: '20px',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const getToastStyle = (type: string): CSSProperties => ({
    backgroundColor: type === 'success' ? '#22c55e' : '#ef4444',
    color: 'white',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    opacity: 1,
  });

  const buttonStyle: CSSProperties = {
    padding: '4px 8px',
  };

  const handleRemoveToast: MouseEventHandler<HTMLButtonElement> = (e) => {
    const toastId = e.currentTarget.dataset.toastId;
    if (toastId) {
      removeToast(Number(toastId));
    }
  };

  return (
    <div className='fixed space-y-3' style={containerStyle}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className='flex items-center gap-4 px-6 py-4 rounded-xl min-w-[280px] max-w-[450px]'
          style={getToastStyle(toast.type)}
        >
          <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center'>
            {toast.type === 'success' ? (
              <CheckCircle className='w-5 h-5' />
            ) : (
              <AlertCircle className='w-5 h-5' />
            )}
          </div>
          <span className='font-medium flex-1 text-sm leading-relaxed'>{toast.message}</span>
          <button
            data-toast-id={toast.id}
            onClick={handleRemoveToast}
            className='ml-2 p-1 hover:bg-white/20 rounded-full transition-colors'
            style={buttonStyle}
          >
            <X className='w-4 h-4' />
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
