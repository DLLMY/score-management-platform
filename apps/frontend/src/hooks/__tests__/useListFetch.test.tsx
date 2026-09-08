import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useListFetch } from '../useListFetch';

interface Item {
  id: number;
}

describe('useListFetch 乐观覆写（mutate/setItems/setTotal）', () => {
  it('本地覆写即时生效，新服务端数据到达后自动让位', async () => {
    const fetcher = vi.fn();
    fetcher.mockResolvedValueOnce({ items: [{ id: 1 }], total: 1 });

    const params: { page: number; pageSize: number } = { page: 1, pageSize: 20 };
    const { result } = renderHook(() =>
      useListFetch<Item>({ fetcher, params, debounceDelay: 0 })
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1 }]));

    // mutate：一次批量覆写 items + total
    act(() => {
      result.current.mutate({ items: [{ id: 9 }], total: 7 });
    });
    expect(result.current.items).toEqual([{ id: 9 }]);
    expect(result.current.total).toBe(7);

    // setItems / setTotal：分离覆写（覆盖前一次 mutate 的对应字段）
    act(() => {
      result.current.setItems([{ id: 8 }]);
      result.current.setTotal(3);
    });
    expect(result.current.items).toEqual([{ id: 8 }]);
    expect(result.current.total).toBe(3);

    // refetch 拉到新服务端数据后，override 应让位给服务端真值
    fetcher.mockResolvedValueOnce({ items: [{ id: 2 }], total: 2 });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.items).toEqual([{ id: 2 }]));
    expect(result.current.total).toBe(2);
  });
});
