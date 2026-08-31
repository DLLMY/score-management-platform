import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import Button from './Button';

export interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'number' | 'boolean';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export interface AdvancedSearchProps {
  fields: FilterField[];
  onSearch: () => void;
  onReset: () => void;
  searchButtonLabel?: string;
  children?: ReactNode;
}

function AdvancedSearch({
  fields,
  onSearch,
  onReset,
  searchButtonLabel = '搜索',
  children,
}: AdvancedSearchProps) {
  const renderField = (field: FilterField) => {
    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className='flex-1 min-w-[200px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>{field.label}</label>
            <input
              type='text'
              placeholder={field.placeholder}
              value={(field.value as string) || ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className='flex-1 min-w-[200px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>{field.label}</label>
            <select
              value={(field.value as string) || ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className='flex-1 min-w-[200px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>{field.label}</label>
            <input
              type='number'
              placeholder={field.placeholder}
              value={(field.value as number) || ''}
              onChange={(e) => field.onChange?.(parseFloat(e.target.value) || 0)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className='flex-1 min-w-[200px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>{field.label}</label>
            <input
              type='date'
              value={(field.value as string) || ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>
        );

      case 'dateRange':
        const range = (field.value as { start?: string; end?: string }) || {};
        return (
          <div key={field.id} className='flex-1 min-w-[250px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>{field.label}</label>
            <div className='flex gap-2'>
              <input
                type='date'
                placeholder='开始日期'
                value={range.start || ''}
                onChange={(e) => field.onChange?.({ ...range, start: e.target.value })}
                className='flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
              <input
                type='date'
                placeholder='结束日期'
                value={range.end || ''}
                onChange={(e) => field.onChange?.({ ...range, end: e.target.value })}
                className='flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div key={field.id} className='flex-1 min-w-[200px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>{field.label}</label>
            <select
              value={String(field.value ?? '')}
              onChange={(e) => field.onChange?.(e.target.value === 'true')}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部</option>
              <option value='true'>是</option>
              <option value='false'>否</option>
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  const hasActiveFilters = fields.some((f) => f.value !== undefined && f.value !== '');

  return (
    <div className='flex flex-wrap gap-4 mb-4'>
      {fields.map(renderField)}

      {children && <div className='mb-4 pt-4 border-t border-gray-200'>{children}</div>}

      <div className='flex items-center justify-between pt-4 border-t border-gray-200 w-full'>
        <div className='flex items-center gap-2'>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className='text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1'
            >
              <X className='w-3 h-3' />
              清除筛选
            </button>
          )}
        </div>
        <div className='flex gap-2'>
          <Button variant='secondary' onClick={onReset}>
            重置
          </Button>
          <Button onClick={onSearch} className='gap-2'>
            <Search className='w-4 h-4' />
            {searchButtonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AdvancedSearch;
