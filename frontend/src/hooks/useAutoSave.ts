import logger from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';

interface UseAutoSaveOptions<T> {
  key: string;
  data: T;
  onSave?: (data: T) => void | Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  isDirty: boolean;
}

export function useAutoSave<T>({
  key,
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions<T>) {
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    isDirty: false,
  });

  const [previousData, setPreviousData] = useState<T>(data);

  useEffect(() => {
    const hasChanges = JSON.stringify(data) !== JSON.stringify(previousData);
    setState((prev) => ({
      ...prev,
      isDirty: hasChanges,
      hasUnsavedChanges: hasChanges && !prev.lastSaved,
    }));

    if (hasChanges) {
      saveDraft(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, previousData]);

  useEffect(() => {
    const savedDraft = localStorage.getItem(`draft_${key}`);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.timestamp) {
          const age = Date.now() - parsed.timestamp;
          if (age < 24 * 60 * 60 * 1000) {
            setState((prev) => ({
              ...prev,
              hasUnsavedChanges: true,
            }));
          }
        }
      } catch (error) {
        logger.error('读取草稿失败:', error);
      }
    }
  }, [key]);

  const saveDraft = useCallback(
    (currentData: T) => {
      localStorage.setItem(
        `draft_${key}`,
        JSON.stringify({
          data: currentData,
          timestamp: Date.now(),
        })
      );
    },
    [key]
  );

  const loadDraft = useCallback((): T | null => {
    const savedDraft = localStorage.getItem(`draft_${key}`);
    if (!savedDraft) return null;

    try {
      const parsed = JSON.parse(savedDraft);
      const age = Date.now() - parsed.timestamp;

      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`draft_${key}`);
        return null;
      }

      return parsed.data as T;
    } catch (error) {
      logger.error('加载草稿失败:', error);
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(`draft_${key}`);
    setState((prev) => ({
      ...prev,
      hasUnsavedChanges: false,
      isDirty: false,
    }));
  }, [key]);

  const discardChanges = useCallback(() => {
    setPreviousData(data);
    clearDraft();
  }, [data, clearDraft]);

  const restoreDraft = useCallback((): T | null => {
    const draft = loadDraft();
    if (draft) {
      setPreviousData(draft);
      setState((prev) => ({
        ...prev,
        hasUnsavedChanges: false,
        isDirty: false,
      }));
    }
    return draft;
  }, [loadDraft]);

  useEffect(() => {
    if (!enabled || !state.isDirty || !onSave) return;

    const timer = setTimeout(async () => {
      setState((prev) => ({ ...prev, isSaving: true }));

      try {
        await onSave(data);
        setState((prev) => ({
          ...prev,
          isSaving: false,
          lastSaved: new Date(),
          hasUnsavedChanges: false,
        }));
        setPreviousData(data);
        clearDraft();
        onSaveSuccess?.();
      } catch (error) {
        setState((prev) => ({ ...prev, isSaving: false }));
        onSaveError?.(error as Error);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [enabled, state.isDirty, data, onSave, debounceMs, clearDraft, onSaveSuccess, onSaveError]);

  return {
    ...state,
    loadDraft,
    clearDraft,
    discardChanges,
    restoreDraft,
  };
}

export default useAutoSave;
