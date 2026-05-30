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
  gradient = false,
  type = 'button',
  ariaLabel,
  ariaDisabled,
  tabIndex = 0,
}) {
  const baseStyles = {
    primary: gradient
      ? 'bg-gradient-to-r from-primary-500 via-blue-500 to-indigo-600 text-white hover:shadow-xl hover:shadow-primary-500/40 hover:from-primary-600 hover:via-blue-600 hover:to-indigo-700'
      : 'bg-primary-500 text-white hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/30',
    secondary: gradient
      ? 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 hover:shadow-md'
      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    success: gradient
      ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 text-white hover:shadow-xl hover:shadow-green-500/40'
      : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/30',
    warning: gradient
      ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-slate-900 hover:shadow-xl hover:shadow-yellow-500/40'
      : 'bg-yellow-500 text-slate-900 hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-500/30',
    danger: gradient
      ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 text-white hover:shadow-xl hover:shadow-red-500/40'
      : 'bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30',
    blue: gradient
      ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-600 text-white hover:shadow-xl hover:shadow-blue-500/40'
      : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30',
    purple: gradient
      ? 'bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-600 text-white hover:shadow-xl hover:shadow-purple-500/40'
      : 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/30',
    outline:
      'border-2 border-slate-300 text-slate-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    link: 'text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline',
  };

  const sizeStyles = {
    xs: 'px-2 py-1 text-xs font-medium gap-1.5',
    sm: 'px-3 py-1.5 text-sm font-medium gap-2',
    md: 'px-4 py-2.5 text-sm font-semibold gap-2',
    lg: 'px-6 py-3 text-base font-semibold gap-2.5',
    xl: 'px-8 py-4 text-lg font-bold gap-3',
  };

  const roundedStyles = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  };

  const iconSize = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-disabled={ariaDisabled ?? (disabled || loading)}
      tabIndex={tabIndex}
      className={`
        inline-flex items-center justify-center
        ${baseStyles[variant]}
        ${sizeStyles[size]}
        ${roundedStyles[rounded]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98] hover:scale-[1.02]'}
        focus:outline-none focus:ring-4 focus:ring-primary-500/30 focus:ring-offset-2 focus:ring-offset-transparent
        transition-all duration-200 ease-out
        disabled:active:scale-100
        ${className}
      `}
    >
      {loading && <Loader2 className={`${iconSize[size]} animate-spin`} />}
      {!loading && Icon && iconPosition === 'left' && <Icon className={iconSize[size]} />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon className={iconSize[size]} />}
    </button>
  );
}

export default memo(Button);
