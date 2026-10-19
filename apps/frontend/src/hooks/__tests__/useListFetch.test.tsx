import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useListFetch } from '../useListFetch';

interface Item {
  id: number;
}

describe('useListFetch · 基础拉取（分页 / params / 错误）', () => {
  it('fetches paginated items and exposes total', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], total: 2 });
    const { result } = renderHook(() =>
      useListFetch<Item>({
        fetcher,
        params: { page: 1, pageSize: 10 },
        debounceDelay: 0,
      })
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches when page changes', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const { rerender } = renderHook(
      ({ page }: { page: number }) =>
        useListFetch<Item>({
          fetcher,
          params: { page, pageSize: 10 },
          debounceDelay: 0,
        }),
      { initialProps: { page: 1 } }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ page: 2 });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('refetches when filter params change', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useListFetch<Item>({
          fetcher,
          params: { page: 1, pageSize: 10, status },
          debounceDelay: 0,
        }),
      { initialProps: { status: 'active' } }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ status: 'inactive' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('passes params to fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [], total: 0 });
    renderHook(() =>
      useListFetch<Item>({
        fetcher,
        params: { page: 2, pageSize: 25, keyword: '张' },
        debounceDelay: 0,
      })
    );

    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith({
        page: 2,
        pageSize: 25,
        keyword: '张',
        skipCache: false,
      })
    );
  });

  it('sets error when fetcher rejects', async () => {
    const error = new Error('load failed');
    const fetcher = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useListFetch<number>({
        fetcher,
        params: { page: 1, pageSize: 10 },
        debounceDelay: 0,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('load failed');
  });

  it('refetch manually triggers a new fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [1], total: 1 });
    const { result } = renderHook(() =>
      useListFetch<number>({
        fetcher,
        params: { page: 1, pageSize: 10 },
        debounceDelay: 0,
      })
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('useListFetch · enabled 语义（按需加载）', () => {
  it('enabled=false 时挂载不自动请求', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const { result } = renderHook(() =>
      useListFetch<number>({
        fetcher,
        params: { page: 1, pageSize: 10 },
        debounceDelay: 0,
        enabled: false,
      })
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('enabled 由 false 变 true 时触发拉取', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [7], total: 1 });
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useListFetch<number>({
          fetcher,
          params: { page: 1, pageSize: 10 },
          debounceDelay: 0,
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.items).toEqual([7]));
  });

  it('enabled=false 时手动 refetch 仍可强制触发', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [1], total: 1 });
    const { result } = renderHook(() =>
      useListFetch<number>({
        fetcher,
        params: { page: 1, pageSize: 10 },
        debounceDelay: 0,
        enabled: false,
      })
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.items).toEqual([1]));
  });
});

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
