import { ChangeEventHandler, ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}

function Select({ 
  value, 
  onChange, 
  className = '', 
  children, 
  ...props 
}: SelectProps) {
  const handleChange: ChangeEventHandler<HTMLSelectElement> = (e) => {
    onChange?.(e.target.value);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export default Select;