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
    const { result } = renderHook(() => useListFetch<Item>({ fetcher, params, debounceDelay: 0 }));

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

describe('useListFetch 单次覆盖（skipCache / params）', () => {
  it('refetch({ skipCache }) 透传给 fetcher，且不影响外部受控 params', async () => {
    const fetcher = vi.fn();
    fetcher.mockResolvedValue({ items: [{ id: 1 }], total: 1 });

    const params: { page: number; pageSize: number } = { page: 1, pageSize: 20 };
    const { result } = renderHook(() => useListFetch<Item>({ fetcher, params, debounceDelay: 0 }));

    // 自驱首次拉取：skipCache 默认为 false（走前端缓存）
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 20, skipCache: false });

    // 手动 refetch({ skipCache: true })：本次请求绕缓存
    await act(async () => {
      await result.current.refetch({ skipCache: true });
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toMatchObject({ page: 1, pageSize: 20, skipCache: true });

    // 下一次自驱/普通 refetch 回到默认（skipCache 是瞬时控制，不残留）
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher.mock.calls[2][0]).toMatchObject({ skipCache: false });
  });

  it('refetch({ params }) 仅作用于当次请求（如跳回第 1 页），不改外部 params', async () => {
    const fetcher = vi.fn();
    fetcher.mockResolvedValue({ items: [{ id: 1 }], total: 1 });

    const params: { page: number; pageSize: number } = { page: 3, pageSize: 20 };
    const { result } = renderHook(() => useListFetch<Item>({ fetcher, params, debounceDelay: 0 }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 3 });

    // 单次覆盖：仅本次请求用 page=1
    await act(async () => {
      await result.current.refetch({ params: { page: 1 } });
    });
    expect(fetcher.mock.calls[1][0]).toMatchObject({ page: 1, pageSize: 20 });

    // 覆盖已失效：再次普通 refetch 回到外部受控 params（page=3）
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher.mock.calls[2][0]).toMatchObject({ page: 3, pageSize: 20 });
  });
});
