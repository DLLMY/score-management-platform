import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRuleApplicationLogic, type RuleApplicationLogicDeps } from '../useRuleApplicationLogic';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    algorithm: {
      getScoreDistributionStats: vi.fn(),
      getEarningRules: vi.fn(),
      getSpendingRules: vi.fn(),
      getRewardTypes: vi.fn(),
      applyRuleByBehavior: vi.fn(),
      adjustScoreDistribution: vi.fn(),
    },
    users: {
      getAll: vi.fn(),
    },
  },
}));

// __tests__ 比源文件深一级 → mock 路径须多一层 `..`
vi.mock('../../../services/api', () => ({ default: mockApi }));

type ShowToast = RuleApplicationLogicDeps['showToast'];

describe('useRuleApplicationLogic', () => {
  let showToast: ShowToast;

  beforeEach(() => {
    showToast = vi.fn() as unknown as ShowToast;
    Object.values(mockApi.algorithm).forEach((fn) => fn.mockReset());
    mockApi.users.getAll.mockReset();

    mockApi.algorithm.getScoreDistributionStats.mockResolvedValue({ mean: 80 });
    mockApi.algorithm.getEarningRules.mockResolvedValue([{ id: 1 }]);
    mockApi.algorithm.getSpendingRules.mockResolvedValue([{ id: 2 }]);
    mockApi.algorithm.getRewardTypes.mockResolvedValue([{ id: 3 }]);
    mockApi.algorithm.applyRuleByBehavior.mockResolvedValue({ delta: 5 });
    mockApi.algorithm.adjustScoreDistribution.mockResolvedValue({ ok: true });
    mockApi.users.getAll.mockResolvedValue({ users: [] });
  });

  const setup = (initialProps: Partial<RuleApplicationLogicDeps> = {}) =>
    renderHook(
      ({ selectedClass, activeTab }: RuleApplicationLogicDeps) =>
        useRuleApplicationLogic({ showToast, selectedClass, activeTab }),
      {
        initialProps: {
          selectedClass: '',
          activeTab: 'other',
          ...initialProps,
        } as RuleApplicationLogicDeps,
      }
    );

  describe('初始状态', () => {
    it('默认空数据、未选学生、默认行为类型为 attendance', () => {
      const { result } = setup();
      expect(result.current.ruleApplicationData).toEqual({});
      expect(result.current.selectedUserId).toBeNull();
      expect(result.current.selectedBehaviorType).toBe('attendance');
    });
  });

  describe('loadRuleApplicationData', () => {
    it('并发拉取 5 路数据并组装（含学生列表 id 归一）', async () => {
      mockApi.users.getAll.mockResolvedValue({
        users: [
          { id: 1, name: '张三', class_name: '一班' },
          { id: '2', name: '李四' },
        ],
      });
      const { result } = setup({ selectedClass: '3' });

      await act(async () => {
        await result.current.loadRuleApplicationData();
      });

      expect(mockApi.algorithm.getScoreDistributionStats).toHaveBeenCalledWith('3');
      expect(mockApi.algorithm.getEarningRules).toHaveBeenCalled();
      expect(mockApi.algorithm.getSpendingRules).toHaveBeenCalled();
      expect(mockApi.algorithm.getRewardTypes).toHaveBeenCalled();
      expect(mockApi.users.getAll).toHaveBeenCalled();

      expect(result.current.ruleApplicationData).toEqual({
        scoreDistributionStats: { mean: 80 },
        earningRules: [{ id: 1 }],
        spendingRules: [{ id: 2 }],
        rewardTypes: [{ id: 3 }],
        students: [
          { id: 1, name: '张三', class_name: '一班' },
          { id: 2, name: '李四', class_name: '' },
        ],
      });
    });

    it('未选班级时 classroom 参数传 undefined', async () => {
      const { result } = setup({ selectedClass: '' });
      await act(async () => {
        await result.current.loadRuleApplicationData();
      });
      expect(mockApi.algorithm.getScoreDistributionStats).toHaveBeenCalledWith(undefined);
    });

    it('users 返回空 / 缺 users 字段时 students 为空数组', async () => {
      mockApi.users.getAll.mockResolvedValue({});
      const { result } = setup({ selectedClass: '1' });
      await act(async () => {
        await result.current.loadRuleApplicationData();
      });
      expect(result.current.ruleApplicationData.students).toEqual([]);
    });

    it('任意一路失败时提示加载失败', async () => {
      mockApi.algorithm.getEarningRules.mockRejectedValue(new Error('boom'));
      const { result } = setup({ selectedClass: '1' });
      await act(async () => {
        await result.current.loadRuleApplicationData();
      });
      expect(showToast).toHaveBeenCalledWith('error', '加载规则应用数据失败');
    });
  });

  describe('handleApplyRule', () => {
    it('未选学生时提示并直接返回', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleApplyRule();
      });
      expect(showToast).toHaveBeenCalledWith('error', '请选择学生');
      expect(mockApi.algorithm.applyRuleByBehavior).not.toHaveBeenCalled();
    });

    it('成功：写入 applyingResult 并复位 applyingRule', async () => {
      const applied = { delta: 5 };
      mockApi.algorithm.applyRuleByBehavior.mockResolvedValue(applied);
      const { result } = setup();

      act(() => {
        result.current.setSelectedUserId(12);
      });
      await act(async () => {
        await result.current.handleApplyRule();
      });

      expect(mockApi.algorithm.applyRuleByBehavior).toHaveBeenCalledWith(12, 'attendance');
      expect(result.current.ruleApplicationData.applyingRule).toBe(false);
      expect(result.current.ruleApplicationData.applyingResult).toEqual(applied);
      expect(showToast).toHaveBeenCalledWith('success', '规则应用成功');
    });

    it('支持切换行为类型后应用规则', async () => {
      const { result } = setup();
      act(() => {
        result.current.setSelectedUserId(8);
        result.current.setSelectedBehaviorType('homework');
      });
      await act(async () => {
        await result.current.handleApplyRule();
      });
      expect(mockApi.algorithm.applyRuleByBehavior).toHaveBeenCalledWith(8, 'homework');
    });

    it('失败：复位 applyingRule 且保持无 applyingResult', async () => {
      mockApi.algorithm.applyRuleByBehavior.mockRejectedValue(new Error('apply failed'));
      const { result } = setup();
      act(() => {
        result.current.setSelectedUserId(8);
      });
      await act(async () => {
        await result.current.handleApplyRule();
      });
      expect(result.current.ruleApplicationData.applyingRule).toBe(false);
      expect(result.current.ruleApplicationData.applyingResult).toBeUndefined();
      expect(showToast).toHaveBeenCalledWith('error', '规则应用失败');
    });

    it('执行期间 applyingRule 置为 true', async () => {
      let release!: (v: unknown) => void;
      mockApi.algorithm.applyRuleByBehavior.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        })
      );
      const { result } = setup();
      act(() => {
        result.current.setSelectedUserId(8);
      });
      act(() => {
        void result.current.handleApplyRule();
      });
      await waitFor(() => expect(result.current.ruleApplicationData.applyingRule).toBe(true));

      await act(async () => {
        release({ ok: true });
      });
      await waitFor(() => expect(result.current.ruleApplicationData.applyingRule).toBe(false));
    });
  });

  describe('handleAdjustDistribution', () => {
    it('成功：提示成功并重新拉取规则应用数据', async () => {
      const { result } = setup({ selectedClass: '9' });

      // 先拉一次基线（本用例 activeTab 非 ruleApplication，effect 不会自动触发）
      await act(async () => {
        await result.current.loadRuleApplicationData();
      });
      expect(mockApi.users.getAll).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.handleAdjustDistribution();
      });

      expect(mockApi.algorithm.adjustScoreDistribution).toHaveBeenCalledWith('9');
      expect(showToast).toHaveBeenCalledWith('success', '评分分布调整成功');
      // 调整成功后回调 loadRuleApplicationData → getAll 再次被调用
      await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalledTimes(2));
    });

    it('未选班级时传 undefined', async () => {
      const { result } = setup({ selectedClass: '' });
      await act(async () => {
        await result.current.handleAdjustDistribution();
      });
      expect(mockApi.algorithm.adjustScoreDistribution).toHaveBeenCalledWith(undefined);
    });

    it('失败时提示评分分布调整失败', async () => {
      mockApi.algorithm.adjustScoreDistribution.mockRejectedValue(new Error('adjust failed'));
      const { result } = setup({ selectedClass: '9' });
      await act(async () => {
        await result.current.handleAdjustDistribution();
      });
      expect(showToast).toHaveBeenCalledWith('error', '评分分布调整失败');
    });
  });

  describe('自动加载 effect', () => {
    it('进入 ruleApplication Tab 自动加载数据', async () => {
      setup({ selectedClass: '2', activeTab: 'ruleApplication' });
      await waitFor(() => expect(mockApi.users.getAll).toHaveBeenCalled());
    });

    it('非 ruleApplication Tab 不自动加载', async () => {
      setup({ selectedClass: '2', activeTab: 'engagement' });
      await waitFor(() => expect(mockApi.users.getAll).not.toHaveBeenCalled());
    });
  });
});
