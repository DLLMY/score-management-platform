import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

interface LoadingState {
  isLoading: boolean;
  message: string;
}

interface ErrorState {
  hasError: boolean;
  error: Error | null;
}

interface NetworkState {
  isOnline: boolean;
  isReconnecting: boolean;
}

const LoadingContext = createContext<{
  state: LoadingState;
  show: (message?: string) => void;
  hide: () => void;
}>({
  state: { isLoading: false, message: '' },
  show: () => {},
  hide: () => {},
});

const ErrorContext = createContext<{
  state: ErrorState;
  clear: () => void;
}>({
  state: { hasError: false, error: null },
  clear: () => {},
});

const NetworkContext = createContext<NetworkState>({
  isOnline: true,
  isReconnecting: false,
});

export const useLoading = () => useContext(LoadingContext);
export const useGlobalError = () => useContext(ErrorContext);
export const useNetworkStatus = () => useContext(NetworkContext);

interface GlobalStateProviderProps {
  children: ReactNode;
}

export function GlobalStateProvider({ children }: GlobalStateProviderProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false, message: '' });
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false, error: null });
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isReconnecting: false,
  });

  useEffect(() => {
    const handleOnline = () => setNetworkState({ isOnline: true, isReconnecting: false });
    const handleOffline = () => setNetworkState({ isOnline: false, isReconnecting: false });
    const handleReconnecting = () => setNetworkState((prev) => ({ ...prev, isReconnecting: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('load', handleReconnecting);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('load', handleReconnecting);
    };
  }, []);

  const showLoading = useCallback((message: string = '加载中...') => {
    setLoadingState({ isLoading: true, message });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState({ isLoading: false, message: '' });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({ hasError: false, error: null });
  }, []);

  return (
    <LoadingContext.Provider value={{ state: loadingState, show: showLoading, hide: hideLoading }}>
      <ErrorContext.Provider value={{ state: errorState, clear: clearError }}>
        <NetworkContext.Provider value={networkState}>{children}</NetworkContext.Provider>
      </ErrorContext.Provider>
    </LoadingContext.Provider>
  );
}

export function GlobalLoading(): JSX.Element | null {
  const { state } = useLoading();

  if (!state.isLoading) return null;

  return (
    <div className='fixed inset-0 bg-black/30 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 shadow-xl flex flex-col items-center'>
        <div className='w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4'></div>
        <p className='text-gray-700'>{state.message}</p>
      </div>
    </div>
  );
}

export function GlobalErrorBoundary(): JSX.Element | null {
  const { state, clear } = useGlobalError();

  if (!state.hasError) return null;

  return (
    <div className='fixed inset-0 bg-black/30 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 shadow-xl max-w-md'>
        <div className='flex items-center mb-4'>
          <div className='w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3'>
            <span className='text-red-500 text-xl'>⚠️</span>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-gray-800'>发生错误</h3>
            <p className='text-sm text-gray-500'>{state.error?.message || '未知错误'}</p>
          </div>
        </div>
        <button
          onClick={clear}
          className='w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
        >
          关闭
        </button>
      </div>
    </div>
  );
}

export function NetworkStatusIndicator(): JSX.Element | null {
  const { isOnline, isReconnecting } = useNetworkStatus();

  if (isOnline && !isReconnecting) return null;

  return (
    <div className='fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50'>
      <div className='flex items-center'>
        <div
          className={`w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-yellow-500' : 'bg-red-500'}`}
        ></div>
        <span className='text-sm text-gray-700'>
          {isReconnecting ? '正在重连...' : '网络已断开'}
        </span>
      </div>
    </div>
  );
}

export default GlobalStateProvider;
