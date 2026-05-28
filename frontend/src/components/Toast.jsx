import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = message.type === 'success';

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg ${
        isSuccess 
          ? 'bg-green-500 text-white' 
          : 'bg-red-500 text-white'
      }`}>
        {isSuccess ? (
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <span className="font-medium">{message.text}</span>
        <button 
          onClick={onClose} 
          className="ml-4 hover:opacity-80 transition-opacity"
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
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Toast;
