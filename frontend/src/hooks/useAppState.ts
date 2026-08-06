import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingState {
  id: string;
  message?: string;
  type: 'global' | 'local' | 'silent';
}

interface AppState {
  loadingStates: LoadingState[];
  isGlobalLoading: boolean;
  pendingOperations: Record<string, boolean>;
}

const initialState: AppState = {
  loadingStates: [],
  isGlobalLoading: false,
  pendingOperations: {},
};

const useAppState = () => {
  const [state, setState] = useState<AppState>(initialState);
  const debounceRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const addLoading = useCallback((id: string, message?: string, type: LoadingState['type'] = 'local') => {
    setState(prev => {
      const exists = prev.loadingStates.some(s => s.id === id);
      if (exists) return prev;
      const newStates = [...prev.loadingStates, { id, message, type }];
      return {
        ...prev,
        loadingStates: newStates,
        isGlobalLoading: newStates.some(s => s.type === 'global'),
      };
    });
  }, []);

  const removeLoading = useCallback((id: string) => {
    setState(prev => {
      const newStates = prev.loadingStates.filter(s => s.id !== id);
      return {
        ...prev,
        loadingStates: newStates,
        isGlobalLoading: newStates.some(s => s.type === 'global'),
      };
    });
  }, []);

  const wrapAsync = useCallback(async <T>(
    id: string,
    asyncFn: () => Promise<T>,
    options: { 
      message?: string; 
      type?: LoadingState['type'];
      onSuccess?: (data: T) => void;
      onError?: (error: Error) => void;
      optimisticUpdate?: () => void;
      rollbackUpdate?: () => void;
    } = {}
  ): Promise<T | null> => {
    const { message, type = 'local', onSuccess, onError, optimisticUpdate, rollbackUpdate } = options;
    
    addLoading(id, message, type);
    
    try {
      if (optimisticUpdate) {
        optimisticUpdate();
      }
      
      const result = await asyncFn();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      if (rollbackUpdate) {
        rollbackUpdate();
      }
      
      if (onError) {
        onError(error as Error);
      } else {
        console.error(`Async operation failed [${id}]:`, error);
      }
      
      return null;
    } finally {
      removeLoading(id);
    }
  }, [addLoading, removeLoading]);

  const setPending = useCallback((key: string, value: boolean) => {
    setState(prev => ({
      ...prev,
      pendingOperations: {
        ...prev.pendingOperations,
        [key]: value,
      },
    }));
  }, []);

  const isPending = useCallback((key: string) => {
    return state.pendingOperations[key] || false;
  }, [state.pendingOperations]);

  const debounce = useCallback(<T extends (...args: never[]) => void>(
    key: string,
    fn: T,
    delay: number = 300
  ): ((...args: Parameters<T>) => void) => {
    return (...args: Parameters<T>) => {
      if (debounceRefs.current[key]) {
        clearTimeout(debounceRefs.current[key]);
      }
      debounceRefs.current[key] = setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }, []);

  const throttle = useCallback(<T extends (...args: unknown[]) => void>(
    _key: string,
    fn: T,
    limit: number = 300
  ) => {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }, []);

  useEffect(() => {
    const refs = debounceRefs.current;
    return () => {
      Object.values(refs).forEach(clearTimeout);
    };
  }, []);

  return {
    ...state,
    addLoading,
    removeLoading,
    wrapAsync,
    setPending,
    isPending,
    debounce,
    throttle,
  };
};

export { useAppState };
export type { LoadingState, AppState };