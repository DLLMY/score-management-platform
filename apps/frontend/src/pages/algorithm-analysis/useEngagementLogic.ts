import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import api from '../../services/api';
import { useStableToast } from '../../hooks';
import logger from '../../utils/logger';
import type {
  BatchAttributionResult,
  EngagementRankResult,
  EngagementTrendResult,
} from '../../types';

export interface EngagementLogicDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  selectedClass: string;
  activeTab: string;
  setLoadWarn: Dispatch<SetStateAction<boolean>>;
}

export interface EngagementLogicResult {
  batchAttribution: BatchAttributionResult | null;
  batchAttributionDays: number;
  setBatchAttributionDays: Dispatch<SetStateAction<number>>;
  batchAttributionLoading: boolean;
  batchAttributionError: string | null;
  loadBatchAttribution: () => Promise<void>;
  exporting: 'engagement' | 'attribution' | 'risk' | null;
  handleExport: (tab: 'engagement' | 'attribution' | 'risk', days: number) => Promise<void>;
  engagementRank: EngagementRankResult | null;
  engagementRankDays: number;
  setEngagementRankDays: Dispatch<SetStateAction<number>>;
  engagementRankLoading: boolean;
  engagementRankError: string | null;
  engagementTrend: EngagementTrendResult | null;
  engagementTrendUserId: number | null;
  setEngagementTrendUserId: Dispatch<SetStateAction<number | null>>;
  engagementTrendWeeks: number;
  setEngagementTrendWeeks: Dispatch<SetStateAction<number>>;
  engagementTrendLoading: boolean;
  setEngagementTrend: Dispatch<SetStateAction<EngagementTrendResult | null>>;
  loadEngagementRank: () => Promise<void>;
}

/**
 * 参与度分析 / 班级归因 / 导出逻辑子模块：状态、4 个回调与 3 个 Tab 自动加载 effect
 * 原样搬自 useAlgorithmAnalysisLogic.ts，函数体逐字不变；showToast / selectedClass / activeTab / setLoadWarn 经 deps 注入。
 */
export function useEngagementLogic(deps: EngagementLogicDeps): EngagementLogicResult {
  const { showToast, selectedClass, activeTab, setLoadWarn } = deps;
  const [batchAttribution, setBatchAttribution] = useState<BatchAttributionResult | null>(null);
  const [batchAttributionDays, setBatchAttributionDays] = useState<number>(30);
  const [batchAttributionLoading, setBatchAttributionLoading] = useState<boolean>(false);
  const [batchAttributionError, setBatchAttributionError] = useState<string | null>(null);

  // 算法结果导出 Excel（正在导出的 tab，null=无）
  const [exporting, setExporting] = useState<'engagement' | 'attribution' | 'risk' | null>(null);

  // 参与度分析 Tab
  const [engagementRank, setEngagementRank] = useState<EngagementRankResult | null>(null);
  const [engagementRankDays, setEngagementRankDays] = useState<number>(30);
  const [engagementRankLoading, setEngagementRankLoading] = useState<boolean>(false);
  const [engagementRankError, setEngagementRankError] = useState<string | null>(null);
  const [engagementTrend, setEngagementTrend] = useState<EngagementTrendResult | null>(null);
  const [engagementTrendUserId, setEngagementTrendUserId] = useState<number | null>(null);
  const [engagementTrendWeeks, setEngagementTrendWeeks] = useState<number>(8);
  const [engagementTrendLoading, setEngagementTrendLoading] = useState<boolean>(false);

  // 批量成绩波动归因：按班级一次性跑全班归因，单生异常由后端隔离
  const loadBatchAttribution = useCallback(async () => {
    if (!selectedClass) {
      showToast('warning', '请先选择班级');
      return;
    }
    setBatchAttributionLoading(true);
    setBatchAttributionError(null);
    try {
      const res = await api.algorithm.getBatchAttribution(selectedClass, batchAttributionDays);
      setBatchAttribution(res);
    } catch (err) {
      logger.error('批量归因失败:', err);
      const msg = err instanceof Error ? err.message : '批量归因失败';
      setBatchAttributionError(msg);
      showToast('error', '批量归因失败');
    } finally {
      setBatchAttributionLoading(false);
    }
  }, [selectedClass, batchAttributionDays, showToast]);

  // 算法结果导出 Excel（参与度/归因/风险）
  const handleExport = useCallback(
    async (tab: 'engagement' | 'attribution' | 'risk', days: number) => {
      if (!selectedClass && tab !== 'risk') {
        showToast('warning', '请先选择班级');
        return;
      }
      setExporting(tab);
      try {
        await api.algorithm.exportExcel(tab, selectedClass || undefined, days);
        showToast('success', '导出成功');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '导出失败';
        showToast('error', msg);
      } finally {
        setExporting(null);
      }
    },
    [selectedClass, showToast]
  );

  // 参与度分析：进入 Tab 且已选班级时加载全班排名
  const loadEngagementRank = useCallback(async () => {
    if (!selectedClass) {
      showToast('warning', '请先选择班级');
      return;
    }
    setEngagementRankLoading(true);
    setEngagementRankError(null);
    try {
      const res = await api.algorithm.getEngagementRank(selectedClass, engagementRankDays);
      setEngagementRank(res);
    } catch (err) {
      logger.error('参与度排名失败:', err);
      const msg = err instanceof Error ? err.message : '参与度排名失败';
      setEngagementRankError(msg);
      showToast('error', '参与度排名失败');
    } finally {
      setEngagementRankLoading(false);
    }
  }, [selectedClass, engagementRankDays, showToast]);

  // 个人周趋势
  const loadEngagementTrend = useCallback(async () => {
    if (!engagementTrendUserId) return;
    setEngagementTrendLoading(true);
    try {
      const res = await api.algorithm.getEngagementTrend(
        engagementTrendUserId,
        engagementTrendWeeks
      );
      setEngagementTrend(res);
      setLoadWarn(false);
    } catch (err) {
      logger.error('参与度周趋势失败:', err);
      setEngagementTrend(null);
      setLoadWarn(true);
    } finally {
      setEngagementTrendLoading(false);
    }
  }, [engagementTrendUserId, engagementTrendWeeks]);

  // 进入班级归因 Tab 且已选班级时，自动批量归因
  useEffect(() => {
    if (activeTab === 'batchAttribution' && selectedClass) {
      loadBatchAttribution();
    }
  }, [activeTab, selectedClass, batchAttributionDays, loadBatchAttribution]);

  // 进入参与度分析 Tab 且已选班级时，自动加载排名
  useEffect(() => {
    if (activeTab === 'engagement' && selectedClass) {
      loadEngagementRank();
    }
  }, [activeTab, selectedClass, engagementRankDays, loadEngagementRank]);

  // 选中学生查看周趋势时加载
  useEffect(() => {
    if (activeTab === 'engagement' && engagementTrendUserId) {
      loadEngagementTrend();
    }
  }, [activeTab, engagementTrendUserId, engagementTrendWeeks, loadEngagementTrend]);

  return {
    batchAttribution,
    batchAttributionDays,
    setBatchAttributionDays,
    batchAttributionLoading,
    batchAttributionError,
    loadBatchAttribution,
    exporting,
    handleExport,
    engagementRank,
    engagementRankDays,
    setEngagementRankDays,
    engagementRankLoading,
    engagementRankError,
    engagementTrend,
    engagementTrendUserId,
    setEngagementTrendUserId,
    engagementTrendWeeks,
    setEngagementTrendWeeks,
    engagementTrendLoading,
    setEngagementTrend,
    loadEngagementRank,
  };
}
