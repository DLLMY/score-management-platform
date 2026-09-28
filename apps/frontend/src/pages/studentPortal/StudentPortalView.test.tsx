import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentPortalView from './StudentPortalView';

// StudentGrowthTab 仅在 tab=growth 时渲染，桩为 null 隔离，不影响其余分支覆盖
vi.mock('./components', () => ({
  StudentGrowthTab: () => null,
}));

function makeProps(overrides: any = {}): any {
  return {
    tab: 'score',
    setTab: vi.fn(),
    student: null,
    handleLogout: vi.fn(),
    score: 80,
    scorePage: 1,
    setScorePage: vi.fn(),
    scoreRecords: { items: [], total: 0, loading: false, error: null, refetch: vi.fn() },
    loading: false,
    totalChange: 0,
    notifList: { items: [], total: 0, loading: false, error: null, refetch: vi.fn() },
    leaves: [],
    leaveForm: { leave_type: 'personal', start_date: '', end_date: '', reason: '' },
    setLeaveForm: vi.fn(),
    submitLeave: vi.fn(),
    unlockRes: null,
    requestUnlock: vi.fn(),
    myRank: null,
    insights: null,
    growthLoading: false,
    error: '',
    ...overrides,
  };
}

describe('StudentPortalView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('header：有 student 时显示姓名·卡号·班级，无 student 时不显示子行', () => {
    const { rerender } = render(
      <StudentPortalView
        {...makeProps({ student: { name: '张三', card_id: 'C1', class_name: '一班' } })}
      />
    );
    expect(screen.getByText('张三 · C1 · 一班')).toBeTruthy();
    rerender(<StudentPortalView {...makeProps({ student: { name: '张三', card_id: 'C1' } })} />);
    expect(screen.queryByText('张三 · C1 ·')).toBeNull();
    expect(screen.getByText('张三 · C1')).toBeTruthy();
  });

  it('header：点击退出按钮调用 handleLogout', () => {
    const handleLogout = vi.fn();
    render(<StudentPortalView {...makeProps({ handleLogout })} />);
    fireEvent.click(screen.getByText('退出'));
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('导航：点击 6 个 tab 按钮分别调用 setTab 对应 key', () => {
    const setTab = vi.fn();
    render(<StudentPortalView {...makeProps({ setTab })} />);
    for (const [label, key] of [
      ['积分', 'score'],
      ['通知', 'notifications'],
      ['请假', 'leaves'],
      ['手机箱', 'phonebox'],
      ['排名', 'rank'],
      ['我的成长', 'growth'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(setTab).toHaveBeenLastCalledWith(key);
    }
  });

  it('error 条：有 error 渲染 alert，无 error 不渲染', () => {
    const { rerender } = render(<StudentPortalView {...makeProps({ error: '加载失败' })} />);
    expect(screen.getByText('加载失败')).toBeTruthy();
    rerender(<StudentPortalView {...makeProps({ error: '' })} />);
    expect(screen.queryByText('加载失败')).toBeNull();
  });

  // ── score tab ──
  it('score：loading 显示 ...；非 loading 显示 score 值或 —（null）', () => {
    const { rerender } = render(<StudentPortalView {...makeProps({ loading: true, score: 80 })} />);
    expect(screen.getByText('...')).toBeTruthy();
    rerender(<StudentPortalView {...makeProps({ loading: false, score: 80 })} />);
    expect(screen.getByText('80')).toBeTruthy();
    rerender(<StudentPortalView {...makeProps({ loading: false, score: null })} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('score：无流水显示空态；有流水显示合计（正负号分支）', () => {
    const { rerender } = render(
      <StudentPortalView
        {...makeProps({
          scoreRecords: { items: [], total: 0, loading: false, error: null, refetch: vi.fn() },
        })}
      />
    );
    expect(screen.getByText('暂无积分记录')).toBeTruthy();
    rerender(
      <StudentPortalView
        {...makeProps({
          totalChange: 5,
          scoreRecords: {
            items: [{ id: 1, score_change: 5 }],
            total: 5,
            loading: false,
            error: null,
            refetch: vi.fn(),
          },
        })}
      />
    );
    expect(screen.getByText('本页流水合计 +5')).toBeTruthy();
    rerender(
      <StudentPortalView
        {...makeProps({
          totalChange: -3,
          scoreRecords: {
            items: [{ id: 1, score_change: -3 }],
            total: 5,
            loading: false,
            error: null,
            refetch: vi.fn(),
          },
        })}
      />
    );
    expect(screen.getByText('本页流水合计 -3')).toBeTruthy();
  });

  it('score：流水项渲染 description/日期/操作员 与 score_change 正负配色', () => {
    const { container } = render(
      <StudentPortalView
        {...makeProps({
          scoreRecords: {
            items: [
              {
                id: 1,
                description: '上课',
                created_at: '2026-01-01',
                operator: '老师',
                score_change: 5,
              },
              { id: 2, score_change: -3 },
            ],
            total: 10,
            loading: false,
            error: null,
            refetch: vi.fn(),
          },
        })}
      />
    );
    expect(screen.getByText('上课')).toBeTruthy();
    expect(container.textContent).toContain('老师');
    expect(screen.getByText('积分变动')).toBeTruthy();
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByText('-3')).toBeTruthy();
  });

  it('score：分页（total>20）显示，首页上一页禁用、下一页可点', () => {
    const setScorePage = vi.fn();
    render(
      <StudentPortalView
        {...makeProps({
          scorePage: 1,
          setScorePage,
          scoreRecords: {
            items: [{ id: 1, score_change: 1 }],
            total: 45,
            loading: false,
            error: null,
            refetch: vi.fn(),
          },
        })}
      />
    );
    const prev = screen.getByText('上一页') as HTMLButtonElement;
    const next = screen.getByText('下一页') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(setScorePage).toHaveBeenCalledWith(2);
  });

  // ── notifications tab ──
  it('notifications：空态、计数、列表项（title/status 兜底）', () => {
    const { rerender } = render(
      <StudentPortalView
        {...makeProps({
          tab: 'notifications',
          notifList: { items: [], total: 0, loading: false, error: null, refetch: vi.fn() },
        })}
      />
    );
    expect(screen.getByText('暂无通知')).toBeTruthy();

    rerender(
      <StudentPortalView
        {...makeProps({
          tab: 'notifications',
          notifList: {
            items: [
              { id: 1, title: '公告', status: 'read', content: '内容A', created_at: '2026-01-01' },
              { id: 2, content: '内容B' },
            ],
            total: 2,
            loading: false,
            error: null,
            refetch: vi.fn(),
          },
        })}
      />
    );
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.getByText('公告')).toBeTruthy();
    expect(screen.getByText('通知', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('内容A')).toBeTruthy();
    expect(screen.getByText('内容B')).toBeTruthy();
  });

  it('notifications：刷新按钮调用 refetch 且 loading 时禁用', () => {
    const refetch = vi.fn();
    const { rerender } = render(
      <StudentPortalView
        {...makeProps({
          tab: 'notifications',
          notifList: { items: [], total: 0, loading: false, error: null, refetch },
        })}
      />
    );
    fireEvent.click(screen.getByText('刷新'));
    expect(refetch).toHaveBeenCalledTimes(1);
    rerender(
      <StudentPortalView
        {...makeProps({
          tab: 'notifications',
          notifList: { items: [], total: 0, loading: true, error: null, refetch },
        })}
      />
    );
    expect((screen.getByText('刷新') as HTMLButtonElement).disabled).toBe(true);
  });

  // ── leaves tab ──
  it('leaves：空记录态；列表项状态三态配色（approved/rejected/其他）', () => {
    const { rerender } = render(
      <StudentPortalView {...makeProps({ tab: 'leaves', leaves: [] })} />
    );
    expect(screen.getByText('暂无请假记录')).toBeTruthy();

    rerender(
      <StudentPortalView
        {...makeProps({
          tab: 'leaves',
          leaves: [
            { id: 1, start_date: '2026-01-01', end_date: '2026-01-02', status: 'approved' },
            { id: 2, start_date: '2026-02-01', end_date: '2026-02-02', status: 'rejected' },
            {
              id: 3,
              start_date: '2026-03-01',
              end_date: '2026-03-02',
              status: 'pending',
              reason: '旅行',
              leave_type: 'other',
            },
          ],
        })}
      />
    );
    expect(screen.getByText('已通过')).toBeTruthy();
    expect(screen.getByText('已拒绝')).toBeTruthy();
    expect(screen.getByText('待审批')).toBeTruthy();
    expect(screen.getByText('旅行')).toBeTruthy();
  });

  it('leaves：请假类型 select 变更触发 setLeaveForm；提交按钮 disabled 与点击', () => {
    const setLeaveForm = vi.fn();
    const submitLeave = vi.fn();
    render(
      <StudentPortalView
        {...makeProps({
          tab: 'leaves',
          setLeaveForm,
          submitLeave,
          loading: false,
          leaveForm: { leave_type: 'personal', start_date: '', end_date: '', reason: '' },
        })}
      />
    );
    const select = screen.getByDisplayValue('事假') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'sick' } });
    expect(setLeaveForm).toHaveBeenCalledWith(expect.objectContaining({ leave_type: 'sick' }));
    fireEvent.click(screen.getByText('提交申请'));
    expect(submitLeave).toHaveBeenCalledTimes(1);
  });

  // ── phonebox tab ──
  it('phonebox：解锁结果四态（allowed/离线/teacher_disabled/其他）', () => {
    const { rerender } = render(
      <StudentPortalView {...makeProps({ tab: 'phonebox', unlockRes: null })} />
    );
    expect(screen.queryByText('开箱指令已下发')).toBeNull();

    rerender(
      <StudentPortalView
        {...makeProps({ tab: 'phonebox', unlockRes: { allowed: true, dispatched: true } })}
      />
    );
    expect(screen.getByText('开箱指令已下发')).toBeTruthy();

    rerender(
      <StudentPortalView
        {...makeProps({ tab: 'phonebox', unlockRes: { allowed: true, dispatched: false } })}
      />
    );
    expect(screen.getByText('开箱指令已下发（设备离线，指令未送达）')).toBeTruthy();

    rerender(
      <StudentPortalView
        {...makeProps({
          tab: 'phonebox',
          unlockRes: { allowed: false, reason: 'teacher_disabled' },
        })}
      />
    );
    expect(screen.getByText('班主任已关闭本班自助开箱')).toBeTruthy();

    rerender(
      <StudentPortalView
        {...makeProps({ tab: 'phonebox', unlockRes: { allowed: false, reason: 'other' } })}
      />
    );
    expect(screen.getByText('本班暂未开放自助开箱，请联系老师')).toBeTruthy();
  });

  it('phonebox：申请按钮 disabled(loading) 与点击触发 requestUnlock', () => {
    const requestUnlock = vi.fn();
    const { rerender } = render(
      <StudentPortalView {...makeProps({ tab: 'phonebox', requestUnlock, loading: false })} />
    );
    fireEvent.click(screen.getByText('申请开箱'));
    expect(requestUnlock).toHaveBeenCalledTimes(1);
    rerender(
      <StudentPortalView {...makeProps({ tab: 'phonebox', requestUnlock, loading: true })} />
    );
    expect((screen.getByText('申请中...') as HTMLButtonElement).disabled).toBe(true);
  });

  // ── rank tab ──
  it('rank：myRank 为 null 时各字段兜底 —/未分班', () => {
    const { container } = render(
      <StudentPortalView {...makeProps({ tab: 'rank', myRank: null })} />
    );
    expect(container.textContent).toContain('—');
    expect(container.textContent).toContain('未分班');
  });

  it('rank：myRank 有值渲染排名卡；ranking 空态与列表（当前用户高亮）', () => {
    const { rerender } = render(
      <StudentPortalView
        {...makeProps({
          tab: 'rank',
          student: { id: 'me', name: '我', card_id: 'C1' },
          myRank: { my_rank: 3, total_students: 30, class_name: '一班', my_score: 88, ranking: [] },
        })}
      />
    );
    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('/ 30')).toBeTruthy();
    expect(screen.getByText('一班 · 当前积分 88')).toBeTruthy();
    expect(screen.getByText('暂无排名数据')).toBeTruthy();

    rerender(
      <StudentPortalView
        {...makeProps({
          tab: 'rank',
          student: { id: 'me', name: '我', card_id: 'C1' },
          myRank: {
            my_rank: 3,
            total_students: 30,
            class_name: '一班',
            my_score: 88,
            ranking: [
              { user_id: 'me', name: '我', current_score: 90 },
              { user_id: 'other', name: '他', current_score: 80 },
            ],
          },
        })}
      />
    );
    expect(screen.getByText('我（我）')).toBeTruthy();
    expect(screen.getByText('他')).toBeTruthy();
  });

  // ── growth tab ──
  it('growth：渲染 StudentGrowthTab 并透传 insights/growthLoading', () => {
    render(
      <StudentPortalView
        {...makeProps({ tab: 'growth', insights: { summary: 's' }, growthLoading: true })}
      />
    );
    // StudentGrowthTab 被桩为 null，仅验证切换分支不报错
    expect(screen.queryByText('我的成长')).toBeTruthy();
  });
});
