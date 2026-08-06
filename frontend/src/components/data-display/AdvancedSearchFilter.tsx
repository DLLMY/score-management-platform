import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Search, Filter, X, Calendar, ChevronDown, Save, RotateCcw } from 'lucide-react';

export interface SearchCondition {
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  category?: string;
  className?: string;
  minScore?: number;
  maxScore?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SavedSearch {
  id: string;
  name: string;
  conditions: SearchCondition;
  createdAt: string;
}

interface AdvancedSearchFilterProps {
  conditions: SearchCondition;
  onChange: (conditions: SearchCondition) => void;
  onSearch: () => void;
  savedSearches?: SavedSearch[];
  onSaveSearch?: (name: string, conditions: SearchCondition) => void;
  onDeleteSearch?: (id: string) => void;
  dateFields?: { label: string; value: string }[];
  statusOptions?: { label: string; value: string; color?: string }[];
  categoryOptions?: { label: string; value: string }[];
  classOptions?: { label: string; value: string }[];
  showDateRange?: boolean;
  showStatus?: boolean;
  showCategory?: boolean;
  showClass?: boolean;
  showScoreRange?: boolean;
  showSort?: boolean;
  placeholder?: string;
  className?: string;
  loading?: boolean;
}

function AdvancedSearchFilter({
  conditions,
  onChange,
  onSearch,
  savedSearches = [],
  onSaveSearch,
  onDeleteSearch,
  dateFields = [],
  statusOptions = [],
  categoryOptions = [],
  classOptions = [],
  showDateRange = false,
  showStatus = false,
  showCategory = false,
  showClass = false,
  showScoreRange = false,
  showSort = false,
  placeholder = '搜索...',
  className = '',
  loading = false,
}: AdvancedSearchFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [localConditions, setLocalConditions] = useState<SearchCondition>(conditions);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalConditions(conditions);
  }, [conditions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSavedDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = useCallback((updates: Partial<SearchCondition>) => {
    const newConditions = { ...localConditions, ...updates };
    setLocalConditions(newConditions);
    onChange(newConditions);
  }, [localConditions, onChange]);

  const handleSearch = useCallback(() => {
    onChange(localConditions);
    onSearch();
    setIsExpanded(false);
  }, [localConditions, onChange, onSearch]);

  const handleReset = useCallback(() => {
    const resetConditions: SearchCondition = {};
    setLocalConditions(resetConditions);
    onChange(resetConditions);
    onSearch();
  }, [onChange, onSearch]);

  const handleSave = useCallback(() => {
    if (saveName.trim() && onSaveSearch) {
      onSaveSearch(saveName.trim(), localConditions);
      setSaveName('');
      setShowSaveModal(false);
    }
  }, [saveName, localConditions, onSaveSearch]);

  const handleLoadSearch = useCallback((search: SavedSearch) => {
    setLocalConditions(search.conditions);
    onChange(search.conditions);
    onSearch();
    setShowSavedDropdown(false);
  }, [onChange, onSearch]);

  const activeFiltersCount = [
    localConditions.dateFrom || localConditions.dateTo,
    localConditions.status,
    localConditions.category,
    localConditions.className,
    localConditions.minScore !== undefined || localConditions.maxScore !== undefined,
  ].filter(Boolean).length;

  const sortOptions = [
    { label: '默认排序', value: '' },
    { label: '按时间升序', value: 'created_at_asc' },
    { label: '按时间降序', value: 'created_at_desc' },
    { label: '按积分升序', value: 'score_asc' },
    { label: '按积分降序', value: 'score_desc' },
    { label: '按名称升序', value: 'name_asc' },
    { label: '按名称降序', value: 'name_desc' },
  ];

  const getSortCondition = (value: string): { sortBy?: string; sortOrder?: 'asc' | 'desc' } => {
    if (!value) return {};
    const [field, order] = value.split('_');
    return { sortBy: field, sortOrder: order as 'asc' | 'desc' };
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 主搜索栏 */}
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400' />
          <input
            type='text'
            value={localConditions.keyword || ''}
            onChange={(e) => handleChange({ keyword: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder={placeholder}
            className='w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all'
          />
          {localConditions.keyword && (
            <button
              onClick={() => handleChange({ keyword: '' })}
              className='absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors'
            >
              <X className='w-4 h-4 text-gray-400' />
            </button>
          )}
        </div>

        {/* 高级筛选按钮 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isExpanded || activeFiltersCount > 0
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Filter className='w-4 h-4' />
          <span>筛选</span>
          {activeFiltersCount > 0 && (
            <span className='flex items-center justify-center w-5 h-5 bg-primary-500 text-white text-xs rounded-full'>
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* 搜索按钮 */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className='px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>搜索中...</span>
            </>
          ) : (
            '搜索'
          )}
        </button>

        {/* 保存/加载搜索 */}
        <div className='relative' ref={dropdownRef}>
          <button
            onClick={() => setShowSavedDropdown(!showSavedDropdown)}
            className='flex items-center gap-2 px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all'
          >
            <Save className='w-4 h-4' />
          </button>

          {showSavedDropdown && (
            <div className='absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50'>
              <div className='p-3 border-b border-gray-100'>
                <button
                  onClick={() => {
                    setShowSaveModal(true);
                    setShowSavedDropdown(false);
                  }}
                  className='w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors'
                >
                  <Save className='w-4 h-4' />
                  保存当前筛选条件
                </button>
              </div>

              {savedSearches.length > 0 && (
                <div className='max-h-64 overflow-y-auto'>
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className='flex items-center justify-between p-3 hover:bg-gray-50 group'
                    >
                      <button
                        onClick={() => handleLoadSearch(search)}
                        className='flex-1 text-left'
                      >
                        <div className='text-sm font-medium text-gray-700'>{search.name}</div>
                        <div className='text-xs text-gray-400'>
                          {new Date(search.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                      {onDeleteSearch && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSearch(search.id);
                          }}
                          className='p-1.5 text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all'
                        >
                          <X className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {savedSearches.length === 0 && (
                <div className='p-4 text-center text-sm text-gray-400'>
                  暂无保存的搜索条件
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 高级筛选面板 */}
      {isExpanded && (
        <div className='p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {/* 日期范围 */}
            {showDateRange && (
              <>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>
                    {dateFields.find(f => f.value === 'date')?.label || '开始日期'}
                  </label>
                  <div className='relative'>
                    <Calendar className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
                    <input
                      type='date'
                      value={localConditions.dateFrom || ''}
                      onChange={(e) => handleChange({ dateFrom: e.target.value })}
                      className='w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                    />
                  </div>
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>
                    {dateFields.find(f => f.value === 'dateTo')?.label || '结束日期'}
                  </label>
                  <div className='relative'>
                    <Calendar className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
                    <input
                      type='date'
                      value={localConditions.dateTo || ''}
                      onChange={(e) => handleChange({ dateTo: e.target.value })}
                      className='w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                    />
                  </div>
                </div>
              </>
            )}

            {/* 状态筛选 */}
            {showStatus && statusOptions.length > 0 && (
              <div>
                <label className='block text-xs font-medium text-gray-500 mb-1'>状态</label>
                <select
                  value={localConditions.status || ''}
                  onChange={(e) => handleChange({ status: e.target.value })}
                  className='w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                >
                  <option value=''>全部状态</option>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 分类筛选 */}
            {showCategory && categoryOptions.length > 0 && (
              <div>
                <label className='block text-xs font-medium text-gray-500 mb-1'>分类</label>
                <select
                  value={localConditions.category || ''}
                  onChange={(e) => handleChange({ category: e.target.value })}
                  className='w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                >
                  <option value=''>全部分类</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 班级筛选 */}
            {showClass && classOptions.length > 0 && (
              <div>
                <label className='block text-xs font-medium text-gray-500 mb-1'>班级</label>
                <select
                  value={localConditions.className || ''}
                  onChange={(e) => handleChange({ className: e.target.value })}
                  className='w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                >
                  <option value=''>全部班级</option>
                  {classOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 积分范围 */}
            {showScoreRange && (
              <>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>最小积分</label>
                  <input
                    type='number'
                    value={localConditions.minScore ?? ''}
                    onChange={(e) => handleChange({ minScore: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder='0'
                    className='w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>最大积分</label>
                  <input
                    type='number'
                    value={localConditions.maxScore ?? ''}
                    onChange={(e) => handleChange({ maxScore: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder='1000'
                    className='w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                  />
                </div>
              </>
            )}

            {/* 排序 */}
            {showSort && (
              <div>
                <label className='block text-xs font-medium text-gray-500 mb-1'>排序方式</label>
                <select
                  value={`${localConditions.sortBy || ''}_${localConditions.sortOrder || ''}`}
                  onChange={(e) => handleChange(getSortCondition(e.target.value))}
                  className='w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex items-center justify-between mt-4 pt-4 border-t border-gray-200'>
            <button
              onClick={handleReset}
              className='flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors'
            >
              <RotateCcw className='w-4 h-4' />
              重置条件
            </button>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setIsExpanded(false)}
                className='px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors'
              >
                取消
              </button>
              <button
                onClick={handleSearch}
                className='px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors'
              >
                应用筛选
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存搜索模态框 */}
      {showSaveModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in'>
            <h3 className='text-lg font-semibold text-gray-800 mb-4'>保存搜索条件</h3>
            <input
              type='text'
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder='输入搜索名称'
              className='w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4'
              autoFocus
            />
            <div className='flex items-center justify-end gap-3'>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName('');
                }}
                className='px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors'
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className='px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AdvancedSearchFilter);
