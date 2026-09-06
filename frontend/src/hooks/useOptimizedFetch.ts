import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/** 每次请求注入的上下文：skipCache 表示是否绕开前端响应缓存（透传给 API 请求选项） */
export interface FetchContext {
  skipCache: boolean;
}

interface UseOptimizedFetchOptions {
  debounceDelay?: number;
  initialData?: unknown;
  onError?: (error: Error) => void;
  onSuccess?: (data: unknown) => void;
  /**
   * 自驱拉取开关（默认 true）。
   * false 时：deps 变化/挂载都不再自动发请求，且会中止在途请求（避免过期响应写回）；
   * 手动 refetch() 仍可强制触发（不受此开关限制）——用于「模态/切 tab 按需加载」场景。
   */
  enabled?: boolean;
}

interface UseOptimizedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** 手动重拉；可传 { skipCache: true } 强制绕开前端缓存（如 mutation 后取最新数据） */
  refetch: (opts?: { skipCache?: boolean }) => Promise<void>;
  reset: () => void;
}

export function useOptimizedFetch<T = unknown>(
  fetcher: (ctx: FetchContext) => Promise<T>,
  dependencies: unknown[],
  options: UseOptimizedFetchOptions = {}
): UseOptimizedFetchResult<T> {
  const {
    debounceDelay = 300,
    initialData = null,
    onError,
    onSuccess,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(initialData as T | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  // 仅作用于「单次请求」的缓存绕过标志：手动 refetch({skipCache:true}) 时置位，
  // 普通自驱拉取（deps 变化）恒为 false；每次 fetchData 入口处写入，fetch 内读取。
  const skipCacheRef = useRef(false);

  fetcherRef.current = fetcher;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  // 稳定化 dependencies 引用：数组每次 render 都是新引用（即使值相同），
  // 直接传给 useDebouncedValue 会导致其 effect 每次触发 → debounceDelay=0 时反复拉取。
  // 浅比较后仅在「实际值变化」时替换引用，值相同时复用上一引用（2026-08-23 hook 单测暴露）。
  const dependenciesRef = useRef(dependencies);
  const stableDependencies = useMemo(() => {
    const prev = dependenciesRef.current;
    if (prev === dependencies) return prev;
    if (prev.length !== dependencies.length) return dependencies;
    for (let i = 0; i < dependencies.length; i++) {
      if (!Object.is(dependencies[i], prev[i])) return dependencies;
    }
    return prev;
  }, [dependencies]);
  dependenciesRef.current = stableDependencies;

  const debouncedDependencies = useDebouncedValue(stableDependencies, debounceDelay);

  const fetchData = useCallback(async (opts?: { skipCache?: boolean }) => {
    // 写入本次请求的缓存绕过标志（默认 false：普通自驱拉取走缓存）
    skipCacheRef.current = opts?.skipCache ?? false;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current({ skipCache: skipCacheRef.current });
      // F2: 仅当本控制器仍是当前在途请求时才写回数据，丢弃过期响应，避免竞态覆盖。
      if (abortControllerRef.current === controller) {
        setData(result);
        onSuccessRef.current?.(result);
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        // F2: 仅当本控制器仍是当前在途请求时才处理错误，避免过期请求污染状态。
        if (abortControllerRef.current === controller) {
          const errorObj = err as Error;
          setError(errorObj);
          onErrorRef.current?.(errorObj);
          logger.error('Fetch failed:', errorObj);
        }
      }
    } finally {
      // F2: 仅当本控制器仍是当前在途请求时才清理并结束 loading；
      // 否则第二次并发请求已接管 ref，提前置 null 会丢失其 AbortController 并错误结束 loading。
      if (abortControllerRef.current === controller) {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // enabled=false：跳过自驱拉取；仅中止在途请求（不置空 ref，交给 fetchData 的
    // finally 正常收尾 loading，避免 loading 卡在 true）。手动 refetch 仍可触发。
    if (!enabled) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedDependencies, fetchData, enabled]);

  const reset = useCallback(() => {
    setData(initialData as T | null);
    setError(null);
  }, [initialData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    reset,
  };
}
