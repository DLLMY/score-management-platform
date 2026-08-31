import { useState, useCallback, useRef } from 'react';

interface OptimisticUpdate<T> {
  id: string;
  originalData: T;
  updateFn: (data: T) => T;
}

const useOptimisticUpdate = <T>() => {
  const [data, setData] = useState<T | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pendingUpdates = useRef<OptimisticUpdate<T>[]>([]);

  const applyOptimisticUpdate = useCallback(
    (update: OptimisticUpdate<T>) => {
      pendingUpdates.current.push(update);

      if (data) {
        setData((prev) => {
          if (!prev) return prev;
          return update.updateFn(prev);
        });
      }
    },
    [data]
  );

  const commitUpdate = useCallback((id: string) => {
    pendingUpdates.current = pendingUpdates.current.filter((u) => u.id !== id);
    setIsUpdating(false);
    setError(null);
  }, []);

  const rollbackUpdate = useCallback(
    (id: string) => {
      const update = pendingUpdates.current.find((u) => u.id === id);

      if (update && data) {
        setData(update.originalData);
      }

      pendingUpdates.current = pendingUpdates.current.filter((u) => u.id !== id);
      setIsUpdating(false);
    },
    [data]
  );

  const performUpdate = useCallback(
    async (
      id: string,
      updateFn: (data: T) => T,
      asyncFn: () => Promise<T>,
      onError?: (error: Error) => void
    ): Promise<T | null> => {
      if (!data) {
        const result = await asyncFn();
        setData(result);
        return result;
      }

      const originalData = { ...data };

      applyOptimisticUpdate({
        id,
        originalData,
        updateFn,
      });

      setIsUpdating(true);
      setError(null);

      try {
        const result = await asyncFn();
        setData(result);
        commitUpdate(id);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        rollbackUpdate(id);

        if (onError) {
          onError(error);
        }

        return null;
      }
    },
    [data, applyOptimisticUpdate, commitUpdate, rollbackUpdate]
  );

  const batchUpdate = useCallback(
    async (
      updates: Array<{
        id: string;
        updateFn: (data: T) => T;
        asyncFn: () => Promise<T>;
      }>,
      onError?: (error: Error) => void
    ): Promise<(T | null)[]> => {
      if (!data) {
        const results = await Promise.allSettled(updates.map((u) => u.asyncFn()));
        const validResults = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
        if (validResults[0]) {
          setData(validResults[0]);
        }
        return validResults;
      }

      const originalData = { ...data };

      updates.forEach((update) => {
        applyOptimisticUpdate({
          id: update.id,
          originalData,
          updateFn: update.updateFn,
        });
      });

      setIsUpdating(true);
      setError(null);

      try {
        const results = await Promise.allSettled(updates.map((u) => u.asyncFn()));

        const validResults = results.map((r, index) => {
          if (r.status === 'fulfilled') {
            commitUpdate(updates[index].id);
            return r.value;
          } else {
            rollbackUpdate(updates[index].id);
            return null;
          }
        });

        if (validResults[0]) {
          setData(validResults[0]);
        }

        setIsUpdating(false);
        return validResults;
      } catch (err) {
        const error = err as Error;
        setError(error);
        updates.forEach((u) => rollbackUpdate(u.id));

        if (onError) {
          onError(error);
        }

        setIsUpdating(false);
        return updates.map(() => null);
      }
    },
    [data, applyOptimisticUpdate, commitUpdate, rollbackUpdate]
  );

  return {
    data,
    setData,
    isUpdating,
    error,
    performUpdate,
    batchUpdate,
    applyOptimisticUpdate,
    commitUpdate,
    rollbackUpdate,
    hasPendingUpdates: pendingUpdates.current.length > 0,
  };
};

export { useOptimisticUpdate };
