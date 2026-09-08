import { useState, useCallback } from 'react';

export interface UseModalOptions<T = null> {
  onOpen?: (data: T) => void;
  onClose?: () => void;
}

export interface UseModalResult<T = null> {
  isOpen: boolean;
  data: T;
  open: (data?: T) => void;
  close: () => void;
  toggle: () => void;
  updateData: (data: Partial<T>) => void;
}

export function useModal<T = null>(options: UseModalOptions<T> = {}): UseModalResult<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T>(null as T);

  const { onOpen: onOpenCallback, onClose: onCloseCallback } = options;

  const open = useCallback(
    (modalData?: T) => {
      setData(modalData ?? (null as T));
      setIsOpen(true);
      onOpenCallback?.(modalData ?? (null as T));
    },
    [onOpenCallback]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    onCloseCallback?.();
  }, [onCloseCallback]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, close, open]);

  const updateData = useCallback((newData: Partial<T>) => {
    setData((prev) => ({ ...prev, ...newData } as T));
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    updateData,
  };
}
