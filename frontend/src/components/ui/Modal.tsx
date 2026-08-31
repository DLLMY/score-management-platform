import { ReactNode, MouseEventHandler } from 'react';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: (e: React.MouseEvent) => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
}

function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!isOpen) return null;

  const sizeStyles: Record<ModalSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  const handleBackdropClick: MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.target === e.currentTarget) {
      onClose(e);
    }
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center'>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={handleBackdropClick}
      />
      <div
        className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full mx-4 ${sizeStyles[size]} max-h-[85vh] flex flex-col`}
      >
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex-shrink-0'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-slate-100'>{title}</h3>
          <button
            onClick={onClose}
            className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all'
          >
            <X className='w-5 h-5' />
          </button>
        </div>
        <div className='flex-1 overflow-y-auto p-6 min-h-0'>{children}</div>
        {footer && (
          <div className='px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-700/50 flex-shrink-0'>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
