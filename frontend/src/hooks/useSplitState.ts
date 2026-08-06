import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * 状态分割配置
 * 用于定义哪些状态应该分离到不同的更新通道
 */
interface SplitStateConfig<T> {
  /** 频繁变化的状态键列表（如 loading, fetching, error） */
  volatileKeys?: (keyof T)[];
  /** 稳定状态键列表（如列表数据、配置等） */
  stableKeys?: (keyof T)[];
  /** 自定义比较函数 */
  customCompare?: (prev: T, next: T, key: keyof T) => boolean;
}

/**
 * 分割状态接口
 */
interface SplitStateResult<T> {
  /** 完整状态（包含所有状态） */
  state: T;
  /** 频繁变化的状态 */
  volatile: Partial<T>;
  /** 稳定状态 */
  stable: Partial<T>;
  /** 更新方法 */
  setState: (update: Partial<T> | ((prev: T) => Partial<T>)) => void;
  /** 批量更新方法 - 延迟更新稳定状态 */
  batchUpdate: (volatileUpdate: Partial<T>, stableUpdate: Partial<T>, delay?: number) => void;
  /** 仅更新频繁变化状态 */
  setVolatile: (update: Partial<T>) => void;
  /** 仅更新稳定状态 */
  setStable: (update: Partial<T>) => void;
  /** 重置所有状态 */
  reset: () => void;
}

/**
 * useSplitState - 将状态分为频繁更新和稳定状态，减少不必要的重渲染
 * 
 * @param initialState - 初始状态
 * @param config - 分割配置
 * @returns 分割后的状态和方法
 * 
 * @example
 * ```tsx
 * const { state, volatile, stable, setState, setVolatile, setStable } = useSplitState({
 *   users: [],
 *   loading: false,
 *   error: null,
 *   pagination: { page: 1, total: 0 }
 * }, {
 *   volatileKeys: ['loading', 'error'],
 *   stableKeys: ['users', 'pagination']
 * });
 * ```
 */
export function useSplitState<T extends Record<string, unknown>>(
  initialState: T,
  config: SplitStateConfig<T> = {}
): SplitStateResult<T> {
  const { volatileKeys = [], stableKeys = [] } = config;
  
  const [state, setStateInternal] = useState<T>(initialState);
  const updateQueueRef = useRef<{ volatile: Partial<T>; stable: Partial<T> } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 分离 volatile 和 stable 状态
  const volatile = useMemo(() => {
    const result: Partial<T> = {};
    volatileKeys.forEach(key => {
      if (key in state) {
        result[key] = state[key];
      }
    });
    return result;
  }, [state, volatileKeys]);
  
  const stable = useMemo(() => {
    const result: Partial<T> = {};
    stableKeys.forEach(key => {
      if (key in state) {
        result[key] = state[key];
      }
    });
    return result;
  }, [state, stableKeys]);
  
  // 主更新方法
  const setState = useCallback((update: Partial<T> | ((prev: T) => Partial<T>)) => {
    setStateInternal(prev => {
      const updates = typeof update === 'function' ? update(prev) : update;
      return { ...prev, ...updates };
    });
  }, []);
  
  // 批量更新 - 延迟更新稳定状态
  const batchUpdate = useCallback((
    volatileUpdate: Partial<T>,
    stableUpdate: Partial<T>,
    delay: number = 100
  ) => {
    // 立即更新 volatile 状态
    setStateInternal(prev => ({ ...prev, ...volatileUpdate }));
    
    // 清除之前的延迟更新
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 延迟更新稳定状态
    updateQueueRef.current = { volatile: volatileUpdate, stable: stableUpdate };
    timeoutRef.current = setTimeout(() => {
      setStateInternal(prev => {
        const currentQueue = updateQueueRef.current;
        if (currentQueue) {
          updateQueueRef.current = null;
          return { ...prev, ...currentQueue.stable };
        }
        return prev;
      });
    }, delay);
  }, []);
  
  // 仅更新 volatile 状态
  const setVolatile = useCallback((update: Partial<T>) => {
    const filteredUpdate: Partial<T> = {};
    volatileKeys.forEach(key => {
      if (key in update) {
        filteredUpdate[key] = update[key];
      }
    });
    if (Object.keys(filteredUpdate).length > 0) {
      setStateInternal(prev => ({ ...prev, ...filteredUpdate }));
    }
  }, [volatileKeys]);
  
  // 仅更新稳定状态
  const setStable = useCallback((update: Partial<T>) => {
    const filteredUpdate: Partial<T> = {};
    stableKeys.forEach(key => {
      if (key in update) {
        filteredUpdate[key] = update[key];
      }
    });
    if (Object.keys(filteredUpdate).length > 0) {
      setStateInternal(prev => ({ ...prev, ...filteredUpdate }));
    }
  }, [stableKeys]);
  
  // 重置状态
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    updateQueueRef.current = null;
    setStateInternal(initialState);
  }, [initialState]);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    state,
    volatile,
    stable,
    setState,
    batchUpdate,
    setVolatile,
    setStable,
    reset
  };
}

/**
 * 简化版的分割状态 Hook
 * 自动根据状态类型判断是 volatile 还是 stable
 */
export function useSmartSplitState<T extends Record<string, unknown>>(
  initialState: T
) {
  return useSplitState(initialState, {
    volatileKeys: Object.keys(initialState).filter(key => {
      const value = initialState[key];
      // 认为以下类型是频繁变化的
      return typeof value === 'boolean' || 
             (typeof value === 'string' && (value === '' || value.length < 50));
    }) as (keyof T)[]
  });
}

export default useSplitState;
