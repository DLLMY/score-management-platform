import { useOptimizedFetch } from './useOptimizedFetch';

/**
 * 非分页全量列表请求骨架 hook（批次2 2026-08-23）。
 *
 * 收敛 40+ 页手写的 `useState(items/loading/error) + useCallback(fetch) +
 * useEffect` 全量拉取样板（CategoryList / RankRuleList / CommitteeList 等）。
 * 建立在 useOptimizedFetch（loading/error/refetch/abort/debounce）之上：
 * - data 恒为数组（默认 []），无需判空
 * - deps 变化自动重新拉取（如 filterClassId）
 * - onError 供错误展示自定义（string 渲染 / toast 提示均可）
 *
 * 依赖方向（单向）：pages → useListData → useOptimizedFetch
 */
export interface UseListDataResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseListDataOptions<T> {
  /** 返回数组的全量拉取函数（由调用方负责信封解包） */
  fetcher: () => Promise<T[]>;
  /** 变化即触发重新拉取的依赖（如 filterClassId / searchTerm） */
  deps?: unknown[];
  initialData?: T[];
  debounceDelay?: number;
  /** 拉取失败回调（如 toast 提示）；error 字段仍为 Error 对象 */
  onError?: (error: Error) => void;
}

export function useListData<T = unknown>({
  fetcher,
  deps = [],
  initialData = [],
  debounceDelay = 300,
  onError,
}: UseListDataOptions<T>): UseListDataResult<T> {
  const { data, loading, error, refetch } = useOptimizedFetch<T[]>(fetcher, deps, {
    debounceDelay,
    initialData,
    onError,
  });

  return {
    data: data ?? initialData,
    loading,
    error,
    refetch,
  };
}

export default useListData;
