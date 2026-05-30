import { useState, useEffect } from 'react';

export function useToast() {
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

  return { toasts, showToast, removeToast };
}

export default useToast;
