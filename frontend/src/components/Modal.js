import { X } from 'lucide-react';

function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full mx-4 ${sizeStyles[size]} max-h-[90vh] overflow-hidden flex flex-col`}
      >
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
          <button
            onClick={onClose}
            className='p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all'
          >
            <X className='w-5 h-5' />
          </button>
        </div>
        <div className='flex-1 overflow-y-auto p-6'>{children}</div>
        {footer && (
          <div className='px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50'>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
