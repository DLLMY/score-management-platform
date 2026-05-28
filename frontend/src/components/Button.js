import { memo } from 'react';
import { Loader2 } from 'lucide-react';

function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false,
  className = '',
  onClick,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = 'xl',
  gradient = false
}) {
  const baseStyles = {
    primary: gradient 
      ? 'bg-gradient-to-r from-primary-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-primary-500/30 hover:from-primary-600 hover:to-indigo-700'
      : 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: gradient
      ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:shadow-md'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    success: gradient
      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/30'
      : 'bg-green-500 text-white hover:bg-green-600',
    warning: gradient
      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-lg hover:shadow-yellow-500/30'
      : 'bg-yellow-500 text-white hover:bg-yellow-600',
    danger: gradient
      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg hover:shadow-red-500/30'
      : 'bg-red-500 text-white hover:bg-red-600',
    blue: gradient
      ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:shadow-lg hover:shadow-blue-500/30'
      : 'bg-blue-500 text-white hover:bg-blue-600',
    purple: gradient
      ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:shadow-lg hover:shadow-purple-500/30'
      : 'bg-purple-500 text-white hover:bg-purple-600',
    outline: 'border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
    link: 'text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline'
  };

  const sizeStyles = {
    xs: 'px-2 py-1 text-xs font-medium',
    sm: 'px-3 py-1.5 text-sm font-medium',
    md: 'px-4 py-2.5 text-sm font-semibold',
    lg: 'px-6 py-3 text-base font-semibold',
    xl: 'px-8 py-4 text-lg font-bold'
  };

  const roundedStyles = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 transition-all duration-200
        ${baseStyles[variant]}
        ${sizeStyles[size]}
        ${roundedStyles[rounded]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98] hover:scale-[1.02]'}
        ${className}
      `}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && Icon && iconPosition === 'left' && <Icon className="w-4 h-4" />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon className="w-4 h-4" />}
    </button>
  );
}

export default memo(Button);
