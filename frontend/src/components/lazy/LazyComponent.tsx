import React, { lazy, Suspense, ComponentType, ReactNode } from 'react';

interface LazyComponentProps {
  loading?: ReactNode;
  error?: ReactNode;
}

interface LazyModule<T> {
  default: T;
}

export const createLazyComponent = <P extends Record<string, unknown> = Record<string, unknown>>(
  importFn: () => Promise<LazyModule<ComponentType<P>>>,
  options: {
    loading?: ReactNode;
    error?: ReactNode;
    preload?: boolean;
  } = {}
): ComponentType<P & LazyComponentProps> => {
  const LazyComponent = lazy(importFn) as unknown as ComponentType<P>;

  if (options.preload) {
    importFn();
  }

  const WrappedComponent: React.FC<P & LazyComponentProps> = (props) => {
    const { loading: customLoading, error: customError, ...restProps } = props;
    
    const loadingElement = customLoading || options.loading || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );

    const errorElement = customError || options.error || (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">组件加载失败</h2>
        <p className="text-gray-500 dark:text-slate-400">请刷新页面重试</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          刷新页面
        </button>
      </div>
    );

    return (
      <Suspense fallback={loadingElement}>
        <ErrorBoundary fallback={errorElement}>
          <LazyComponent {...restProps as P} />
        </ErrorBoundary>
      </Suspense>
    );
  };

  WrappedComponent.displayName = `Lazy(${importFn.name || 'Component'})`;
  return WrappedComponent;
};

/**
 * 错误边界组件
 */
class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: true } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Lazy component error:', error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default createLazyComponent;
