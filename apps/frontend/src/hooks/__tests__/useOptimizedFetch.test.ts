import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useOptimizedFetch } from '../useOptimizedFetch';

describe('useOptimizedFetch', () => {
  it('enabled 默认：挂载即拉取，data/loading 正确流转', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [1] });
    const { result } = renderHook(() =>
      useOptimizedFetch<{ items: number[] }>(fetcher, [], { debounceDelay: 0 })
    );
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: [1] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetcher 抛错：error 被记录，onError 回调触发', async () => {
    const onError = vi.fn();
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useOptimizedFetch<number>(fetcher, [], { debounceDelay: 0, onError })
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalled();
  });

  it('enabled=false：跳过自驱拉取，loading 保持 false', async () => {
    const fetcher = vi.fn().mockResolvedValue(1);
    const { result } = renderHook(() =>
      useOptimizedFetch<number>(fetcher, [], { enabled: false, debounceDelay: 0 })
    );
    expect(result.current.loading).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('refetch 不受 enabled=false 限制，可手动触发', async () => {
    const fetcher = vi.fn().mockResolvedValue(42);
    const { result } = renderHook(() =>
      useOptimizedFetch<number>(fetcher, [], { enabled: false, debounceDelay: 0 })
    );
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe(42);
  });

  it('初始数据 + reset：清空 data/error 回到 initialData', async () => {
    const fetcher = vi.fn().mockResolvedValue(7);
    const { result } = renderHook(() =>
      useOptimizedFetch<number>(fetcher, [], { initialData: 0, debounceDelay: 0 })
    );
    await waitFor(() => expect(result.current.data).toBe(7));
    act(() => result.current.reset());
    expect(result.current.data).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('依赖变化：自动重新拉取', async () => {
    const fetcher = vi.fn().mockResolvedValue('a');
    const { rerender } = renderHook(
      ({ dep }: { dep: string }) => useOptimizedFetch<string>(fetcher, [dep], { debounceDelay: 0 }),
      { initialProps: { dep: 'a' } }
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ dep: 'b' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
