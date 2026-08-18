import React, { useState, useEffect, lazy, Suspense, ComponentType, ReactNode } from 'react';

interface ConditionalLazyProps {
  condition: boolean;
  fallback?: ReactNode;
  children?: ReactNode;
}

/**
 * 条件懒加载组件
 * 只有当条件满足时才加载子组件
 */
export const ConditionalLazy: React.FC<ConditionalLazyProps> = ({
  condition,
  fallback = null,
  children,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (condition) {
      setIsLoaded(true);
    }
  }, [condition]);

  if (!condition) {
    return <>{fallback}</>;
  }

  return <>{isLoaded && children}</>;
};

/**
 * 基于功能标志的懒加载组件
 * @param featureFlag 功能标志名称
 * @param importFn 动态导入函数
 * @param FallbackComponent 未启用时的回退组件
 * @returns 懒加载组件
 */
export const FeatureLazy = <P extends Record<string, unknown> = Record<string, unknown>>(
  featureFlag: string,
  importFn: () => Promise<{ default: ComponentType<P> }>,
  FallbackComponent: ComponentType<P>
): ComponentType<P> => {
  const LazyComponent = lazy(importFn) as unknown as ComponentType<P>;

  const WrappedComponent: React.FC<P> = (props) => {
    const [isFeatureEnabled, setIsFeatureEnabled] = useState(false);

    useEffect(() => {
      const enabled = localStorage.getItem(`feature_${featureFlag}`) === 'true';
      setIsFeatureEnabled(enabled);
    }, []);

    if (!isFeatureEnabled) {
      return <FallbackComponent {...props} />;
    }

    return (
      <Suspense
        fallback={
          <div className='flex items-center justify-center py-8'>
            <div className='w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin'></div>
          </div>
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  WrappedComponent.displayName = `FeatureLazy(${featureFlag})`;
  return WrappedComponent;
};

export default ConditionalLazy;
