import { Search, Filter, X } from 'lucide-react';

function SearchFilter({
  searchTerm,
  onSearchChange,
  filters = [],
  activeFilter,
  onFilterChange,
  placeholder = '搜索...',
  className = '',
  debounceMs = 300,
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className='relative flex-1 min-w-[200px] max-w-md'>
        <Search className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
        <input
          type='text'
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          data-search-input
          className='w-full pl-12 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all'
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className='absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors'
          >
            <X className='w-4 h-4 text-gray-400' />
          </button>
        )}
      </div>

      {filters.length > 0 && (
        <div className='flex items-center gap-2'>
          <Filter className='w-4 h-4 text-gray-500' />
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onFilterChange(filter.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === filter.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchFilter;
