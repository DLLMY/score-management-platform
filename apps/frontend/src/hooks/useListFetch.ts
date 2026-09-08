import { useEffect, useState, useRef, useCallback } from 'react';
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
  /**
   * 瞬时控制：由 `refetch({ skipCache: true })` / `refetch({ params })` 注入，
   * 不作为依赖项（变更不会触发自驱重拉）。fetcher 据此透传给 API 请求选项。
   */
  skipCache?: boolean;
  [key: string]: string | number | boolean | undefined;
}

/** refetch 选项：一次性覆盖（不影响外部受控 params 状态） */
export interface RefetchOptions {
  /** 强制绕开前端响应缓存（透传给 API 请求的 skipCache 选项） */
  skipCache?: boolean;
  /** 仅作用于本次重拉的临时参数覆盖（如 mutation 后跳回第 1 页） */
  params?: Partial<ListFetchParams>;
}

export interface UseListFetchResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: Error | null;
  /** 手动重拉；可传 { skipCache: true } 或 { params } 做单次覆盖 */
  refetch: (opts?: RefetchOptions) => Promise<void>;
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
  /**
   * 自驱拉取开关（默认 true）。false 时挂载/deps 变化都不自动请求，
   * 手动 refetch() 仍可触发——用于「模态打开 / 切 tab」等按需加载列表。
   */
  enabled?: boolean;
}

export function useListFetch<T = unknown>({
  fetcher,
  params,
  initialData = [],
  debounceDelay = 300,
  enabled = true,
}: UseListFetchOptions<T>): UseListFetchResult<T> {
  const dependencies = [
    params.page,
    params.pageSize,
    // skipCache 是瞬时控制（由 refetch 注入），不纳入依赖——其变更不应触发自驱重拉
    ...Object.entries(params)
      .filter(
        ([key, v]) =>
          key !== 'skipCache' &&
          (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      )
      .map(([, v]) => v),
  ];

  // 单次参数覆盖（refetch({ params }) 使用）：仅作用于当次请求，不改动外部受控 params。
  const paramsOverrideRef = useRef<ListFetchParams | null>(null);

  const fetcherForHook = useCallback(
    (ctx: { skipCache: boolean }) =>
      fetcher({ ...(paramsOverrideRef.current ?? params), skipCache: ctx.skipCache }),
    [fetcher, params]
  );

  const { data, loading, error, refetch: baseRefetch } = useOptimizedFetch<{
    items: T[];
    total: number;
  }>(fetcherForHook, dependencies, {
    debounceDelay,
    enabled,
    initialData: initialData.length ? { items: initialData, total: 0 } : undefined,
  });

  // 手动重拉：支持 { skipCache } 绕缓存、{ params } 单次参数覆盖（如跳回第 1 页）。
  const refetch = useCallback(
    async (opts?: RefetchOptions) => {
      if (opts?.params) {
        paramsOverrideRef.current = { ...params, ...opts.params };
      }
      try {
        await baseRefetch({ skipCache: opts?.skipCache });
      } finally {
        paramsOverrideRef.current = null;
      }
    },
    [baseRefetch, params]
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
