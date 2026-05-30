import { memo } from 'react';

function Card({
  children,
  title,
  icon: Icon,
  className = '',
  headerClass = '',
  variant = 'default',
  gradient = false,
  hover = false,
}) {
  const variants = {
    default: 'bg-white border-gray-100',
    dark: 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50',
    elevated: 'bg-white border-gray-100 shadow-lg',
    glass: 'bg-white/80 backdrop-blur-xl border-gray-100/50',
  };

  const titleColors = {
    default: 'text-gray-900',
    dark: 'text-white',
    elevated: 'text-gray-900',
    glass: 'text-gray-900',
  };

  const iconColors = {
    default: 'text-gray-600',
    dark: 'text-slate-300',
    elevated: 'text-gray-600',
    glass: 'text-gray-600',
  };

  return (
    <div
      className={`
      rounded-xl overflow-hidden transition-all duration-300
      ${variants[variant]}
      ${gradient && variant === 'dark' ? 'bg-gradient-to-br from-slate-800/90 via-blue-900/20 to-slate-900/90' : ''}
      ${hover ? 'hover:shadow-xl hover:-translate-y-0.5' : ''}
      ${className}
    `}
    >
      {title && (
        <div
          className={`px-5 py-4 border-b ${variant === 'dark' ? 'border-slate-700/50 bg-slate-700/20' : 'border-gray-100 bg-gray-50/50'} ${headerClass}`}
        >
          {Icon && (
            <div className='flex items-center gap-2'>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  variant === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${iconColors[variant]}`} />
              </div>
              <h3 className={`font-semibold ${titleColors[variant]}`}>{title}</h3>
            </div>
          )}
          {!Icon && <h3 className={`font-semibold ${titleColors[variant]}`}>{title}</h3>}
        </div>
      )}
      <div className={`p-5 ${variant === 'dark' ? 'text-slate-300' : ''}`}>{children}</div>
    </div>
  );
}

export default memo(Card);
