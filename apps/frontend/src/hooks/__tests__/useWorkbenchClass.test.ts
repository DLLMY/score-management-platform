import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

async function load() {
  vi.resetModules();
  return (await import('../useWorkbenchClass')) as typeof import('../useWorkbenchClass');
}

describe('useWorkbenchClass', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('ALL_CLASSES 哨兵值为 0', async () => {
    const mod = await load();
    expect(mod.ALL_CLASSES).toBe(0);
  });

  it('readInitial：无 sessionStorage → 0', async () => {
    sessionStorage.clear();
    const mod = await load();
    expect(mod.getWorkbenchClassId()).toBe(0);
  });

  it('readInitial：有效值 → 读取', async () => {
    sessionStorage.setItem('workbench.currentClassId', '7');
    const mod = await load();
    expect(mod.getWorkbenchClassId()).toBe(7);
  });

  it('readInitial：损坏值 → 降级 0', async () => {
    sessionStorage.setItem('workbench.currentClassId', 'abc');
    const mod = await load();
    expect(mod.getWorkbenchClassId()).toBe(0);
  });

  it('setWorkbenchClassId：有效值写入并通知 hook', async () => {
    const mod = await load();
    const { result } = renderHook(() => mod.useWorkbenchClass());
    expect(result.current[0]).toBe(0);
    act(() => {
      result.current[1](5);
    });
    expect(result.current[0]).toBe(5);
    expect(mod.getWorkbenchClassId()).toBe(5);
    expect(sessionStorage.getItem('workbench.currentClassId')).toBe('5');
  });

  it('setWorkbenchClassId：无效值降级为 0 并移除存储', async () => {
    sessionStorage.setItem('workbench.currentClassId', '5');
    const mod = await load();
    act(() => {
      mod.setWorkbenchClassId(-3);
    });
    expect(mod.getWorkbenchClassId()).toBe(0);
    expect(sessionStorage.getItem('workbench.currentClassId')).toBeNull();
  });

  it('setWorkbenchClassId：相同值早返不重复通知', async () => {
    const mod = await load();
    act(() => {
      mod.setWorkbenchClassId(9);
    });
    expect(mod.getWorkbenchClassId()).toBe(9);
    const { result } = renderHook(() => mod.useWorkbenchClass());
    act(() => {
      result.current[1](9);
    });
    expect(result.current[0]).toBe(9);
  });

  it('useWorkbenchClass：setClassId 双向同步', async () => {
    const mod = await load();
    const { result } = renderHook(() => mod.useWorkbenchClass());
    act(() => {
      result.current[1](3);
    });
    await Promise.resolve();
    expect(result.current[0]).toBe(3);
    expect(mod.getWorkbenchClassId()).toBe(3);
  });
});
