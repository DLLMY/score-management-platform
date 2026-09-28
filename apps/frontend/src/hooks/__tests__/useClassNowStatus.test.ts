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

describe('useClassNowStatus · 补齐分支（B31）', () => {
  it('is_during_class_time=true（无 global_rule）→ blocked=true，label「限制时段」', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus, is_during_class_time: true });
    const { result } = renderHook(() => useClassNowStatus(1, { intervalMs: 100000 }));
    await waitFor(() => expect(result.current.blocked).toBe(true));
    expect(result.current.label).toContain('限制时段');
  });

  it('is_during_class_time=true 且有 global_rule.name → 「全校X，下发已暂停」', async () => {
    mockGetNow.mockResolvedValue({
      ...baseStatus,
      is_during_class_time: true,
      global_rule: { name: '午休' },
    });
    const { result } = renderHook(() => useClassNowStatus(1, { intervalMs: 100000 }));
    await waitFor(() => expect(result.current.label).toContain('全校午休'));
  });

  it('class scope 非上课中且有 period → label「未排课」', async () => {
    mockGetNow.mockResolvedValue({
      ...baseStatus,
      in_session: false,
      period: { period_number: 3, name: '第3节', start: '', end: '' },
    });
    const { result } = renderHook(() =>
      useClassNowStatus(1, { scope: 'class', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.label).toContain('未排课'));
  });

  it('class scope 非上课中且无 period → label「不在上课」', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus, in_session: false });
    const { result } = renderHook(() =>
      useClassNowStatus(1, { scope: 'class', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.label).toContain('不在上课'));
  });

  it('broadcast scope 非上课中（any_in_session=false）→ 最后 return 分支', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus, any_in_session: false });
    const { result } = renderHook(() =>
      useClassNowStatus(undefined, { scope: 'broadcast', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.label).toContain('非上课时间'));
  });

  it('未传 scope 但传 deviceId → scope 默认 class', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus });
    const { result } = renderHook(() =>
      useClassNowStatus(undefined, { deviceId: 'd1', intervalMs: 100000 })
    );
    await waitFor(() => expect(result.current.status).toBeTruthy());
    expect(result.current.blocked).toBe(false);
  });

  it('enabled=false 时 refresh（fetchStatus）直接返回，不拉取', async () => {
    const { result } = renderHook(() => useClassNowStatus(1, { enabled: false }));
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockGetNow).not.toHaveBeenCalled();
  });

  it('竞态：refresh 连续两次，旧 seq 被抢占 early-return', async () => {
    mockGetNow.mockResolvedValue({ ...baseStatus });
    const { result } = renderHook(() => useClassNowStatus(1, { intervalMs: 100000 }));
    await waitFor(() => expect(mockGetNow).toHaveBeenCalledTimes(1));
    mockGetNow.mockClear();
    await act(async () => {
      const p1 = result.current.refresh();
      const p2 = result.current.refresh();
      await Promise.all([p1, p2]);
    });
    // p1 在 setStatus 前因 seq 不等 early-return，p2 正常完成
    expect(mockGetNow).toHaveBeenCalledTimes(2);
  });
});
