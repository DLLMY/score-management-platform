import { useRef, useEffect } from 'react';
import { useMemo } from 'react';

/**
 * useShallowCompare - 浅比较 Hook
 * 用于优化依赖数组的比较，避免不必要的重渲染
 */

/**
 * 浅比较两个对象是否相等
 */
export function shallowEqual(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
  if (obj1 === obj2) return true;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
}

/**
 * 深度比较两个对象
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return obj1 === obj2;
  }
  
  const keys1 = Object.keys(obj1 as Record<string, unknown>);
  const keys2 = Object.keys(obj2 as Record<string, unknown>);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])) {
      return false;
    }
  }
  
  return true;
}

/**
 * useShallowCompare - 在 useEffect/useMemo 中使用浅比较的 Hook
 * 
 * @param value - 要比较的值
 * @returns 是否与上次不同
 * 
 * @example
 * ```tsx
 * const isChanged = useShallowCompare(dependencyObject);
 * 
 * useEffect(() => {
 *   if (isChanged) {
 *     // 做些什么
 *   }
 * }, [isChanged]);
 * ```
 */
export function useShallowCompare<T extends Record<string, unknown>>(value: T): boolean {
  const prevRef = useRef<T | null>(null);
  const isDifferent = useRef(true);
  
  useEffect(() => {
    const prev = prevRef.current;
    
    if (prev === null) {
      isDifferent.current = true;
    } else {
      isDifferent.current = !shallowEqual(prev, value);
    }
    
    prevRef.current = value;
  }, [value]);
  
  return isDifferent.current;
}

/**
 * useDeepCompare - 在 useEffect/useMemo 中使用深度比较的 Hook
 */
export function useDeepCompare<T>(value: T): boolean {
  const prevRef = useRef<T | null>(null);
  const isDifferent = useRef(true);
  
  useEffect(() => {
    const prev = prevRef.current;
    
    if (prev === null) {
      isDifferent.current = true;
    } else {
      isDifferent.current = !deepEqual(prev, value);
    }
    
    prevRef.current = value;
  }, [value]);
  
  return isDifferent.current;
}

/**
 * useDeepCompareMemo - 使用深度比较的 useMemo
 * 
 * @param factory - 计算函数
 * @param deps - 依赖数组
 * @returns 计算结果
 */
export function useDeepCompareMemo<T>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [useDeepCompare(deps as unknown as Record<string, unknown>)]);
}

/**
 * useShallowCompareMemo - 使用浅比较的 useMemo
 * 
 * @param factory - 计算函数
 * @param deps - 依赖数组
 * @returns 计算结果
 */
export function useShallowCompareMemo<T>(factory: () => T, deps: Record<string, unknown>[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [useShallowCompare(deps[0] || {})]);
}

/**
 * createUseCompareHook - 创建自定义比较 Hook 的工厂函数
 */
export function createUseCompareHook<T>(
  compareFn: (prev: T, next: T) => boolean
) {
  return function useCompare(value: T): boolean {
    const prevRef = useRef<T | null>(null);
    const isDifferent = useRef(true);
    
    useEffect(() => {
      const prev = prevRef.current;
      
      if (prev === null) {
        isDifferent.current = true;
      } else {
        isDifferent.current = !compareFn(prev, value);
      }
      
      prevRef.current = value;
    }, [value]);
    
    return isDifferent.current;
  };
}

/**
 * usePrevious - 获取上一个值
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * useChangeDetector - 检测值是否发生变化
 */
export function useChangeDetector<T>(
  value: T,
  compare: (prev: T, current: T) => boolean = (a, b) => a !== b
): { current: T; previous: T | undefined; hasChanged: boolean } {
  const previousRef = useRef<T>();
  const hasChangedRef = useRef(false);
  
  useEffect(() => {
    if (previousRef.current !== undefined) {
      hasChangedRef.current = compare(previousRef.current, value);
    }
    previousRef.current = value;
  }, [value, compare]);
  
  return {
    current: value,
    previous: previousRef.current,
    hasChanged: hasChangedRef.current
  };
}

const ShallowCompareHooks = {
  shallowEqual,
  deepEqual,
  useShallowCompare,
  useDeepCompare,
  useDeepCompareMemo,
  useShallowCompareMemo,
  createUseCompareHook,
  usePrevious,
  useChangeDetector
};

export default ShallowCompareHooks;
