import { renderHook, waitFor, act } from '@testing-library/react';
import { useListFetch } from '../../hooks/useListFetch';

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
      expect(fetcher).toHaveBeenCalledWith({ page: 2, pageSize: 25, keyword: '张' })
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
});
