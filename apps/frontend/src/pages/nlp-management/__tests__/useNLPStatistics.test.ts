import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNLPStatistics } from '../hooks/useNLPStatistics';

const { getRuleStatistics } = vi.hoisted(() => ({ getRuleStatistics: vi.fn() }));

vi.mock('../../../services/api', () => ({
  default: {
    nlp: {
      getRuleStatistics: (...args: any[]) => getRuleStatistics(...args),
    },
  },
}));

describe('useNLPStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with null statistics', () => {
    const { result } = renderHook(() => useNLPStatistics({ showToast: vi.fn() }));
    expect(result.current.statistics).toBeNull();
  });

  it('sets statistics on a successful fetch', async () => {
    getRuleStatistics.mockResolvedValue({ total: 10 });
    const { result } = renderHook(() => useNLPStatistics({ showToast: vi.fn() }));

    await act(async () => {
      await result.current.fetchStatistics();
    });

    expect(getRuleStatistics).toHaveBeenCalled();
    expect(result.current.statistics).toEqual({ total: 10 });
  });

  it('shows a toast on fetch failure', async () => {
    getRuleStatistics.mockRejectedValue(new Error('boom'));
    const showToast = vi.fn();
    const { result } = renderHook(() => useNLPStatistics({ showToast }));

    await act(async () => {
      await result.current.fetchStatistics();
    });

    expect(showToast).toHaveBeenCalledWith('error', '获取统计数据失败');
  });
});
