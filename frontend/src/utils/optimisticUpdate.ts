import React from 'react';

interface OptimisticUpdateOptions<T> {
  update: (data: T) => void;
  revert: () => void;
  onSuccess?: (response: unknown) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export async function withOptimisticUpdate<T>(
  data: T,
  apiCall: () => Promise<unknown>,
  options: OptimisticUpdateOptions<T>
): Promise<unknown> {
  const { update, revert, onSuccess, onError, onComplete } = options;

  try {
    update(data);

    const response = await apiCall();

    onSuccess?.(response);
    return response;
  } catch (error) {
    revert();

    const errorObj = error instanceof Error ? error : new Error(String(error));
    onError?.(errorObj);
    throw errorObj;
  } finally {
    onComplete?.();
  }
}

export function useOptimisticState<T>(initialState: T): {
  state: T;
  isOptimistic: boolean;
  setOptimistic: (updateFn: (prev: T) => T) => () => void;
  reset: () => void;
} {
  const [state, setState] = React.useState<T>(initialState);
  const [previousState, setPreviousState] = React.useState<T>(initialState);
  const [isOptimistic, setIsOptimistic] = React.useState(false);

  const setOptimistic = (updateFn: (prev: T) => T): () => void => {
    setState((prev) => {
      setPreviousState(prev);
      setIsOptimistic(true);
      return updateFn(prev);
    });

    return () => {
      setState(previousState);
      setIsOptimistic(false);
    };
  };

  const reset = () => {
    setState(previousState);
    setIsOptimistic(false);
  };

  return { state, isOptimistic, setOptimistic, reset };
}

export interface OptimisticAction<T> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
}

class OptimisticQueue<T> {
  private queue: OptimisticAction<T>[] = [];
  private resolvedIds: Set<string> = new Set();
  private rejectedIds: Set<string> = new Set();
  private maxQueueSize = 100;

  add(action: Omit<OptimisticAction<T>, 'timestamp'>): void {
    const fullAction: OptimisticAction<T> = {
      ...action,
      timestamp: Date.now(),
    };

    this.queue.push(fullAction);

    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
    }
  }

  resolve(id: string): void {
    this.resolvedIds.add(id);
    this.cleanup();
  }

  reject(id: string): OptimisticAction<T> | undefined {
    this.rejectedIds.add(id);
    const action = this.queue.find((a) => a.id === id);
    this.cleanup();
    return action;
  }

  cleanup(): void {
    this.queue = this.queue.filter(
      (a) => !this.resolvedIds.has(a.id) && !this.rejectedIds.has(a.id)
    );
  }

  getPendingActions(): OptimisticAction<T>[] {
    return this.queue.filter(
      (a) => !this.resolvedIds.has(a.id) && !this.rejectedIds.has(a.id)
    );
  }

  getAllActions(): OptimisticAction<T>[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
    this.resolvedIds.clear();
    this.rejectedIds.clear();
  }
}

export const createOptimisticQueue = <T>(): OptimisticQueue<T> => {
  return new OptimisticQueue<T>();
};

export function generateOptimisticId(): string {
  return `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function applyOptimisticUpdates<T>(
  baseState: T,
  actions: OptimisticAction<T>[],
  applyAction: (state: T, action: OptimisticAction<T>) => T
): T {
  return actions.reduce(applyAction, baseState);
}
