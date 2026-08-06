import React, { useState, useEffect, memo } from 'react';
import { Search } from 'lucide-react';
import { useDebouncedValue } from '../../hooks';

interface SearchInputProps {
  onChange: (value: string) => void;
  placeholder?: string;
  value?: string;
  className?: string;
  debounceDelay?: number;
}

const SearchInput: React.FC<SearchInputProps> = memo(({
  onChange,
  placeholder = '搜索...',
  value: externalValue,
  className = '',
  debounceDelay = 300,
}) => {
  const [internalValue, setInternalValue] = useState(externalValue || '');
  const debouncedValue = useDebouncedValue(internalValue, debounceDelay);

  useEffect(() => {
    if (externalValue !== undefined && externalValue !== internalValue) {
      setInternalValue(externalValue);
    }
  }, [externalValue, internalValue]);

  useEffect(() => {
    if (debouncedValue !== externalValue) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, externalValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={internalValue}
        onChange={handleChange}
        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full"
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;