import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useModal } from '../useModal';

describe('useModal', () => {
  it('open/close/toggle/data/updateData 完整流转', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() => useModal<{ id: number }>({ onOpen, onClose }));

    expect(result.current.isOpen).toBe(false);

    act(() => result.current.open({ id: 1 }));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: 1 });
    expect(onOpen).toHaveBeenCalledWith({ id: 1 });

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalled();

    act(() => result.current.open());
    act(() => result.current.updateData({ id: 2 }));
    expect(result.current.data).toEqual({ id: 2 });

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('open 无参数 → data 为 null', () => {
    const { result } = renderHook(() => useModal());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBeNull();
  });
});
