import { memo, useState, ReactNode, MouseEventHandler } from 'react';
import { LucideIcon } from 'lucide-react';

type CardVariant = 'default' | 'dark' | 'elevated' | 'glass' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';
type IconVariant = 'circle' | 'square' | 'hexagon';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
  headerClass?: string;
  variant?: CardVariant;
  gradient?: boolean;
  hover?: boolean;
  glow?: boolean;
  glass?: boolean;
  borderGradient?: boolean;
  pulse?: boolean;
  animate?: boolean;
  float?: boolean;
  delay?: number;
  iconVariant?: IconVariant;
  actions?: ReactNode;
}

function Card({
  children,
  title,
  subtitle,
  icon: Icon,
  className = '',
  headerClass = '',
  variant = 'default',
  gradient = false,
  hover = false,
  glow = false,
  glass = false,
  borderGradient = false,
  pulse = false,
  animate = false,
  float = false,
  delay = 0,
  iconVariant = 'circle',
  actions,
}: CardProps) {
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const variants: Record<CardVariant, string> = {
    default: 'bg-white border-gray-200/60',
    dark: 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50',
    elevated: 'bg-white border-gray-200/60 shadow-lg',
    glass: 'bg-white/85 backdrop-blur-xl border-gray-100/60',
    primary: 'bg-gradient-to-br from-primary-500/10 to-blue-500/5 border-primary-200/60',
    success: 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-200/60',
    warning: 'bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-200/60',
    danger: 'bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-200/60',
    accent: 'bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-200/60',
  };

  const titleColors: Record<CardVariant, string> = {
    default: 'text-gray-900',
    dark: 'text-white',
    elevated: 'text-gray-900',
    glass: 'text-gray-900',
    primary: 'text-primary-700',
    success: 'text-green-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
    accent: 'text-purple-700',
  };

  const iconColors: Record<CardVariant, string> = {
    default: 'text-gray-600',
    dark: 'text-slate-300',
    elevated: 'text-gray-600',
    glass: 'text-gray-600',
    primary: 'text-primary-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    accent: 'text-purple-600',
  };

  const iconBgColors: Record<CardVariant, string> = {
    default: 'bg-gradient-to-br from-gray-100 to-gray-200',
    dark: 'bg-slate-700/50',
    elevated: 'bg-gradient-to-br from-gray-100 to-gray-200',
    glass: 'bg-gray-100/80',
    primary: 'bg-gradient-to-br from-primary-100 to-blue-100',
    success: 'bg-gradient-to-br from-green-100 to-emerald-100',
    warning: 'bg-gradient-to-br from-amber-100 to-yellow-100',
    danger: 'bg-gradient-to-br from-red-100 to-rose-100',
    accent: 'bg-gradient-to-br from-purple-100 to-violet-100',
  };

  const iconVariants: Record<IconVariant, string> = {
    circle: 'rounded-full',
    square: 'rounded-lg',
    hexagon: 'rounded-[20%]',
  };

  const handleMouseEnter: MouseEventHandler<HTMLDivElement> = () => setIsHovered(true);
  const handleMouseLeave: MouseEventHandler<HTMLDivElement> = () => setIsHovered(false);

  return (
    <div
      className={`
      relative rounded-2xl overflow-hidden transition-all duration-400 border
      ${variants[variant]}
      ${gradient && variant === 'dark' ? 'bg-gradient-to-br from-slate-800/90 via-blue-900/20 to-slate-900/90' : ''}
      ${hover ? 'hover:shadow-xl hover:-translate-y-1' : ''}
      ${float ? 'card-hover-float' : ''}
      ${glow ? 'card-glow' : ''}
      ${glass ? 'card-glass-enhanced' : ''}
      ${borderGradient ? 'card-gradient-border' : ''}
      ${pulse ? 'pulse-glow-card' : ''}
      ${animate ? 'animate-fade-in' : ''}
      ${className}
    `}
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {title && (
        <div
          className={`px-5 py-3 border-b ${variant === 'dark' ? 'border-slate-700/50 bg-slate-700/20' : 'border-gray-200/60 bg-gradient-to-r from-gray-50 via-white to-gray-50'} ${headerClass}`}
        >
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              {Icon && (
                <div
                  className={`relative w-10 h-10 ${iconVariants[iconVariant]} flex items-center justify-center transition-all duration-300 ${isHovered ? 'scale-110 rotate-3' : ''} ${iconBgColors[variant]}`}
                >
                  <Icon className={`w-5 h-5 ${iconColors[variant]} transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`} />
                  {isHovered && (
                    <div className={`absolute inset-0 ${iconVariants[iconVariant]} opacity-30 blur-md ${iconBgColors[variant]}`} />
                  )}
                </div>
              )}
              <div>
                <h3 className={`font-semibold text-base ${titleColors[variant]}`}>{title}</h3>
                {subtitle && <p className='text-xs text-gray-500 mt-0.5'>{subtitle}</p>}
              </div>
            </div>
            {actions && <div className='flex items-center gap-1'>{actions}</div>}
          </div>
        </div>
      )}
      <div className={`p-5 ${variant === 'dark' ? 'text-slate-300' : ''} ${animate ? 'card-content-hover' : ''}`}>
        {children}
      </div>

      {glow && (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
          <div className='absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent' />
          <div className='absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-500/50 to-transparent' />
        </>
      )}
    </div>
  );
}

export default memo(Card);