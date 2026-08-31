import { renderHook } from '@testing-library/react';
import { useClientFilter } from '../../hooks/useClientFilter';

describe('useClientFilter', () => {
  test('returns items filtered by predicate', () => {
    const { result } = renderHook(() =>
      useClientFilter([1, 2, 3, 4], (n) => n % 2 === 0, [])
    );
    expect(result.current).toEqual([2, 4]);
  });

  test('recomputes when deps change (predicate closes over dep)', () => {
    const { result, rerender } = renderHook(
      ({ keyword }: { keyword: string }) =>
        useClientFilter(
          ['apple', 'banana', 'cherry'],
          (s) => s.includes(keyword),
          [keyword]
        ),
      { initialProps: { keyword: 'a' } }
    );
    expect(result.current).toEqual(['apple', 'banana']);

    rerender({ keyword: 'n' });
    expect(result.current).toEqual(['banana']);
  });

  test('does not recompute when deps unchanged even if predicate recreated', () => {
    const items = [1, 2, 3];
    const { result, rerender } = renderHook(() =>
      useClientFilter(items, (n) => n > 0, [])
    );
    const first = result.current;
    // 重渲染：items 引用不变、deps 为空 → useMemo 缓存，结果引用不变
    rerender();
    expect(result.current).toBe(first);
  });

  test('recomputes when items reference changes', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: number[] }) => useClientFilter(items, (n) => n > 0, []),
      { initialProps: { items: [1, 2] } }
    );
    expect(result.current).toEqual([1, 2]);

    rerender({ items: [3, 4] });
    expect(result.current).toEqual([3, 4]);
  });
});
