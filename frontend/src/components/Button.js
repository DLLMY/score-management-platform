import { Loader2 } from 'lucide-react';

function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false,
  className = '',
  onClick 
}) {
  const baseStyles = {
    primary: 'bg-gradient-to-r from-primary-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-primary-500/30',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    success: 'bg-green-500 text-white hover:bg-green-600',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    blue: 'bg-blue-500 text-white hover:bg-blue-600',
    outline: 'border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'px-4 py-2.5 text-sm font-semibold',
    lg: 'px-6 py-3 text-base font-semibold'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 ${
        baseStyles[variant]
      } ${sizeStyles[size]} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'
      } ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export default Button;
