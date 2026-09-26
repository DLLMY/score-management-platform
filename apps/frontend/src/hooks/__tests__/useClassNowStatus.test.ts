import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useClassNowStatus } from '../useClassNowStatus';

const { mockGetNow } = vi.hoisted(() => ({ mockGetNow: vi.fn() }));

beforeEach(() => {
  mockGetNow.mockClear();
});

vi.mock('../../services/api', () => ({
  default: {
    courseSchedules: {
      getNow: (...args: unknown[]) => mockGetNow(...args),
    },
  },
  getAuthHeaders: vi.fn(() => ({})),
}));

const baseStatus = {
  is_during_class_time: false,
  global_rule: null,
  period: null,
  in_session: false,
  any_in_session: false,
  class_info_id: 1,
  class_name: '',
  subject_name: '',
  now: '',
};

describe('useClassNowStatus', () => {
  it('class scope：上课中 → blocked=true，label 含「上课中」', async () => {
    mockGetNow.mockResolvedValue({
      ...baseStatus,
      in_session: true,
      class_name: '高一(3)班',
      subject_name: '数学',
      period: { period_number: 3, name: '第3节', start: '', end: '' },
    });
    const { result } = renderHook(() =>
      useClassNowStatus(1, { scope: 'class', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.status).toMatchObject({ in_session: true }));
    expect(result.current.blocked).toBe(true);
    expect(result.current.label).toContain('上课中');
  });

  it('broadcast scope：任意班级上课 → blocked=true', async () => {
    mockGetNow.mockResolvedValue({
      ...baseStatus,
      any_in_session: true,
      period: { period_number: 2, name: '第2节', start: '', end: '' },
    });
    const { result } = renderHook(() =>
      useClassNowStatus(undefined, { scope: 'broadcast', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.status).toBeTruthy());
    expect(result.current.blocked).toBe(true);
    expect(result.current.label).toContain('正在上课');
  });

  it('global scope：非上课时段 → blocked=false', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus });
    const { result } = renderHook(() =>
      useClassNowStatus(1, { scope: 'global', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.status).toBeTruthy());
    expect(result.current.blocked).toBe(false);
  });

  it('拉取失败 → error，blocked=false，label 置灰', async () => {
    mockGetNow.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useClassNowStatus(1, { intervalMs: 100000 }));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.blocked).toBe(false);
    expect(result.current.label).toBe('上课状态未知');
  });

  it('enabled=false → 不拉取，loading=false，label 空', async () => {
    const { result } = renderHook(() => useClassNowStatus(1, { enabled: false }));
    expect(result.current.loading).toBe(false);
    expect(result.current.label).toBe('');
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGetNow).not.toHaveBeenCalled();
  });

  it('refresh 手动立即刷新', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus });
    const { result } = renderHook(() => useClassNowStatus(1, { intervalMs: 100000 }));
    await waitFor(() => expect(result.current.status).toBeTruthy());
    expect(mockGetNow).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockGetNow).toHaveBeenCalledTimes(2);
  });
});
