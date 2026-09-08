import { renderHook, waitFor, act } from '@testing-library/react';
import { useListData } from '../../hooks/useListData';

describe('useListData', () => {
  test('fetches data on mount and exposes loading lifecycle', async () => {
    const fetcher = jest.fn().mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() =>
      useListData<{ id: number }>({ fetcher, debounceDelay: 0 })
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('refetches when deps change', async () => {
    const fetcher = jest.fn().mockResolvedValue([{ id: 1 }]);
    const { result, rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) =>
        useListData<{ id: number }>({ fetcher, deps, debounceDelay: 0 }),
      { initialProps: { deps: [1] } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ deps: [2] });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  test('does not refetch when deps unchanged', async () => {
    const fetcher = jest.fn().mockResolvedValue([1, 2, 3]);
    const { rerender } = renderHook(
      ({ deps }: { deps: unknown[] }) =>
        useListData<number>({ fetcher, deps, debounceDelay: 0 }),
      { initialProps: { deps: [1] } }
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ deps: [1] });
    // 等待防抖窗口后仍只调用一次
    await new Promise((r) => setTimeout(r, 50));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('sets error and invokes onError on failure', async () => {
    const error = new Error('boom');
    const onError = jest.fn();
    const fetcher = jest.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useListData<number>({ fetcher, debounceDelay: 0, onError })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(onError).toHaveBeenCalledWith(error);
  });

  test('refetch manually triggers a new fetch', async () => {
    const fetcher = jest.fn().mockResolvedValue([1, 2]);
    const { result } = renderHook(() =>
      useListData<number>({ fetcher, debounceDelay: 0 })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
