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

export function useModal<T = null>(
  options: UseModalOptions<T> = {}
): UseModalResult<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T>(null as T);

  const { onOpen: onOpenCallback, onClose: onCloseCallback } = options;
  
  const open = useCallback((modalData?: T) => {
    setData(modalData ?? (null as T));
    setIsOpen(true);
    onOpenCallback?.(modalData ?? (null as T));
  }, [onOpenCallback]);

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

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

export interface UseConfirmDialogResult {
  show: (options: ConfirmDialogOptions) => Promise<boolean>;
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  confirm: () => void;
  cancel: () => void;
}

export function useConfirmDialog(): UseConfirmDialogResult {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [resolve, setResolve] = useState<((value: boolean) => void) | null>(null);

  const show = useCallback((dialogOptions: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((res) => {
      setOptions(dialogOptions);
      setIsOpen(true);
      setResolve(res);
    });
  }, []);

  const confirm = useCallback(() => {
    resolve?.(true);
    setResolve(null);
    setIsOpen(false);
    setOptions(null);
  }, [resolve]);

  const cancel = useCallback(() => {
    resolve?.(false);
    setResolve(null);
    setIsOpen(false);
    setOptions(null);
  }, [resolve]);

  return {
    show,
    isOpen,
    options,
    confirm,
    cancel,
  };
}