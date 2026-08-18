import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDebouncedValue - 防抖值 Hook
 * 当值频繁变化时，延迟更新实际值
 */

/**
 * 防抖 Hook
 *
 * @param value - 要防抖的值
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的值
 *
 * @example
 * ```tsx
 * const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
 *
 * useEffect(() => {
 *   // 只有当用户停止输入 300ms 后才会执行
 *   fetchData(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 *
 * @param callback - 回调函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的回调
 *
 * @example
 * ```tsx
 * const debouncedSearch = useDebouncedCallback(
 *   (term: string) => fetchData(term),
 *   300
 * );
 *
 * // 快速连续调用只会执行最后一次
 * debouncedSearch('a');
 * debouncedSearch('ab');
 * debouncedSearch('abc'); // 只会执行这个
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debounced = useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debounced;
}

/**
 * 节流 Hook
 *
 * @param value - 要节流的值
 * @param interval - 间隔时间（毫秒）
 * @returns 节流后的值
 */
export function useThrottledValue<T>(value: T, interval: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();

    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
      return;
    }

    const timerId = setTimeout(() => {
      lastUpdated.current = Date.now();
      setThrottledValue(value);
    }, interval - (now - lastUpdated.current));

    return () => clearTimeout(timerId);
  }, [value, interval]);

  return throttledValue;
}

/**
 * 节流回调 Hook
 *
 * @param callback - 回调函数
 * @param interval - 间隔时间（毫秒）
 * @returns 节流后的回调
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number = 300
): T {
  const lastRun = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingArgs = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const throttled = useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      pendingArgs.current = args as Parameters<T>;

      if (now - lastRun.current >= interval) {
        lastRun.current = now;
        callbackRef.current(...args);
        pendingArgs.current = null;
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now();
          if (pendingArgs.current) {
            callbackRef.current(...pendingArgs.current);
            pendingArgs.current = null;
          }
          timeoutRef.current = null;
        }, interval - (now - lastRun.current));
      }
    },
    [interval]
  ) as T;

  return throttled;
}

/**
 * 延迟更新 Hook
 * 用于需要延迟更新但不需要防抖的场景
 */
export function useDelayedValue<T>(value: T, delay: number = 0): T {
  const [delayedValue, setDelayedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (delay <= 0) {
      setDelayedValue(value);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDelayedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return delayedValue;
}

/**
 * 累积更新 Hook
 * 收集一定时间内的更新，然后一次性应用
 */
export function useAccumulatedValue<T>(factory: () => T, interval: number = 100): T {
  const [value, setValue] = useState<T>(factory);
  const pendingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pendingRef.current) return;

    pendingRef.current = true;

    timeoutRef.current = setTimeout(() => {
      setValue(factory());
      pendingRef.current = false;
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [factory, interval]);

  return value;
}

const DebouncedValueHooks = {
  useDebouncedValue,
  useDebouncedCallback,
  useThrottledValue,
  useThrottledCallback,
  useDelayedValue,
  useAccumulatedValue,
};

export default DebouncedValueHooks;
