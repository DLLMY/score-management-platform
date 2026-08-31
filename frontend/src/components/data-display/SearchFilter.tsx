import {
  useState,
  useEffect,
  useRef,
  ChangeEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
  memo,
} from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface SelectFilterOption {
  label: string;
  value: string;
}

export interface SearchFilterProps {
  searchTerm?: string;
  value?: string;
  onSearchChange?: (value: string) => void;
  onChange?: (value: string) => void;
  onSearch?: () => void;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  loading?: boolean;
  autoSearch?: boolean;
  showReset?: boolean;
  onReset?: () => void;
  selectFilters?: {
    label: string;
    options: SelectFilterOption[];
    value: string;
    onChange: (value: string) => void;
  }[];
  children?: ReactNode;
  maxWidth?: string;
}

function SearchFilter({
  searchTerm,
  value,
  onSearchChange,
  onChange,
  onSearch,
  filters = [],
  activeFilter,
  onFilterChange,
  placeholder = '搜索...',
  className = '',
  debounceMs = 300,
  loading = false,
  autoSearch = true,
  showReset = false,
  onReset,
  selectFilters = [],
  children,
  maxWidth = 'max-w-md',
}: SearchFilterProps) {
  const resolvedValue = value ?? searchTerm;
  const resolvedOnChange = onChange ?? onSearchChange;

  const [localSearchTerm, setLocalSearchTerm] = useState<string>(resolvedValue || '');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchTimeRef = useRef<number>(0);

  useEffect(() => {
    setLocalSearchTerm(resolvedValue || '');
  }, [resolvedValue]);

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const newValue = e.target.value;
    setLocalSearchTerm(newValue);

    if (!autoSearch) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const now = Date.now();
    const timeSinceLastSearch = now - lastSearchTimeRef.current;
    const delay = timeSinceLastSearch < 2000 ? debounceMs : Math.max(debounceMs, 500);

    debounceTimerRef.current = setTimeout(() => {
      lastSearchTimeRef.current = Date.now();
      if (resolvedOnChange) {
        resolvedOnChange(newValue);
      }
    }, delay);
  };

  const handleClear: MouseEventHandler<HTMLButtonElement> = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLocalSearchTerm('');
    if (resolvedOnChange) {
      resolvedOnChange('');
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (resolvedOnChange) {
        resolvedOnChange(localSearchTerm);
      }
      if (onSearch) {
        onSearch();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleFilterClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    const value = e.currentTarget.dataset.filterValue;
    if (value && onFilterChange) {
      onFilterChange(value);
    }
  };

  const handleReset = () => {
    setLocalSearchTerm('');
    if (resolvedOnChange) {
      resolvedOnChange('');
    }
    if (onFilterChange && activeFilter !== undefined) {
      onFilterChange(activeFilter);
    }
    selectFilters.forEach((sf) => sf.onChange(sf.value));
    onReset?.();
  };

  const hasActiveFilters =
    localSearchTerm || selectFilters.some((sf) => sf.value !== sf.options[0]?.value);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className={`relative flex-1 min-w-[200px] ${maxWidth}`}>
        <Search className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400' />
        <input
          type='text'
          value={localSearchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          data-search-input
          disabled={loading}
          className='w-full pl-12 pr-10 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all'
        />
        {localSearchTerm && (
          <button
            onClick={handleClear}
            className='absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full transition-colors'
          >
            <X className='w-4 h-4 text-slate-400' />
          </button>
        )}
      </div>

      {filters.length > 0 && (
        <div className='flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1'>
          {filters.map((filter) => (
            <button
              key={filter.value}
              data-filter-value={filter.value}
              onClick={handleFilterClick}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeFilter === filter.value
                  ? 'bg-white dark:bg-slate-600 text-violet-600 dark:text-violet-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {selectFilters.map((sf, idx) => (
        <div key={idx} className='flex items-center gap-2'>
          {sf.label && (
            <span className='text-sm text-slate-500 dark:text-slate-400'>{sf.label}:</span>
          )}
          <select
            value={sf.value}
            onChange={(e) => sf.onChange(e.target.value)}
            className='px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all'
          >
            {sf.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {children}

      {showReset && hasActiveFilters && (
        <button
          onClick={handleReset}
          className='flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all'
        >
          <RotateCcw className='w-4 h-4' />
          重置
        </button>
      )}
    </div>
  );
}

export default memo(SearchFilter);
