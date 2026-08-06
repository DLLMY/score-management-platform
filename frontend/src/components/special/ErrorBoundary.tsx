import React, { Component, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Zap } from 'lucide-react';
import { isDevelopment } from '../../config/env';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  errorLoggingEndpoint?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });

    if (isDevelopment) {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    this.props.onError?.(error, errorInfo);

    this.logErrorToBackend(error, errorInfo);
  }

  logErrorToBackend = async (error: Error, errorInfo: React.ErrorInfo) => {
    const endpoint = this.props.errorLoggingEndpoint || '/api/logs/error';
    const errorData = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
    };

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify(errorData));
      } else {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData),
          keepalive: true,
        });
      }
    } catch {
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
          <div className='max-w-lg w-full text-center'>
            <div className='relative mb-8'>
              <div className='w-24 h-24 mx-auto bg-red-500/20 rounded-full flex items-center justify-center animate-pulse'>
                <AlertTriangle className='w-12 h-12 text-red-500' />
              </div>
              <div className='absolute -top-2 -right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold animate-bounce'>
                !
              </div>
            </div>

            <h2 className='text-3xl font-bold text-white mb-3 tracking-tight'>页面出错了</h2>

            <p className='text-slate-400 mb-6 text-lg'>抱歉，页面加载时出现了错误。请尝试刷新页面。</p>

            <div className='bg-slate-800/50 rounded-xl p-4 mb-6 text-left border border-slate-700/50'>
              <div className='flex items-center gap-2 mb-3'>
                <Bug className='w-4 h-4 text-red-400' />
                <span className='text-xs text-slate-400 font-semibold uppercase tracking-wider'>错误信息</span>
              </div>
              <p className='text-sm text-red-400 break-all font-mono leading-relaxed'>
                {this.state.error?.message || '未知错误'}
              </p>
              {isDevelopment && this.state.errorInfo && (
                <div className='mt-3 pt-3 border-t border-slate-700/50'>
                  <p className='text-xs text-slate-500 mb-1'>组件堆栈:</p>
                  <pre className='text-xs text-slate-400 font-mono overflow-x-auto'>{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </div>

            <div className='flex flex-col sm:flex-row gap-3 justify-center'>
              <button
                onClick={this.handleRetry}
                className='flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-accent-600 transition-all duration-300 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:-translate-y-0.5'
              >
                <RefreshCw className='w-4 h-4' />
                刷新页面
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className='flex items-center justify-center gap-2 px-8 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-300 hover:-translate-y-0.5'
              >
                <Home className='w-4 h-4' />
                返回首页
              </button>
            </div>

            {isDevelopment && (
              <div className='mt-8 flex items-center justify-center gap-2 text-slate-500 text-sm'>
                <Zap className='w-4 h-4' />
                <span>开发环境 - 详细错误信息已在控制台输出</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorBoundaryFallbackProps {
  error?: Error | null;
  errorInfo?: React.ErrorInfo;
  onRetry?: () => void;
}

export const ErrorBoundaryFallback: React.FC<ErrorBoundaryFallbackProps> = ({
  error,
  onRetry,
}) => (
  <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4'>
    <div className='max-w-md w-full text-center'>
      <div className='w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-6'>
        <AlertTriangle className='w-10 h-10 text-red-500' />
      </div>
      <h2 className='text-2xl font-bold text-white mb-3'>页面加载失败</h2>
      <p className='text-slate-400 mb-6 text-sm'>{error?.message || '请刷新页面重试'}</p>
      <button
        onClick={onRetry || (() => window.location.reload())}
        className='flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-all'
      >
        <RefreshCw className='w-4 h-4' />
        刷新页面
      </button>
    </div>
  </div>
);

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const ErrorBoundaryWrapper: React.FC<ErrorBoundaryWrapperProps> = ({
  children,
  fallback,
  onError,
}) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
      onError?.(event.error, { componentStack: 'Global error' });
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const error = new Error(`Unhandled promise rejection: ${event.reason}`);
      setHasError(true);
      setError(error);
      onError?.(error, { componentStack: 'Promise rejection' });
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, [onError]);

  if (hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <ErrorBoundaryFallback error={error} onRetry={() => window.location.reload()} />;
  }

  return <>{children}</>;
};

export default ErrorBoundaryClass;