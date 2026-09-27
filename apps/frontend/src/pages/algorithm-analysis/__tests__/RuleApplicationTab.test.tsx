import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RuleApplicationTab } from '../RuleApplicationTab';
import type { AlgorithmAnalysisDeps, RuleApplicationState } from '../types';

// 测试环境下 usePermissions 默认返回 loading/无权限 → PermissionButton 渲染 disabled 按钮，
// fireEvent.click 不触发 onClick。此处注入 isSuperAdmin:true 使按钮真实可点击。
vi.mock('../../../hooks', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    usePermissions: () => ({
      permissions: [],
      roles: [],
      isLoading: false,
      error: null,
      adminInfo: null,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      isSuperAdmin: true,
      isAdmin: false,
      reload: () => {},
    }),
  };
});

const noop = vi.fn();

const statsData: RuleApplicationState = {
  scoreDistributionStats: {
    success: true,
    total_students: 30,
    distribution: { excellent: 0.1, good: 0.3, medium: 0.4, low: 0.2 },
    counts: { excellent: 3, good: 9, medium: 12, low: 6 },
    statistics: { avg: 75, std: 5, min: 40, max: 98 },
  },
  earningRules: [{ behavior_type: 'study', base_score: 5, variance: 2, description: '学习打卡' }],
  spendingRules: [
    { spending_type: 'phone', base_cost: 10, min_score: 50, description: '手机使用' },
  ],
  rewardTypes: [
    { type: 'rank1', name: '排名奖励', cost: 20, min_rank: 1, description: '周排名第一' },
  ],
  students: [{ id: 1, name: '张三', class_name: '一班' }],
};

const baseDeps = {
  ruleApplicationData: statsData,
  selectedUserId: null as number | null,
  selectedBehaviorType: '',
  handleAdjustDistribution: noop,
  handleApplyRule: noop,
  setSelectedUserId: noop,
  setSelectedBehaviorType: noop,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<RuleApplicationTab deps={deps} />);
}

describe('RuleApplicationTab', () => {
  it('stats.success=true：渲染学生总数 / 平均分 / 四档分布', () => {
    renderWith();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('3人 (10.0%)')).toBeInTheDocument();
    expect(screen.getByText('9人 (30.0%)')).toBeInTheDocument();
    expect(screen.getByText('12人 (40.0%)')).toBeInTheDocument();
    expect(screen.getByText('6人 (20.0%)')).toBeInTheDocument();
    expect(screen.queryByText('暂无评分分布数据')).toBeNull();
  });

  it('stats.success=false：显示暂无评分分布数据', () => {
    renderWith({
      ruleApplicationData: { ...statsData, scoreDistributionStats: { success: false } },
    });
    expect(screen.getByText('暂无评分分布数据')).toBeInTheDocument();
  });

  it('积分获取途径列表：+base_score 与波动范围', () => {
    renderWith();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('波动范围: ±2分')).toBeInTheDocument();
    expect(screen.getByText('学习打卡 (+5分)')).toBeInTheDocument();
  });

  it('积分消费渠道列表：-base_cost 与最低积分', () => {
    renderWith();
    expect(screen.getByText('-10')).toBeInTheDocument();
    expect(screen.getByText('最低积分: 50分')).toBeInTheDocument();
  });

  it('奖励类型列表：cost 分与描述', () => {
    renderWith();
    expect(screen.getByText('20分')).toBeInTheDocument();
    expect(screen.getByText('周排名第一')).toBeInTheDocument();
  });

  it('选择学生 select onChange → setSelectedUserId(Number)', () => {
    const setSelectedUserId = vi.fn();
    renderWith({ setSelectedUserId });
    const selects = screen.getAllByRole('combobox');
    const studentSelect = selects[0] as HTMLSelectElement;
    fireEvent.change(studentSelect, { target: { value: '1' } });
    expect(setSelectedUserId).toHaveBeenCalledWith(1);
    fireEvent.change(studentSelect, { target: { value: '' } });
    expect(setSelectedUserId).toHaveBeenCalledWith(null);
  });

  it('行为类型 select onChange → setSelectedBehaviorType', () => {
    const setSelectedBehaviorType = vi.fn();
    renderWith({ setSelectedBehaviorType });
    const selects = screen.getAllByRole('combobox');
    const behaviorSelect = selects[1] as HTMLSelectElement;
    fireEvent.change(behaviorSelect, { target: { value: 'study' } });
    expect(setSelectedBehaviorType).toHaveBeenCalledWith('study');
  });

  it('调整分布按钮点击 → handleAdjustDistribution', () => {
    const handleAdjustDistribution = vi.fn();
    renderWith({ handleAdjustDistribution });
    fireEvent.click(screen.getByText('调整分布'));
    expect(handleAdjustDistribution).toHaveBeenCalled();
  });

  it('应用规则按钮：selectedUserId=null 时禁用且不触发', () => {
    const handleApplyRule = vi.fn();
    renderWith({ selectedUserId: null, handleApplyRule });
    const btn = screen.getByText('应用规则').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(handleApplyRule).not.toHaveBeenCalled();
  });

  it('应用规则按钮：selectedUserId 有效时启用并触发', () => {
    const handleApplyRule = vi.fn();
    renderWith({ selectedUserId: 1, handleApplyRule });
    const btn = screen.getByText('应用规则').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(handleApplyRule).toHaveBeenCalled();
  });

  it('applyingRule=true：显示 应用中...', () => {
    renderWith({ ruleApplicationData: { ...statsData, applyingRule: true } });
    expect(screen.getByText('应用中...')).toBeInTheDocument();
  });

  it('applyingResult 渲染 JSON 结果块', () => {
    const { container } = renderWith({
      ruleApplicationData: { ...statsData, applyingResult: { status: 'ok', score: 5 } },
    });
    expect(screen.getByText('应用结果')).toBeInTheDocument();
    expect(container.textContent).toContain('"status": "ok"');
  });
});
