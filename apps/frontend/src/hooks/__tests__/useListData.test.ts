import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useListData } from '../useListData';

describe('useListData', () => {
  it('fetcher 返回数组 → data 正确，loading 收尾', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useListData({ fetcher, debounceDelay: 0 }));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 1 }]));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('initialData 兜底（fetcher 返回 null 时）', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      useListData({ fetcher, initialData: [{ id: 9 }], debounceDelay: 0 })
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(result.current.data).toEqual([{ id: 9 }]);
  });

  it('onError 透传 + error 字段为 Error 对象', async () => {
    const onError = vi.fn();
    const fetcher = vi.fn().mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useListData({ fetcher, onError, debounceDelay: 0 }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(onError).toHaveBeenCalled();
  });

  it('enabled=false：不自动拉取，refetch 仍可触发', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 2 }]);
    const { result } = renderHook(() => useListData({ fetcher, enabled: false, debounceDelay: 0 }));
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual([{ id: 2 }]);
  });
});
