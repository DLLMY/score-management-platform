import React, { memo, useMemo } from 'react';

/**
 * MemoComponent - 带深度比较的 memo 包装器
 * 用于需要深度比较 props 的组件，避免不必要的重渲染
 */

// 自定义深度比较函数（避免引入 lodash）
function deepEqual(obj1: unknown, obj2: unknown): boolean {
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
 * 深度比较的 memo
 * 当 props 需要深度比较时使用
 */
export function deepMemo<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prev: P, next: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  return memo(Component, (prevProps, nextProps) => {
    // 如果提供了自定义比较函数，使用它
    if (propsAreEqual) {
      return propsAreEqual(prevProps as P, nextProps as P);
    }
    // 否则使用深度比较
    return deepEqual(prevProps, nextProps);
  });
}

/**
 * 浅比较的 memo
 */
export function shallowMemo<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prev: P, next: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  return memo(Component, (prevProps, nextProps) => {
    if (propsAreEqual) {
      return propsAreEqual(prevProps as P, nextProps as P);
    }
    
    // 浅比较实现
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);
    
    if (prevKeys.length !== nextKeys.length) return false;
    
    for (const key of prevKeys) {
      if (prevProps[key] !== nextProps[key]) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * 仅比较特定 props 的 memo
 */
export function selectiveMemo<P extends Record<string, unknown>, K extends keyof P>(
  Component: React.ComponentType<P>,
  keys: K[]
): React.MemoExoticComponent<React.ComponentType<P>> {
  return memo(Component, (prevProps, nextProps) => {
    for (const key of keys) {
      if (prevProps[key] !== nextProps[key]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * PropsFilter - 过滤 props 的高阶组件
 * 用于移除不需要传递给子组件的 props
 */
export function filterProps<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  filterKeys: (keyof P)[]
): React.FC<P> {
  const FilteredComponent: React.FC<P> = (props) => {
    const filtered = useMemo(() => {
      const result: Record<string, unknown> = { ...props };
      for (const key of filterKeys) {
        delete result[key as string];
      }
      return result;
    }, [props]);
    
    return <Component {...(filtered as P)} />;
  };
  
  FilteredComponent.displayName = `FilterProps(${Component.displayName || Component.name || 'Component'})`;
  return FilteredComponent;
}

/**
 * 渲染回调组件
 * 当依赖变化时才重新渲染
 */
interface RenderOnChangeProps<T> {
  value: T;
  children: (value: T) => React.ReactNode;
  equalityFn?: (prev: T, next: T) => boolean;
}

export function RenderOnChange<T>({ value, children, equalityFn }: RenderOnChangeProps<T>) {
  const prevValueRef = React.useRef<T>(value);
  const [renderValue, setRenderValue] = React.useState(value);
  
  React.useEffect(() => {
    const prev = prevValueRef.current;
    const isEqual = equalityFn ? equalityFn(prev, value) : prev === value;
    
    if (!isEqual) {
      prevValueRef.current = value;
      setRenderValue(value);
    }
  }, [value, equalityFn]);
  
  return <>{children(renderValue)}</>;
}

const MemoComponents = {
  deepMemo,
  shallowMemo,
  selectiveMemo,
  filterProps,
  RenderOnChange
};

export default MemoComponents;
