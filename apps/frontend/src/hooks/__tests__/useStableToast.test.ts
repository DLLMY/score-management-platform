import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableToast } from '../useStableToast';

const mockShowToast = vi.fn();
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast, toasts: [], removeToast: vi.fn() }),
}));

describe('useStableToast', () => {
  it('stableShowToast 调用底层 showToast', () => {
    const { result } = renderHook(() => useStableToast());
    result.current.showToast('error', 'msg');
    expect(mockShowToast).toHaveBeenCalledWith('error', 'msg', undefined);
  });

  it('返回的 showToast 引用稳定（不随渲染变化）', () => {
    const { result, rerender } = renderHook(() => useStableToast());
    const first = result.current.showToast;
    rerender();
    expect(result.current.showToast).toBe(first);
  });

  it('带 options 透传', () => {
    const { result } = renderHook(() => useStableToast());
    const opts = { undoAction: vi.fn(), undoLabel: '撤销' };
    result.current.showToast('success', 'done', opts);
    expect(mockShowToast).toHaveBeenCalledWith('success', 'done', opts);
  });
});
