import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClientFilter } from '../useClientFilter';

describe('useClientFilter · 本地派生过滤', () => {
  const items = [
    { id: 1, name: 'a', active: true },
    { id: 2, name: 'b', active: false },
    { id: 3, name: 'a', active: true },
  ];

  it('按 predicate 过滤，不改变原数组', () => {
    const { result } = renderHook(() => useClientFilter(items, (i) => i.name === 'a', []));
    expect(result.current).toHaveLength(2);
    expect(result.current.every((i) => i.name === 'a')).toBe(true);
  });

  it('deps 变化触发重算（不传 term 时全量）', () => {
    const { result, rerender } = renderHook(
      ({ term }: { term: string }) => useClientFilter(items, (i) => i.name === term, [term]),
      { initialProps: { term: 'a' } }
    );
    expect(result.current).toHaveLength(2);
    rerender({ term: 'b' });
    expect(result.current).toHaveLength(1);
    rerender({ term: 'z' });
    expect(result.current).toHaveLength(0);
  });

  it('空 items 返回空数组', () => {
    const { result } = renderHook(() => useClientFilter([], () => true, []));
    expect(result.current).toEqual([]);
  });
});
