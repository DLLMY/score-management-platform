import { renderHook, waitFor, act } from '@testing-library/react';
import { useListFetch } from '../../hooks';

describe('useListFetch', () => {
  test('fetches paginated items and exposes total', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [{ id: 1 }, { id: 2 }], total: 2 });
    const { result } = renderHook(() =>
      useListFetch<{ id: number }>({
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

  test('refetches when page changes', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const { rerender } = renderHook(
      ({ page }: { page: number }) =>
        useListFetch<{ id: number }>({
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

  test('refetches when filter params change', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useListFetch<{ id: number }>({
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

  test('passes params to fetcher', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [], total: 0 });
    renderHook(() =>
      useListFetch<{ id: number }>({
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

  test('sets error when fetcher rejects', async () => {
    const error = new Error('load failed');
    const fetcher = jest.fn().mockRejectedValue(error);
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

  test('refetch manually triggers a new fetch', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [1], total: 1 });
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

  // ---- skipCache 透传（2026-09-06 专项：mutation 后绕开前端缓存）----

  test('refetch({ skipCache: true }) 透传 skipCache 给 fetcher', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [1], total: 1 });
    const { result } = renderHook(() =>
      useListFetch<number>({
        fetcher,
        params: { page: 1, pageSize: 10 },
        debounceDelay: 0,
      })
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refetch({ skipCache: true });
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toMatchObject({ page: 1, pageSize: 10, skipCache: true });
  });

  test('refetch({ params: { page: 1 } }) 单次覆盖参数且不改写外部 params', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useListFetch<number>({
          fetcher,
          params: { page, pageSize: 10 },
          debounceDelay: 0,
        }),
      { initialProps: { page: 3 } }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toMatchObject({ page: 3 });

    await act(async () => {
      await result.current.refetch({ params: { page: 1 } });
    });
    expect(fetcher.mock.calls[1][0]).toMatchObject({ page: 1, pageSize: 10, skipCache: false });

    // 外部受控 params 未被改写：改为 page=5 时自驱重拉仍用 5（而非被覆盖的 1）
    rerender({ page: 5 });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(fetcher.mock.calls[2][0]).toMatchObject({ page: 5 });
  });

  test('普通 refetch 默认不带 skipCache', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [1], total: 1 });
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
    expect(fetcher.mock.calls[1][0]).toMatchObject({ page: 1, pageSize: 10, skipCache: false });
  });

  // ---- enabled 语义（2026-09-06 专项：模态/切 tab 按需加载）----

  test('enabled=false 时挂载不自动请求', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [], total: 0 });
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

  test('enabled 由 false 变 true 时触发拉取', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [7], total: 1 });
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

  test('enabled=false 时手动 refetch 仍可强制触发', async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [1], total: 1 });
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
