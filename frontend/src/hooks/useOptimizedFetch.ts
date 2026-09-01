import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

interface UseOptimizedFetchOptions {
  debounceDelay?: number;
  skipCache?: boolean;
  initialData?: unknown;
  onError?: (error: Error) => void;
  onSuccess?: (data: unknown) => void;
}

interface UseOptimizedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

export function useOptimizedFetch<T = unknown>(
  fetcher: () => Promise<T>,
  dependencies: unknown[],
  options: UseOptimizedFetchOptions = {}
): UseOptimizedFetchResult<T> {
  const { debounceDelay = 300, initialData = null, onError, onSuccess } = options;

  const [data, setData] = useState<T | null>(initialData as T | null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

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

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
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
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedDependencies, fetchData]);

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
