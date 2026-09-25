import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useAutoSave } from '../useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('脏数据自动保存 (onSave) 并标记 lastSaved / isDirty 复位', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }: { data: string }) =>
        useAutoSave({ key: 'k1', data, onSave, debounceMs: 30 }),
      { initialProps: { data: 'v1' } }
    );
    rerender({ data: 'v2' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('v2'));
    await waitFor(() => expect(result.current.lastSaved).not.toBeNull());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('挂载检测到近期草稿 → draftAvailable=true', () => {
    localStorage.setItem('draft_k2', JSON.stringify({ data: 'x', timestamp: Date.now() }));
    const { result } = renderHook(() => useAutoSave({ key: 'k2', data: 'v1' }));
    expect(result.current.draftAvailable).toBe(true);
  });

  it('clearDraft 删除草稿并清状态', () => {
    localStorage.setItem('draft_k3', JSON.stringify({ data: 'x', timestamp: Date.now() }));
    const { result } = renderHook(() => useAutoSave({ key: 'k3', data: 'v1' }));
    expect(result.current.draftAvailable).toBe(true);
    act(() => result.current.clearDraft());
    expect(result.current.draftAvailable).toBe(false);
    expect(localStorage.getItem('draft_k3')).toBeNull();
  });

  it('loadDraft 读取有效草稿；restoreDraft 恢复并清状态', () => {
    localStorage.setItem('draft_k4', JSON.stringify({ data: 'recovered', timestamp: Date.now() }));
    const { result } = renderHook(() => useAutoSave({ key: 'k4', data: 'v1' }));
    expect(result.current.loadDraft()).toBe('recovered');
    act(() => {
      const r = result.current.restoreDraft();
      expect(r).toBe('recovered');
    });
    expect(result.current.draftAvailable).toBe(false);
  });

  it('onSave 抛错 → onSaveError 被调用且 isSaving 复位', async () => {
    const onSaveError = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error('fail'));
    const { result, rerender } = renderHook(
      ({ data }: { data: string }) =>
        useAutoSave({ key: 'k5', data, onSave, onSaveError, debounceMs: 30 }),
      { initialProps: { data: 'a' } }
    );
    rerender({ data: 'b' });
    await waitFor(() => expect(onSaveError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isSaving).toBe(false));
  });

  it('discardChanges 复位并清草稿', () => {
    localStorage.setItem('draft_k6', JSON.stringify({ data: 'x', timestamp: Date.now() }));
    const { result, rerender } = renderHook(
      ({ data }: { data: string }) => useAutoSave({ key: 'k6', data, debounceMs: 30 }),
      { initialProps: { data: 'a' } }
    );
    rerender({ data: 'b' });
    act(() => result.current.discardChanges());
    expect(result.current.draftAvailable).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });
});
