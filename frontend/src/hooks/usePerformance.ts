import logger from '../utils/logger';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 性能监控Hook
 * 用于监控组件渲染时间和性能指标
 */
export const usePerformance = (componentName: string) => {
  const startTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime.current;

      // 记录性能数据
      logger.log(`[Performance] ${componentName} unmounted after ${duration.toFixed(2)}ms`);
    };
  }, [componentName]);

  useEffect(() => {
    renderCount.current++;
    const renderTime = performance.now();

    logger.log(
      `[Performance] ${componentName} rendered (count: ${
        renderCount.current
      }) at ${renderTime.toFixed(2)}ms`
    );
  });

  return {
    renderCount: renderCount.current,
    getStartTime: () => startTime.current,
  };
};

/**
 * 监控函数执行时间
 * @param fn 要监控的函数
 * @param label 标签
 * @returns 包装后的函数
 */
export const monitorPerformance = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  label: string
): T => {
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();

    logger.log(`[Performance] ${label} executed in ${(end - start).toFixed(2)}ms`);

    return result;
  }) as T;
};

/**
 * 监控异步函数执行时间
 * @param fn 要监控的异步函数
 * @param label 标签
 * @returns 包装后的函数
 */
export const monitorAsyncPerformance = <
  T extends (...args: Parameters<T>) => Promise<ReturnType<T>>
>(
  fn: T,
  label: string
): T => {
  return (async (...args: Parameters<T>) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();

    logger.log(`[Performance] ${label} executed in ${(end - start).toFixed(2)}ms`);

    return result;
  }) as T;
};

/**
 * 防抖Hook
 * @param callback 回调函数
 * @param delay 延迟时间(ms)
 * @returns 防抖后的函数
 */
export const useDebounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
};

/**
 * 节流Hook
 * @param callback 回调函数
 * @param limit 节流时间(ms)
 * @returns 节流后的函数
 */
export const useThrottle = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  const inThrottle = useRef(false);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      if (!inThrottle.current) {
        callback(...args);
        inThrottle.current = true;

        setTimeout(() => {
          inThrottle.current = false;
        }, limit);
      }
    },
    [callback, limit]
  );

  return throttledFn;
};

/**
 * 缓存Hook
 * @param key 缓存键
 * @param fetcher 数据获取函数
 * @param options 选项
 * @returns 缓存数据
 */
export const useCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    staleWhileRevalidate?: number;
  } = {}
): { data: T | null; loading: boolean; error: Error | null } => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const { ttl = 300000, staleWhileRevalidate = 60000 } = options;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      cacheRef.current.set(key, { data: result, timestamp: Date.now() });
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [fetcher, key]);

  const revalidate = useCallback(async () => {
    try {
      const result = await fetcher();
      cacheRef.current.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch {
      // 忽略重新验证错误
    }
  }, [fetcher, key]);

  useEffect(() => {
    const cached = cacheRef.current.get(key);

    if (cached) {
      const now = Date.now();

      if (now - cached.timestamp < ttl) {
        // 缓存有效
        setData(cached.data);
        setLoading(false);
        return;
      } else if (now - cached.timestamp < ttl + staleWhileRevalidate) {
        // 缓存过期但可以使用过期数据
        setData(cached.data);
        setLoading(false);
        // 后台重新验证
        revalidate();
        return;
      }
    }

    // 获取新数据
    fetchData();
  }, [key, ttl, staleWhileRevalidate, fetchData, revalidate]);

  return { data, loading, error };
};

/**
 * 性能计时Hook
 * 用于测量代码块的执行时间
 */
export const useTimer = () => {
  const timers = useRef<Map<string, number>>(new Map());

  const start = useCallback((label: string) => {
    timers.current.set(label, performance.now());
  }, []);

  const stop = useCallback((label: string) => {
    const startTime = timers.current.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      timers.current.delete(label);
      logger.log(`[Timer] ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  }, []);

  const lap = useCallback((label: string) => {
    const startTime = timers.current.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      logger.log(`[Timer] ${label} lap: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  }, []);

  return { start, stop, lap };
};

/**
 * 内存使用Hook（DevTools 专用）
 * 仅监控浏览器内存使用情况；enabled=false（如生产/DevTools 关闭）时不注册定时器，零开销。
 * 说明：DevTools 组件在 config.devTools.enabled 门控之前即调用本 hook（hooks 规则），
 *       因此必须由调用方把 enabled 传进来，避免禁用时每秒 setState 空转（曾致
 *       "setInterval handler took 99ms" Violation）。
 */
export const useMemoryUsage = (enabled = true) => {
  const [memoryUsage, setMemoryUsage] = useState({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
  });

  interface PerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }

  useEffect(() => {
    if (!enabled) return;
    const updateMemoryUsage = () => {
      if (performance && 'memory' in performance) {
        const memory = performance.memory as PerformanceMemory;
        setMemoryUsage({
          usedJSHeapSize: memory.usedJSHeapSize || 0,
          totalJSHeapSize: memory.totalJSHeapSize || 0,
          jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
        });
      }
    };

    updateMemoryUsage();
    // 2s 一次：兼顾实时性，避免每秒 setState 触发面板重渲染造成长任务
    const interval = setInterval(updateMemoryUsage, 2000);

    return () => clearInterval(interval);
  }, [enabled]);

  return memoryUsage;
};
