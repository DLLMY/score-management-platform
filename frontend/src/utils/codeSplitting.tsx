/**
 * 代码分割工具函数
 * 提供路由级别和组件级别的代码分割策略
 */

import React, { lazy, ComponentType, Suspense, ReactNode } from 'react';

/**
 * 创建路由级别的懒加载组件
 * @param importFn 动态导入函数
 * @param fallback 加载时的回退组件
 * @returns 懒加载组件
 */
export const createRouteComponent = <P extends {} = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ReactNode
): ComponentType<P> => {
  const LazyComponent = lazy(importFn) as React.ComponentType<any>;

  const WrappedComponent: React.FC<P> = (props) => (
    <Suspense fallback={fallback || defaultFallback}>
      <LazyComponent {...props as any} />
    </Suspense>
  );

  WrappedComponent.displayName = `Route(${importFn.name || 'Component'})`;
  return WrappedComponent;
};

/**
 * 创建组件级别的懒加载组件
 * 适用于大型组件的按需加载
 * @param importFn 动态导入函数
 * @returns 懒加载组件
 */
export const createLazyComponent = <P extends {} = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>
): ComponentType<P & { fallback?: ReactNode }> => {
  const LazyComponent = lazy(importFn) as React.ComponentType<any>;

  const WrappedComponent: React.FC<P & { fallback?: ReactNode }> = (props) => {
    const { fallback, ...restProps } = props as any;
    
    return (
      <Suspense fallback={fallback || defaultFallback}>
        <LazyComponent {...restProps} />
      </Suspense>
    );
  };

  WrappedComponent.displayName = `Lazy(${importFn.name || 'Component'})`;
  return WrappedComponent;
};

/**
 * 默认加载回退组件
 */
const defaultFallback: ReactNode = (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin mb-3"></div>
      <p className="text-sm text-gray-500">加载中...</p>
    </div>
  </div>
);

/**
 * 预加载组件
 * 在空闲时间预加载指定的组件
 * @param importFn 动态导入函数
 */
export const preloadComponent = (
  importFn: () => Promise<{ default: ComponentType<any> }>
): void => {
  if (typeof window !== 'undefined') {
    // 使用 requestIdleCallback 在浏览器空闲时预加载
    const idleCallback = (window as any).requestIdleCallback || setTimeout;
    idleCallback(() => {
      importFn();
    });
  }
};

/**
 * 批量预加载组件
 * @param importFns 动态导入函数数组
 */
export const preloadComponents = (
  importFns: Array<() => Promise<{ default: ComponentType<any> }>>
): void => {
  importFns.forEach((fn, index) => {
    // 错开预加载时间，避免同时加载过多
    setTimeout(() => preloadComponent(fn), index * 200);
  });
};

/**
 * 基于导航预测的预加载
 * 根据用户行为预测下一步导航并预加载
 * @param path 当前路径
 * @param routes 路由配置
 */
export interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType<any> }>;
}

export const preloadOnNavigation = (
  path: string,
  routes: RouteConfig[]
): void => {
  const currentRoute = routes.find((r) => r.path === path);
  if (!currentRoute) return;

  // 获取可能的下一个路由（根据业务逻辑）
  const nextRoutes = getNextRoutes(path, routes);
  
  nextRoutes.forEach((route) => {
    preloadComponent(route.component);
  });
};

/**
 * 获取可能的下一个路由
 * 这是一个简化的实现，可以根据实际业务逻辑扩展
 */
const getNextRoutes = (currentPath: string, routes: RouteConfig[]): RouteConfig[] => {
  const routeMap: { [key: string]: string[] } = {
    '/': ['/users', '/dashboard'],
    '/users': ['/users/:id', '/rules'],
    '/dashboard': ['/analysis', '/users'],
  };

  const nextPaths = routeMap[currentPath] || [];
  return routes.filter((r) => nextPaths.some((p) => r.path.startsWith(p)));
};

/**
 * 模块预加载策略
 * 根据不同场景选择预加载策略
 */
export enum PreloadStrategy {
  ON_IDLE = 'on_idle',
  ON_HOVER = 'on_hover',
  ON_VISIBILITY = 'on_visibility',
  INSTANT = 'instant',
}

/**
 * 创建带有预加载策略的懒加载组件
 */
export const createOptimizedLazyComponent = <P extends {} = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  strategy: PreloadStrategy = PreloadStrategy.ON_IDLE
): ComponentType<P> => {
  const LazyComponent = lazy(importFn) as React.ComponentType<any>;

  // 根据策略决定是否立即预加载
  if (strategy === PreloadStrategy.INSTANT) {
    importFn();
  } else if (strategy === PreloadStrategy.ON_IDLE) {
    preloadComponent(importFn);
  }

  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <Suspense fallback={defaultFallback}>
        <LazyComponent {...props as any} />
      </Suspense>
    );
  };

  WrappedComponent.displayName = `OptimizedLazy(${importFn.name || 'Component'})`;
  return WrappedComponent;
};
