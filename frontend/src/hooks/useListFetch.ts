import { useEffect, useState } from 'react';
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
  /** 乐观更新：本地覆写列表（下轮服务端取数到达后自动让位） */
  setItems: (items: T[]) => void;
  /** 乐观更新：本地覆写 total（分页栏即时调整） */
  setTotal: (total: number) => void;
  /** 乐观更新：一次调用批量覆写 items/total（避免两次渲染） */
  mutate: (patch: { items?: T[]; total?: number }) => void;
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

  // 乐观更新本地覆写层：新的服务端数据到达时自动让位（effect 在 data 变化后清除）。
  const [override, setOverride] = useState<{ items?: T[]; total?: number } | null>(null);
  useEffect(() => {
    setOverride(null);
  }, [data]);

  const setItems = (items: T[]) => setOverride((prev) => ({ ...(prev ?? {}), items }));
  const setTotal = (total: number) => setOverride((prev) => ({ ...(prev ?? {}), total }));
  const mutate = (patch: { items?: T[]; total?: number }) =>
    setOverride((prev) => ({ ...(prev ?? {}), ...patch }));

  return {
    items: override?.items ?? data?.items ?? initialData,
    total: override?.total ?? data?.total ?? 0,
    loading,
    error,
    refetch,
    setItems,
    setTotal,
    mutate,
  };
}

export default useListFetch;
