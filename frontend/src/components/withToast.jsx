import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

function withToast(Component) {
  return function WithToast(props) {
    const [toasts, setToasts] = useState([]);

    const showToast = (message, type = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
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

    return (
      <>
        <Component {...props} showToast={showToast} />

        <div className='fixed top-6 right-6 z-50 space-y-3'>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className='animate-slide-in flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg min-w-[200px] max-w-[350px]'
              style={{
                backgroundColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
                color: 'white',
              }}
            >
              {toast.type === 'success' ? (
                <CheckCircle className='w-5 h-5 flex-shrink-0' />
              ) : (
                <AlertCircle className='w-5 h-5 flex-shrink-0' />
              )}
              <span className='font-medium flex-1'>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
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
