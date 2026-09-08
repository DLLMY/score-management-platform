import { memo, useState, ReactNode, MouseEventHandler, CSSProperties } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'blue'
  | 'purple'
  | 'outline'
  | 'ghost'
  | 'link';

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type ButtonRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rounded?: ButtonRounded;
  gradient?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  ariaDisabled?: boolean;
  tabIndex?: number;
  ripple?: boolean;
  glow?: boolean;
  primary?: boolean;
  danger?: boolean;
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  style,
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
  ripple = false,
  glow = false,
  primary = false,
  danger = false,
}: ButtonProps) {
  const resolvedVariant = danger ? 'danger' : primary ? 'primary' : variant;
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  const baseStyles: Record<ButtonVariant, string> = {
    primary: gradient
      ? 'bg-gradient-to-r from-primary-500 via-blue-500 to-indigo-600 text-white shadow-lg shadow-primary-500/30'
      : 'bg-primary-500 text-white shadow-md shadow-primary-500/20',
    secondary: gradient
      ? 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 shadow-md'
      : 'bg-slate-100 text-slate-700 shadow-sm',
    success: gradient
      ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 text-white shadow-lg shadow-green-500/30'
      : 'bg-green-500 text-white shadow-md shadow-green-500/20',
    warning: gradient
      ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-slate-900 shadow-lg shadow-yellow-500/30'
      : 'bg-yellow-500 text-slate-900 shadow-md shadow-yellow-500/20',
    danger: gradient
      ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 text-white shadow-lg shadow-red-500/30'
      : 'bg-red-500 text-white shadow-md shadow-red-500/20',
    blue: gradient
      ? 'bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-600 text-white shadow-lg shadow-blue-500/30'
      : 'bg-blue-500 text-white shadow-md shadow-blue-500/20',
    purple: gradient
      ? 'bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-600 text-white shadow-lg shadow-purple-500/30'
      : 'bg-purple-500 text-white shadow-md shadow-purple-500/20',
    outline: 'border-2 border-slate-300 text-slate-700 bg-transparent',
    ghost: 'text-slate-600 bg-transparent',
    link: 'text-primary-600 bg-transparent',
  };

  const hoverStyles: Record<ButtonVariant, string> = {
    primary: gradient
      ? 'hover:shadow-xl hover:shadow-primary-500/40 hover:from-primary-600 hover:via-blue-600 hover:to-indigo-700'
      : 'hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/30',
    secondary: gradient ? 'hover:shadow-lg' : 'hover:bg-slate-200',
    success: gradient
      ? 'hover:shadow-xl hover:shadow-green-500/40'
      : 'hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/30',
    warning: gradient
      ? 'hover:shadow-xl hover:shadow-yellow-500/40'
      : 'hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-500/30',
    danger: gradient
      ? 'hover:shadow-xl hover:shadow-red-500/40'
      : 'hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30',
    blue: gradient
      ? 'hover:shadow-xl hover:shadow-blue-500/40'
      : 'hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30',
    purple: gradient
      ? 'hover:shadow-xl hover:shadow-purple-500/40'
      : 'hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/30',
    outline: 'hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50',
    ghost: 'hover:text-slate-900 hover:bg-slate-100',
    link: 'hover:text-primary-700 hover:underline',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    xs: 'px-2 py-1 text-xs font-medium gap-1.5',
    sm: 'px-3 py-1.5 text-sm font-medium gap-2',
    md: 'px-4 py-2.5 text-sm font-semibold gap-2',
    lg: 'px-6 py-3 text-base font-semibold gap-2.5',
    xl: 'px-8 py-4 text-lg font-bold gap-3',
  };

  const roundedStyles: Record<ButtonRounded, string> = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-xl',
    full: 'rounded-full',
  };

  const iconSize: Record<ButtonSize, string> = {
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
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`
        relative inline-flex items-center justify-center overflow-hidden
        ${baseStyles[resolvedVariant]}
        ${hoverStyles[resolvedVariant]}
        ${sizeStyles[size]}
        ${roundedStyles[rounded]}
        ${fullWidth ? 'w-full' : ''}
        ${glow && !disabled && !loading ? 'animate-pulse-glow' : ''}
        ${ripple ? 'btn-ripple' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-4 focus:ring-primary-500/30 focus:ring-offset-2 focus:ring-offset-transparent
        transition-all duration-300 ease-out
        ${!disabled && !loading ? `hover:scale-[1.02] active:scale-[0.97]` : ''}
        ${isHovered && !disabled && !loading ? 'hover:-translate-y-0.5' : ''}
        ${isPressed && !disabled && !loading ? 'translate-y-0' : ''}
        ${className}
      `}
    >
      {ripple && !disabled && !loading && (
        <span className='absolute inset-0 overflow-hidden pointer-events-none'>
          <span className='block w-full h-full bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300' />
        </span>
      )}
      {loading && <Loader2 className={`${iconSize[size]} animate-spin`} />}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon
          className={`${iconSize[size]} transition-transform duration-300 ${
            isHovered ? 'scale-110' : ''
          }`}
        />
      )}
      <span className='relative z-10 inline-flex items-center gap-2'>{children}</span>
      {!loading && Icon && iconPosition === 'right' && (
        <Icon
          className={`${iconSize[size]} transition-transform duration-300 ${
            isHovered ? 'scale-110' : ''
          }`}
        />
      )}
    </button>
  );
}

export default memo(Button);
