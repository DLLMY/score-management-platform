import { MouseEventHandler } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function Switch({ checked, onChange, label, disabled = false, size = 'md' }: SwitchProps) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const sizeClasses = {
    sm: { track: 'w-10 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-5' },
    md: { track: 'w-12 h-6', thumb: 'w-4 h-4', translate: 'translate-x-7' },
    lg: { track: 'w-14 h-7', thumb: 'w-5 h-5', translate: 'translate-x-8' },
  };

  const { track, thumb, translate } = sizeClasses[size];

  return (
    <div className='flex items-center gap-3'>
      <button
        type='button'
        role='switch'
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={`
          relative ${track} rounded-full transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-slate-600'}
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
        `}
      >
        <span
          className={`
            absolute top-0.5 ${thumb} bg-white rounded-full transition-transform shadow
            ${checked ? translate : 'translate-x-1'}
          `}
        />
      </button>
      {label && (
        <span
          className={`text-sm ${checked ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default Switch;
