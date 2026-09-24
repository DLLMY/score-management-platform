import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTableUrlState } from '../useTableUrlState';

function makeWrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe('useTableUrlState · 分页/排序持久化到 URL', () => {
  it('默认值（无 query）', () => {
    const { result } = renderHook(() => useTableUrlState(), {
      wrapper: makeWrapper('/'),
    });
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.sortField).toBe('');
    expect(result.current.sortOrder).toBe(null);
  });

  it('从 URL query 解析初始态', () => {
    const { result } = renderHook(() => useTableUrlState(), {
      wrapper: makeWrapper('/?page=2&pageSize=50&sortField=name&sortOrder=descend'),
    });
    expect(result.current.page).toBe(2);
    expect(result.current.pageSize).toBe(50);
    expect(result.current.sortField).toBe('name');
    expect(result.current.sortOrder).toBe('descend');
  });

  it('setPage 更新页码', () => {
    const { result } = renderHook(() => useTableUrlState(), {
      wrapper: makeWrapper('/'),
    });
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
  });

  it('setPageSize 夹取边界并重置到第 1 页', () => {
    const { result } = renderHook(() => useTableUrlState(), {
      wrapper: makeWrapper('/?page=4'),
    });
    act(() => result.current.setPageSize(30));
    expect(result.current.pageSize).toBe(30);
    expect(result.current.page).toBe(1);

    act(() => result.current.setPageSize(999));
    expect(result.current.pageSize).toBe(200); // MAX 夹取
    act(() => result.current.setPageSize(0));
    expect(result.current.pageSize).toBe(1); // MIN 夹取
  });

  it('setSort 设置排序并重置页码；空 field 清除排序', () => {
    const { result } = renderHook(() => useTableUrlState(), {
      wrapper: makeWrapper('/?page=5'),
    });
    act(() => result.current.setSort('age', 'ascend'));
    expect(result.current.sortField).toBe('age');
    expect(result.current.sortOrder).toBe('ascend');
    expect(result.current.page).toBe(1);

    act(() => result.current.setSort('', 'ascend'));
    expect(result.current.sortField).toBe('');
    expect(result.current.sortOrder).toBe(null);
  });

  it('reset 回到默认', () => {
    const { result } = renderHook(() => useTableUrlState(), {
      wrapper: makeWrapper('/?page=9&pageSize=40&sortField=x&sortOrder=ascend'),
    });
    act(() => result.current.reset());
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.sortField).toBe('');
    expect(result.current.sortOrder).toBe(null);
  });

  it('key 命名空间隔离', () => {
    const { result } = renderHook(() => useTableUrlState('foo'), {
      wrapper: makeWrapper('/?foo_page=4&foo_pageSize=10'),
    });
    expect(result.current.page).toBe(4);
    expect(result.current.pageSize).toBe(10);
  });
});
