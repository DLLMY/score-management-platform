import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import StudentPortal from './StudentPortal';
import api from '../services/api';
import { useListFetch } from '../hooks';

// ── mock 子组件/依赖，隔离 StudentPortal 自身逻辑分支 ──
var capturedProps: any = {};

vi.mock('./studentPortal/StudentPortalView', () => ({
  default: (props: any) => {
    capturedProps = props;
    return <div data-testid='sp-view' data-tab={props.tab} />;
  },
}));

vi.mock('../services/api', () => ({
  default: {
    student: {
      getMyRank: vi.fn(),
      getRecords: vi.fn(),
      getScore: vi.fn(),
      getNotifications: vi.fn(),
      getLeaves: vi.fn(),
      getInsights: vi.fn(),
      applyLeave: vi.fn(),
      requestPhoneboxUnlock: vi.fn(),
    },
  },
}));

var mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

var mockShowToast = vi.fn();
vi.mock('../hooks', () => ({
  useListFetch: vi.fn(() => ({
    items: [],
    loading: false,
    error: null,
    total: 0,
    refetch: vi.fn(),
  })),
  useStableToast: vi.fn(() => ({ showToast: mockShowToast })),
}));

const studentApi = api.student as unknown as Record<string, ReturnType<typeof vi.fn>>;

function setListFetch(items: any[] = []) {
  vi.mocked(useListFetch).mockReturnValue({
    items,
    loading: false,
    error: null,
    total: items.length,
    refetch: vi.fn(),
  } as any);
}

describe('StudentPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProps = {};
    window.localStorage.clear();
    setListFetch([]);
    // 默认网络响应
    studentApi.getScore.mockResolvedValue({ current_score: 80 });
    studentApi.getMyRank.mockResolvedValue({ rank: 1, total: 30 });
    studentApi.getRecords.mockResolvedValue({ data: [], pagination: { total: 0 } });
    studentApi.getNotifications.mockResolvedValue({ data: [], pagination: { total: 0 } });
    studentApi.getLeaves.mockResolvedValue([]);
    studentApi.getInsights.mockResolvedValue({ insights: [], summary: '' });
    studentApi.applyLeave.mockResolvedValue({ id: 1 });
    studentApi.requestPhoneboxUnlock.mockResolvedValue({ success: true, message: 'ok' });
  });

  it('初始渲染 tab=score 触发 loadScore 并写入 score', async () => {
    render(<StudentPortal />);
    expect(studentApi.getScore).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(capturedProps.score).toBe(80));
  });

  it('mount 读取 localStorage student 成功解析', async () => {
    const info = { id: 1, name: '李四', student_number: 'S001' };
    window.localStorage.setItem('student', JSON.stringify(info));
    render(<StudentPortal />);
    await waitFor(() => expect(capturedProps.student).toEqual(info));
  });

  it('mount 读取 localStorage student 无效 JSON 不崩溃', async () => {
    window.localStorage.setItem('student', '{bad json');
    render(<StudentPortal />);
    await waitFor(() => expect(capturedProps.score).toBe(80));
  });

  it('切换 tab 触发对应 loader（leaves/rank/growth/notifications）', async () => {
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());

    await act(async () => {
      capturedProps.setTab('leaves');
    });
    await waitFor(() => expect(studentApi.getLeaves).toHaveBeenCalledTimes(1));

    await act(async () => {
      capturedProps.setTab('rank');
    });
    await waitFor(() => expect(studentApi.getMyRank).toHaveBeenCalledTimes(1));

    await act(async () => {
      capturedProps.setTab('growth');
    });
    await waitFor(() => expect(studentApi.getInsights).toHaveBeenCalledTimes(1));

    await act(async () => {
      capturedProps.setTab('notifications');
    });
    // 通知走 useListFetch(enabled)，不触发真实 fetch；仅校验 tab 传递
    await waitFor(() => expect(capturedProps.tab).toBe('notifications'));
  });

  it('submitLeave 缺日期校验失败，不调用 applyLeave', async () => {
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    await act(async () => {
      capturedProps.submitLeave();
    });
    expect(studentApi.applyLeave).not.toHaveBeenCalled();
    expect(capturedProps.error).toBe('请填写开始与结束日期');
  });

  it('submitLeave 成功：调用 applyLeave + loadLeaves + showToast', async () => {
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    await act(async () => {
      capturedProps.setLeaveForm({
        leave_type: 'personal',
        start_date: '2026-01-01',
        end_date: '2026-01-02',
        reason: '病假',
      });
    });
    await act(async () => {
      capturedProps.submitLeave();
    });
    await waitFor(() => expect(studentApi.applyLeave).toHaveBeenCalledTimes(1));
    expect(studentApi.getLeaves).toHaveBeenCalledTimes(1); // 成功路径 loadLeaves 触发一次
    expect(mockShowToast).toHaveBeenCalledWith('success', '请假申请已提交');
  });

  it('submitLeave 失败（Error 消息）写入 error', async () => {
    studentApi.applyLeave.mockRejectedValue(new Error('提交被拒'));
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    await act(async () => {
      capturedProps.setLeaveForm({
        leave_type: 'personal',
        start_date: '2026-01-01',
        end_date: '2026-01-02',
        reason: '病假',
      });
    });
    await act(async () => {
      capturedProps.submitLeave();
    });
    await waitFor(() => expect(capturedProps.error).toBe('提交被拒'));
  });

  it('submitLeave 失败（非 Error，走兜底文案）', async () => {
    studentApi.applyLeave.mockRejectedValue('网络异常');
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    await act(async () => {
      capturedProps.setLeaveForm({
        leave_type: 'personal',
        start_date: '2026-01-01',
        end_date: '2026-01-02',
        reason: '病假',
      });
    });
    await act(async () => {
      capturedProps.submitLeave();
    });
    await waitFor(() => expect(capturedProps.error).toBe('提交失败'));
  });

  it('requestUnlock 成功写入 unlockRes', async () => {
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    await act(async () => {
      capturedProps.requestUnlock();
    });
    await waitFor(() => expect(capturedProps.unlockRes).toEqual({ success: true, message: 'ok' }));
  });

  it('requestUnlock 失败（非 Error 兜底文案）', async () => {
    studentApi.requestPhoneboxUnlock.mockRejectedValue('超时');
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    await act(async () => {
      capturedProps.requestUnlock();
    });
    await waitFor(() => expect(capturedProps.error).toBe('申请失败'));
  });

  it('handleLogout 清除 localStorage 并跳转', async () => {
    window.localStorage.setItem('student_token', 'tk');
    window.localStorage.setItem('student', '{}');
    render(<StudentPortal />);
    await waitFor(() => expect(studentApi.getScore).toHaveBeenCalled());
    act(() => {
      capturedProps.handleLogout();
    });
    expect(window.localStorage.getItem('student_token')).toBeNull();
    expect(window.localStorage.getItem('student')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/student/login', { replace: true });
  });

  it('totalChange 按 score_change 累加', async () => {
    setListFetch([{ score_change: 5 }, { score_change: 3 }, { score_change: -2 }]);
    render(<StudentPortal />);
    await waitFor(() => expect(capturedProps.totalChange).toBe(6));
  });

  it('getScore 失败（Error 消息 / 非 Error 兜底）', async () => {
    studentApi.getScore.mockRejectedValue(new Error('加载失败x'));
    render(<StudentPortal />);
    await waitFor(() => expect(capturedProps.error).toBe('加载失败x'));
  });

  it('getScore 失败（非 Error 兜底 loading 文案）', async () => {
    studentApi.getScore.mockRejectedValue('boom');
    render(<StudentPortal />);
    await waitFor(() => expect(capturedProps.error).toBe('加载失败'));
  });
});
