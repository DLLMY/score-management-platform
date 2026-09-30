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
      ({ data }: { data: string }) => useAutoSave({ key: 'k1', data, onSave, debounceMs: 30 }),
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

  it('存在未保存变更时 beforeunload 阻止默认行为', () => {
    const { rerender } = renderHook(
      ({ data }: { data: string }) => useAutoSave({ key: 'k7', data, debounceMs: 30 }),
      { initialProps: { data: 'a' } }
    );
    rerender({ data: 'b' });
    const ev = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
  });

  it('loadDraft 草稿过期返回 null 并清除', () => {
    localStorage.setItem(
      'draft_k8',
      JSON.stringify({ data: 'expired', timestamp: Date.now() - 25 * 60 * 60 * 1000 })
    );
    const { result } = renderHook(() => useAutoSave({ key: 'k8', data: 'v1' }));
    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('draft_k8')).toBeNull();
  });

  it('二次变化（已保存后）hasUnsavedChanges 因 lastSaved 已存在而保持 false', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }: { data: string }) => useAutoSave({ key: 'k9', data, onSave, debounceMs: 30 }),
      { initialProps: { data: 'a' } }
    );
    rerender({ data: 'b' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('b'));
    rerender({ data: 'c' });
    await waitFor(() => expect(result.current.isDirty).toBe(true));
    // 源码语义：保存后 lastSaved 非空，后续变化 hasUnsavedChanges 为 false
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
