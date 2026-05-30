import { memo, useState } from 'react';

function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  className = '',
  disabled = false,
  required = false,
  error,
  errorMessage,
  icon: Icon,
  iconPosition = 'left',
  autoComplete,
  name,
  id,
  ariaLabel,
  ariaRequired,
  maxLength,
  minLength,
  pattern,
  readOnly,
  onFocus,
  onBlur,
}) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium mb-2 ${error ? 'text-red-500' : 'text-slate-700'}`}
        >
          {label}
          {required && <span className='text-red-500 ml-1'>*</span>}
        </label>
      )}
      <div className='relative'>
        {Icon && iconPosition === 'left' && (
          <div
            className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${
              error ? 'text-red-500' : isFocused ? 'text-primary-500' : 'text-slate-400'
            }`}
          >
            <Icon className='w-5 h-5' />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          name={name}
          id={id}
          autoComplete={autoComplete}
          aria-label={ariaLabel}
          aria-required={ariaRequired ?? required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`
            w-full px-4 py-3 text-sm transition-all duration-200
            bg-slate-50 border-2 rounded-xl
            placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100
            read-only:bg-slate-100 read-only:cursor-default
            ${Icon ? (iconPosition === 'left' ? 'pl-12' : 'pr-12') : ''}
            ${
              isFocused
                ? error
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-primary-400 focus:border-primary-500 focus:ring-primary-200'
                : error
                  ? 'border-red-300'
                  : 'border-slate-200 hover:border-slate-300'
            }
          `}
        />
        {Icon && iconPosition === 'right' && (
          <div
            className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${
              error ? 'text-red-500' : isFocused ? 'text-primary-500' : 'text-slate-400'
            }`}
          >
            <Icon className='w-5 h-5' />
          </div>
        )}
      </div>
      {error && errorMessage && (
        <p id={`${id}-error`} className='mt-2 text-sm text-red-500 flex items-center gap-1'>
          <span className='text-xs'>!</span>
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default memo(Input);
