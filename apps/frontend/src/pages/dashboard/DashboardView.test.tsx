import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DashboardState } from './useDashboardLogic';
import type { DashboardViewProps } from './types';
import DashboardView from './DashboardView';

// 本地子组件：纯展示桩，回显关键字段便于断言
vi.mock('./components', () => ({
  StatCard: ({ label, value }: { label: string; value: number | string }) => (
    <div data-testid='stat'>
      {label}:{String(value)}
    </div>
  ),
  UserCard: ({ user }: { user: { id: number } }) => <div>U:{user.id}</div>,
  DeviceCard: ({ device }: { device: { id: number } }) => <div>D:{device.id}</div>,
  LiveClock: () => <span>LIVE</span>,
}));

// 全局 barrel 中的 DashboardSkeleton（仅 loading 分支使用）
vi.mock('../../components', () => ({
  DashboardSkeleton: () => <div>SKEL</div>,
}));

type AnyObj = Record<string, unknown>;

function makeState(overrides: AnyObj = {}): DashboardState {
  const base: AnyObj = {
    users: [],
    records: [],
    devices: [],
    notifications: [],
    statistics: {
      totalUsers: 100,
      totalRecords: 200,
      totalScore: 300,
      onlineDevices: 4,
    },
    algorithmData: {
      statistics: {
        student_count: 10,
        cluster_count: 3,
      } as unknown as DashboardState['algorithmData']['statistics'],
      clusters: null,
      warnings: { total_risk_count: 5 } as unknown as DashboardState['algorithmData']['warnings'],
    },
    loading: false,
    isRefreshing: false,
    lastUpdateTime: null,
    showUpdateIndicator: false,
  };
  return { ...base, ...overrides } as unknown as DashboardState;
}

function makeProps(overrides: AnyObj = {}): DashboardViewProps {
  const base: AnyObj = {
    state: makeState(),
    selectedClass: '',
    setSelectedClass: vi.fn(),
    classes: ['一班', '二班'],
    isConnected: true,
    handleRefresh: vi.fn(),
    dashboardError: false,
    filteredUsers: [],
    classGroups: [],
  };
  return { ...base, ...overrides } as unknown as DashboardViewProps;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardView', () => {
  it('loading=true → 渲染 DashboardSkeleton 骨架', () => {
    const props = makeProps({ state: makeState({ loading: true }) });
    render(<DashboardView {...props} />);
    expect(screen.getByText('SKEL')).toBeInTheDocument();
  });

  it('正常数据态：四张统计卡 + 实时时钟 + 连接态', () => {
    render(<DashboardView {...makeProps()} />);
    expect(screen.getByText('总用户数:100')).toBeInTheDocument();
    expect(screen.getByText('今日记录:200')).toBeInTheDocument();
    expect(screen.getByText('总积分:300')).toBeInTheDocument();
    expect(screen.getByText('在线设备:4')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('实时连接')).toBeInTheDocument();
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
  });

  it('lastUpdateTime 缺省 → 显示 — 占位', () => {
    render(<DashboardView {...makeProps({ state: makeState({ lastUpdateTime: null }) })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('lastUpdateTime 存在 → 调用 formatDate 渲染时间', () => {
    render(
      <DashboardView
        {...makeProps({ state: makeState({ lastUpdateTime: new Date('2026-09-29T10:00:00') }) })}
      />
    );
    // 非 — 占位（formatDate 真实输出一段日期文本）
    expect(screen.queryByText('—')).toBeNull();
  });

  it('isConnected=false → 显示连接断开 + 红色样式', () => {
    render(<DashboardView {...makeProps({ isConnected: false })} />);
    expect(screen.getByText('连接断开')).toBeInTheDocument();
    expect(screen.queryByText('实时连接')).toBeNull();
  });

  it('isRefreshing=true → 刷新按钮 disabled 且 aria-busy', () => {
    render(<DashboardView {...makeProps({ state: makeState({ isRefreshing: true }) })} />);
    const btn = screen.getByRole('button', { name: /刷新/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('dashboardError=true → 渲染错误提示条', () => {
    render(<DashboardView {...makeProps({ dashboardError: true })} />);
    expect(screen.getByText(/部分统计数据加载失败/)).toBeInTheDocument();
  });

  it('筛选班级 select 变更 → 触发 setSelectedClass', () => {
    const props = makeProps();
    render(<DashboardView {...props} />);
    const select = screen.getByLabelText('筛选班级') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '一班' } });
    expect(props.setSelectedClass).toHaveBeenCalledWith('一班');
  });

  it('filteredUsers 有数据 → 渲染 UserCard', () => {
    render(<DashboardView {...makeProps({ filteredUsers: [{ id: 1, name: '张三' }] })} />);
    expect(screen.getByText('U:1')).toBeInTheDocument();
    expect(screen.queryByText('暂无用户数据')).toBeNull();
  });

  it('filteredUsers 为空 → 显示暂无用户数据', () => {
    render(<DashboardView {...makeProps({ filteredUsers: [] })} />);
    expect(screen.getByText('暂无用户数据')).toBeInTheDocument();
  });

  it('devices 有数据 / 为空 → DeviceCard 或 暂无设备', () => {
    const { rerender } = render(
      <DashboardView {...makeProps({ state: makeState({ devices: [{ id: 9 }] }) })} />
    );
    expect(screen.getByText('D:9')).toBeInTheDocument();
    rerender(<DashboardView {...makeProps({ state: makeState({ devices: [] }) })} />);
    expect(screen.getByText('暂无设备')).toBeInTheDocument();
  });

  it('notifications 优先级三元：high/urgent→红, medium→黄, 其它→绿', () => {
    const notes = [
      { id: 1, title: 'h', content: 'c', priority: 'high', created_at: '2026-09-29T10:00:00' },
      { id: 2, title: 'u', content: 'c', priority: 'urgent', created_at: '2026-09-29T10:00:00' },
      { id: 3, title: 'm', content: 'c', priority: 'medium', created_at: '2026-09-29T10:00:00' },
      { id: 4, title: 'l', content: 'c', priority: 'low', created_at: '2026-09-29T10:00:00' },
    ];
    render(
      <DashboardView
        {...makeProps({
          state: makeState({ notifications: notes as unknown as DashboardState['notifications'] }),
        })}
      />
    );
    expect(screen.getByText('h')).toBeInTheDocument();
    expect(screen.getByText('u')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
    expect(screen.getByText('l')).toBeInTheDocument();
    expect(screen.queryByText('暂无通知')).toBeNull();
  });

  it('notifications 为空 → 显示暂无通知', () => {
    render(<DashboardView {...makeProps({ state: makeState({ notifications: [] }) })} />);
    expect(screen.getByText('暂无通知')).toBeInTheDocument();
  });

  it('algorithmData.statistics 存在 → 渲染分析学生/聚类/风险', () => {
    render(<DashboardView {...makeProps()} />);
    expect(screen.getByText('10')).toBeInTheDocument(); // student_count
    expect(screen.getByText('3')).toBeInTheDocument(); // cluster_count
    expect(screen.getByText('5')).toBeInTheDocument(); // total_risk_count
    expect(screen.queryByText('暂无算法数据（统计接口未返回结果）')).toBeNull();
  });

  it('algorithmData.statistics 为 null → 显示暂无算法数据', () => {
    render(
      <DashboardView
        {...makeProps({
          state: makeState({ algorithmData: { statistics: null, clusters: null, warnings: null } }),
        })}
      />
    );
    expect(screen.getByText('暂无算法数据（统计接口未返回结果）')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // warnings null → 风险预警 —
  });

  it('classGroups 有数据 / 为空 → 分组列表 或 暂无班级数据', () => {
    const groups = [
      { class_name: '一班', students: [{ id: 1 }] },
    ] as unknown as DashboardViewProps['classGroups'];
    const { rerender } = render(<DashboardView {...makeProps({ classGroups: groups })} />);
    expect(screen.getByText('一班', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/1 人/)).toBeInTheDocument();
    rerender(<DashboardView {...makeProps({ classGroups: [] })} />);
    expect(screen.getByText('暂无班级数据')).toBeInTheDocument();
  });
});
