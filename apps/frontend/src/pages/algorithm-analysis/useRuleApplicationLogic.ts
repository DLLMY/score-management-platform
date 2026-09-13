import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import api from '../../services/api';
import { useStableToast } from '../../hooks';
import type { RuleApplicationState } from './types';

export interface RuleApplicationLogicDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  selectedClass: string;
  activeTab: string;
}

export interface RuleApplicationLogicResult {
  ruleApplicationData: RuleApplicationState;
  selectedUserId: number | null;
  setSelectedUserId: Dispatch<SetStateAction<number | null>>;
  selectedBehaviorType: string;
  setSelectedBehaviorType: Dispatch<SetStateAction<string>>;
  handleAdjustDistribution: () => Promise<void>;
  handleApplyRule: () => Promise<void>;
  loadRuleApplicationData: () => Promise<void>;
}

/**
 * 智能规则应用逻辑子模块（数据加载 + 应用规则 + 评分分布调整 + 进入 Tab 自动加载）。
 * 状态、3 个回调与 Tab 自动加载 effect 原样搬自 useAlgorithmAnalysisLogic.ts，函数体逐字不变；
 * showToast / selectedClass / activeTab 经 deps 注入。
 */
export function useRuleApplicationLogic(
  deps: RuleApplicationLogicDeps
): RuleApplicationLogicResult {
  const { showToast, selectedClass, activeTab } = deps;
  const [ruleApplicationData, setRuleApplicationData] = useState<RuleApplicationState>({});
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedBehaviorType, setSelectedBehaviorType] = useState<string>('attendance');

  const loadRuleApplicationData = useCallback(async () => {
    try {
      const [stats, earningRules, spendingRules, rewardTypes, usersResponse] = await Promise.all([
        api.algorithm.getScoreDistributionStats(selectedClass || undefined),
        api.algorithm.getEarningRules(),
        api.algorithm.getSpendingRules(),
        api.algorithm.getRewardTypes(),
        api.users.getAll(),
      ]);
      const usersList = usersResponse.users || [];
      const studentList = usersList.map((u) => ({
        id: typeof u.id === 'number' ? u.id : parseInt(u.id, 10),
        name: u.name,
        class_name: u.class_name || '',
      }));
      setRuleApplicationData({
        scoreDistributionStats: stats,
        earningRules,
        spendingRules,
        rewardTypes,
        students: studentList,
      });
    } catch (error) {
      showToast('error', '加载规则应用数据失败');
    }
  }, [selectedClass, showToast]);

  const handleApplyRule = async () => {
    if (!selectedUserId) {
      showToast('error', '请选择学生');
      return;
    }
    setRuleApplicationData((prev) => ({ ...prev, applyingRule: true }));
    try {
      const result = await api.algorithm.applyRuleByBehavior(selectedUserId, selectedBehaviorType);
      setRuleApplicationData((prev) => ({ ...prev, applyingRule: false, applyingResult: result }));
      showToast('success', '规则应用成功');
    } catch (error) {
      setRuleApplicationData((prev) => ({ ...prev, applyingRule: false }));
      showToast('error', '规则应用失败');
    }
  };

  const handleAdjustDistribution = async () => {
    try {
      await api.algorithm.adjustScoreDistribution(selectedClass || undefined);
      showToast('success', '评分分布调整成功');
      loadRuleApplicationData();
    } catch (error) {
      showToast('error', '评分分布调整失败');
    }
  };

  useEffect(() => {
    if (activeTab === 'ruleApplication') {
      loadRuleApplicationData();
    }
  }, [activeTab, loadRuleApplicationData]);

  return {
    ruleApplicationData,
    selectedUserId,
    setSelectedUserId,
    selectedBehaviorType,
    setSelectedBehaviorType,
    handleAdjustDistribution,
    handleApplyRule,
    loadRuleApplicationData,
  };
}
