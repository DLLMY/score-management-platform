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
