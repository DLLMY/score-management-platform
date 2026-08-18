import { ChangeEventHandler, FocusEventHandler, TextareaHTMLAttributes, useState } from 'react';

interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: boolean;
  errorMessage?: string;
  rows?: number;
  className?: string;
}

function Textarea({
  value,
  onChange,
  label,
  error = false,
  errorMessage,
  rows = 4,
  className = '',
  onFocus,
  onBlur,
  ...props
}: TextareaProps) {
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    onChange?.(e.target.value);
  };

  const handleFocus: FocusEventHandler<HTMLTextAreaElement> = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur: FocusEventHandler<HTMLTextAreaElement> = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={props.id}
          className={`block text-sm font-medium mb-2 ${
            error ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {label}
          {props.required && <span className='text-red-500 ml-1'>*</span>}
        </label>
      )}
      <textarea
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        rows={rows}
        aria-invalid={error}
        aria-describedby={error ? `${props.id}-error` : undefined}
        className={`
          w-full px-4 py-3 text-sm transition-all duration-200
          bg-slate-50 dark:bg-slate-700 border-2 rounded-xl
          placeholder:text-slate-400 dark:placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800
          ${
            isFocused
              ? error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-500/30'
                : 'border-primary-400 focus:border-primary-500 focus:ring-primary-200 dark:focus:ring-primary-500/30'
              : error
              ? 'border-red-300 dark:border-red-500'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
          }
        `}
        {...props}
      />
      {error && errorMessage && (
        <p id={`${props.id}-error`} className='mt-2 text-sm text-red-500 flex items-center gap-1'>
          <span className='text-xs'>!</span>
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default Textarea;
