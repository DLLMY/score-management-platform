import { useOptimizedFetch } from './useOptimizedFetch';

/**
 * 分页列表页通用数据获取 hook。
 * 建立在 useOptimizedFetch（loading/error/refetch/abort/debounce）之上，
 * 额外封装「分页参数 + total 元信息 + 列表信封解包」，消除各列表页重复的
 * useState(data/loading) + useEffect(fetch) + setPagination 样板。
 *
 * 职责分工：
 * - useOptimizedFetch：通用请求骨架（loading/error/refetch/abort/debounce）
 * - useTableUrlState：分页/排序状态持久化到 URL query（如有需要由调用方组合）
 * - useListFetch：本文件，专注「分页列表 + total」语义
 *
 * 依赖方向（单向）：pages → useListFetch → useOptimizedFetch
 */
export interface ListFetchParams {
  page: number;
  pageSize: number;
  [key: string]: string | number | boolean | undefined;
}

export interface UseListFetchResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseListFetchOptions<T> {
  /** 接收当前分页/过滤参数，返回 { items, total }（由调用方负责信封解包） */
  fetcher: (params: ListFetchParams) => Promise<{ items: T[]; total: number }>;
  /** 外部分页/过滤/排序参数，变化即触发重新拉取 */
  params: ListFetchParams;
  initialData?: T[];
  debounceDelay?: number;
}

export function useListFetch<T = unknown>({
  fetcher,
  params,
  initialData = [],
  debounceDelay = 300,
}: UseListFetchOptions<T>): UseListFetchResult<T> {
  const dependencies = [
    params.page,
    params.pageSize,
    ...Object.values(params).filter(
      (v): v is string | number | boolean =>
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    ),
  ];

  const { data, loading, error, refetch } = useOptimizedFetch<{ items: T[]; total: number }>(
    () => fetcher(params),
    dependencies,
    {
      debounceDelay,
      initialData: initialData.length ? { items: initialData, total: 0 } : undefined,
    }
  );

  return {
    items: data?.items ?? initialData,
    total: data?.total ?? 0,
    loading,
    error,
    refetch,
  };
}

export default useListFetch;
