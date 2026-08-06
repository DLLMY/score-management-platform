import { useState, useCallback, useEffect } from 'react';
import { SearchCondition, SavedSearch } from '../components/data-display/AdvancedSearchFilter';

const STORAGE_KEY = 'advanced_search_saved';

export interface UseAdvancedSearchOptions {
  storageKey?: string;
  defaultConditions?: SearchCondition;
  onSearch?: (conditions: SearchCondition) => void;
}

export function useAdvancedSearch(options: UseAdvancedSearchOptions = {}) {
  const { storageKey = STORAGE_KEY, defaultConditions = {}, onSearch } = options;

  const [conditions, setConditions] = useState<SearchCondition>(defaultConditions);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 从localStorage加载保存的搜索
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setSavedSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('加载保存的搜索失败:', error);
    }
  }, [storageKey]);

  // 保存搜索到localStorage
  const saveSearches = useCallback((searches: SavedSearch[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(searches));
    } catch (error) {
      console.warn('保存搜索失败:', error);
    }
  }, [storageKey]);

  // 更新搜索条件
  const updateConditions = useCallback((updates: SearchCondition) => {
    setConditions(updates);
  }, []);

  // 执行搜索
  const search = useCallback(() => {
    setIsLoading(true);
    if (onSearch) {
      onSearch(conditions);
    }
    // 模拟加载状态
    setTimeout(() => setIsLoading(false), 300);
  }, [conditions, onSearch]);

  // 保存当前搜索条件
  const handleSaveSearch = useCallback((name: string, searchConditions: SearchCondition) => {
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      conditions: searchConditions,
      createdAt: new Date().toISOString(),
    };
    const updated = [newSearch, ...savedSearches];
    setSavedSearches(updated);
    saveSearches(updated);
  }, [savedSearches, saveSearches]);

  // 删除保存的搜索
  const handleDeleteSearch = useCallback((id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    saveSearches(updated);
  }, [savedSearches, saveSearches]);

  // 加载保存的搜索
  const handleLoadSearch = useCallback((search: SavedSearch) => {
    setConditions(search.conditions);
    if (onSearch) {
      onSearch(search.conditions);
    }
  }, [onSearch]);

  // 重置搜索条件
  const resetConditions = useCallback(() => {
    setConditions({});
    if (onSearch) {
      onSearch({});
    }
  }, [onSearch]);

  // 导出搜索条件为URL参数
  const conditionsToQueryString = useCallback((conds: SearchCondition): string => {
    const params = new URLSearchParams();
    Object.entries(conds).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    return params.toString();
  }, []);

  // 从URL参数恢复搜索条件
  const queryStringToConditions = useCallback((queryString: string): SearchCondition => {
    const params = new URLSearchParams(queryString);
    const conditions: SearchCondition = {};
    params.forEach((value, key) => {
      if (key === 'minScore' || key === 'maxScore') {
        conditions[key as keyof SearchCondition] = Number(value) as never;
      } else {
        (conditions as Record<string, string>)[key] = value;
      }
    });
    return conditions;
  }, []);

  return {
    conditions,
    setConditions: updateConditions,
    search,
    savedSearches,
    handleSaveSearch,
    handleDeleteSearch,
    handleLoadSearch,
    resetConditions,
    isLoading,
    conditionsToQueryString,
    queryStringToConditions,
  };
}

export default useAdvancedSearch;
