import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const {
    debounceDelay = 300,
    initialData = null,
    onError,
    onSuccess,
  } = options;

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

  const debouncedDependencies = useDebouncedValue(dependencies, debounceDelay);

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
      setData(result);
      onSuccessRef.current?.(result);
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        const errorObj = err as Error;
        setError(errorObj);
        onErrorRef.current?.(errorObj);
        logger.error('Fetch failed:', errorObj);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
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