import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { abortAllRequests, abortControllers } from '../services/api';

interface UseRouteChangeAbortOptions {
  enabled?: boolean;
  onAbort?: (count: number) => void;
}

export const useRouteChangeAbort = ({
  enabled = true,
  onAbort,
}: UseRouteChangeAbortOptions = {}): void => {
  const location = useLocation();
  const abortInProgressRef = useRef(false);

  const handleRouteChange = useCallback(() => {
    if (!enabled || abortInProgressRef.current) {
      return;
    }

    abortInProgressRef.current = true;
    const pendingCount = abortControllers.size;

    abortAllRequests();

    onAbort?.(pendingCount);

    setTimeout(() => {
      abortInProgressRef.current = false;
    }, 100);
  }, [enabled, onAbort]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleRouteChange);
    };
  }, [handleRouteChange]);

  useEffect(() => {
    handleRouteChange();
  }, [location.pathname, handleRouteChange]);
};

export const usePendingRequestCount = (): number => {
  return abortControllers.size;
};

export const useConfirmRouteChange = (
  message: string = '有未完成的请求，确定要离开吗？'
): ((nextLocation: { pathname: string }) => boolean | undefined) => {
  const location = useLocation();

  return useCallback(
    (nextLocation) => {
      if (nextLocation.pathname === location.pathname) {
        return undefined;
      }

      const pendingCount = abortControllers.size;
      if (pendingCount > 0) {
        if (window.confirm(`${message}（${pendingCount} 个请求进行中）`)) {
          abortAllRequests();
          return undefined;
        }
        return false;
      }
      return undefined;
    },
    [location.pathname, message]
  );
};

export default useRouteChangeAbort;