import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { abortAllRequests, abortControllers } from '../services/api';
import { useConfirm } from '../components/ui/ConfirmDialog';

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
): ((nextLocation: { pathname: string }) => Promise<boolean | undefined>) => {
  const location = useLocation();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  return useCallback(
    async (nextLocation) => {
      if (nextLocation.pathname === location.pathname) {
        return undefined;
      }

      const pendingCount = abortControllers.size;
      if (pendingCount > 0) {
        const ok = await confirmRef.current({
          message: `${message}（${pendingCount} 个请求进行中）`,
          confirmText: '离开',
          cancelText: '留下',
          type: 'warning',
        });
        if (ok) {
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
