import { useEffect, memo } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const toastStyles = {
  success: {
    bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
    icon: CheckCircle,
    defaultMessage: '操作成功'
  },
  error: {
    bg: 'bg-gradient-to-r from-red-500 to-rose-500',
    icon: AlertCircle,
    defaultMessage: '操作失败'
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    icon: AlertTriangle,
    defaultMessage: '请注意'
  },
  info: {
    bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    icon: Info,
    defaultMessage: '提示'
  }
};

const Toast = memo(({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [onClose]);

  const type = message.type || 'info';
  const style = toastStyles[type] || toastStyles.info;
  const Icon = style.icon;

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl ${style.bg} text-white max-w-sm`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium flex-1">{message.text || style.defaultMessage}</span>
        <button 
          onClick={onClose} 
          className="ml-2 hover:bg-white/20 rounded-lg p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
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
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});

export default Toast;
