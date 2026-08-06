import { useEffect, useState, memo, MouseEventHandler } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp, LucideIcon } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastStyle {
  bg: string;
  border: string;
  icon: LucideIcon;
  defaultMessage: string;
  iconBg: string;
}

interface ToastMessage {
  type?: ToastType;
  text?: string;
  details?: string;
  errorFields?: string[];
}

interface ToastProps {
  message: ToastMessage;
  onClose: () => void;
}

const toastStyles: Record<ToastType, ToastStyle> = {
  success: {
    bg: 'bg-white',
    border: 'border-green-100',
    icon: CheckCircle,
    defaultMessage: '操作成功',
    iconBg: 'bg-green-100 text-green-600',
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-100',
    icon: AlertCircle,
    defaultMessage: '操作失败',
    iconBg: 'bg-red-100 text-red-600',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-100',
    icon: AlertTriangle,
    defaultMessage: '请注意',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-100',
    icon: Info,
    defaultMessage: '提示',
    iconBg: 'bg-blue-100 text-blue-600',
  },
};

const Toast = memo<ToastProps>(({ message, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const type: ToastType = message.type || 'info';
  const style: ToastStyle = toastStyles[type] || toastStyles.info;
  const Icon = style.icon;

  const handleClose: MouseEventHandler<HTMLButtonElement> = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className={`fixed top-6 right-6 z-50 w-full max-w-sm ${isClosing ? 'animate-slide-out' : 'animate-slide-in'}`}>
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border ${style.bg} ${style.border} ${isClosing ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      >
        <div className={`w-10 h-10 rounded-lg ${style.iconBg} flex items-center justify-center flex-shrink-0 animate-bounce-in`}>
          <Icon className='w-5 h-5' />
        </div>
        
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <span className={`font-semibold ${type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
              {message.text || style.defaultMessage}
            </span>
            <button
              onClick={handleClose}
              className='p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0'
            >
              <X className='w-4 h-4 text-gray-400 hover:text-gray-600' />
            </button>
          </div>
          
          {(message.details || message.errorFields) && (
            <div className='mt-2'>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className='flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors'
              >
                {showDetails ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
                {showDetails ? '收起详情' : '查看详情'}
              </button>
              
              {showDetails && (
                <div className='mt-2 pl-2 border-l-2 border-gray-200 animate-fade-in'>
                  {message.errorFields && message.errorFields.length > 0 && (
                    <div className='mb-2'>
                      <div className='text-xs font-medium text-gray-500 mb-1'>错误字段：</div>
                      <div className='flex flex-wrap gap-1'>
                        {message.errorFields.map((field, idx) => (
                          <span key={idx} className='px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-xs'>
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.details && (
                    <div className='text-sm text-gray-600 whitespace-pre-wrap'>
                      {message.details}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
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
        
        @keyframes slide-out {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
        
        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        .animate-slide-out {
          animation: slide-out 0.3s ease-in;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
});

export default Toast;
