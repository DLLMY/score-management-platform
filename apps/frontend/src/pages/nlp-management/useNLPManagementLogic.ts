/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 智能评分规则管理（NLPManagement）的逻辑层组合根 hook（T12-8 拆分，2026-09-12）。
 *
 * 领域子 hooks（./hooks/）：useNLPParse（解析/评分/修正/反馈）、useNLPRules（规则列表/增删改/导入）、
 * useNLPTraining（训练/评估）、useNLPStatistics（统计）、useNLPAnalysis（算法分析/基准测试）、
 * useNLPCorrections（纠正记录）。各域返回类型为 `Pick<NLPDeps, ...>`，组合根 spread 装配并由
 * NLPDeps 注解做完备性校验；壳层专用字段（activeTab / setActiveTab / loadError）留在本文件。
 */

import { useState, useEffect, useRef } from 'react';
import { useStableToast } from '../../hooks';
import { useConfirm } from '../../components';
import {
  useNLPAnalysis,
  useNLPCorrections,
  useNLPParse,
  useNLPRules,
  useNLPStatistics,
  useNLPTraining,
} from './hooks';
import type { NLPDeps, TabType } from './types';

/**
 * 智能评分规则管理逻辑组合根。
 */
export function useNLPManagementLogic(): NLPDeps & {
  /** 当前激活 Tab */
  activeTab: TabType;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  /** 算法/分析数据加载失败标记（壳层警示条用） */
  loadError: boolean;
} {
  const [activeTab, setActiveTab] = useState<TabType>('parse');
  const [loadError, setLoadError] = useState(false);

  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // 域子 hooks（顺序：parse 依赖 rules 的 fetchRules，故 rules 先行）
  const rulesDomain = useNLPRules({ showToast, confirmRef });
  const correctionsDomain = useNLPCorrections({ showToast, confirmRef });
  const trainingDomain = useNLPTraining({ showToast, setLoadError });
  const statisticsDomain = useNLPStatistics({ showToast });
  const analysisDomain = useNLPAnalysis({ showToast, setLoadError });
  const parseDomain = useNLPParse({ showToast, fetchRules: rulesDomain.fetchRules });

  // activeTab 切换效应：依赖数组与原实现逐字一致（4 个 fetcher 均为稳定 useCallback）
  const { fetchStatistics } = statisticsDomain;
  const { fetchModelEvaluation, fetchTrainingHistory } = trainingDomain;
  const { fetchAnalysisData } = analysisDomain;

  useEffect(() => {
    if (activeTab === 'statistics') {
      fetchStatistics();
      fetchModelEvaluation();
    }
    if (activeTab === 'training') {
      fetchTrainingHistory();
    }
    if (activeTab === 'analysis') {
      fetchAnalysisData();
    }
  }, [activeTab, fetchStatistics, fetchModelEvaluation, fetchTrainingHistory]);

  // —— 主壳 → 子模块透传契约 ——
  const deps: NLPDeps = {
    // 解析 Tab
    ...parseDomain,
    // 规则 Tab + 批量导入模态
    ...rulesDomain,
    // 训练 Tab
    ...trainingDomain,
    // 统计 Tab
    ...statisticsDomain,
    // 分析 Tab
    ...analysisDomain,
    // 纠正记录列表
    ...correctionsDomain,
  };

  return { ...deps, activeTab, setActiveTab, loadError };
}
