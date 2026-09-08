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
  // M10 修复：事务级基准快照（本事务开始前的已提交 data）+ 本事务内已应用的更新序列。
  // 用于局部回滚——失败时仅剔除失败项、从基准重放其余项，保留已成功的兄弟项。
  const baseDataRef = useRef<T | null>(null);
  const appliedRef = useRef<OptimisticUpdate<T>[]>([]);

  const applyOptimisticUpdate = useCallback(
    (update: OptimisticUpdate<T>) => {
      pendingUpdates.current.push(update);
      appliedRef.current.push(update);

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
      pendingUpdates.current = pendingUpdates.current.filter((u) => u.id !== id);
      appliedRef.current = appliedRef.current.filter((u) => u.id !== id);

      // M10 修复：局部回滚——从基准快照重放"除失败项外"的所有已应用更新。
      // 单条更新/整批失败 → 重放后为空 → 回退到 baseData（与原语义一致）；
      // 批次部分失败 → 仅剔除失败项，已成功的兄弟项被保留。
      if (baseDataRef.current) {
        if (appliedRef.current.length === 0) {
          setData(baseDataRef.current);
        } else {
          let result = baseDataRef.current;
          for (const u of appliedRef.current) {
            result = u.updateFn(result);
          }
          setData(result);
        }
      }

      setIsUpdating(false);
    },
    []
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

      // M10：以当前已提交 data 为基准快照，重置本事务的应用序列
      baseDataRef.current = data;
      appliedRef.current = [];

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

      // M10：以当前已提交 data 为基准快照，重置本事务的应用序列
      baseDataRef.current = data;
      appliedRef.current = [];

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
