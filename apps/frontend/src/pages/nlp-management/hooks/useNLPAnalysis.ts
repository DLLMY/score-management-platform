/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-8 拆分（2026-09-12）：算法分析域（意图/性能分析数据 / 优化建议与配置 / 基准测试 / 策略更新）。
 * 自 useNLPManagementLogic.ts 原样搬出，showToast / setLoadError 由组合根注入。
 */

import { useState, useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { type ColumnType } from '../../../components';
import api from '../../../services/api';
import logger from '../../../utils/logger';
import { buildPerformanceColumns } from '../columns';
import type {
  NLPDeps,
  NlpAnalysisData,
  NlpBenchmarkResult,
  NlpOptimizerConfig,
  NlpSuggestion,
  PerformanceRow,
  ShowToast,
} from '../types';

export interface useNLPAnalysisParams {
  showToast: ShowToast;
  setLoadError: Dispatch<SetStateAction<boolean>>;
}

export function useNLPAnalysis(
  params: useNLPAnalysisParams
): Pick<
  NLPDeps,
  | 'intentAnalysis'
  | 'setIntentAnalysis'
  | 'performanceAnalysis'
  | 'setPerformanceAnalysis'
  | 'optimizationSuggestions'
  | 'setOptimizationSuggestions'
  | 'optimizerConfig'
  | 'setOptimizerConfig'
  | 'isLoadingAnalysis'
  | 'setIsLoadingAnalysis'
  | 'benchmarkResults'
  | 'setBenchmarkResults'
  | 'isBenchmarking'
  | 'setIsBenchmarking'
  | 'selectedStrategy'
  | 'setSelectedStrategy'
  | 'performanceColumns'
  | 'fetchAnalysisData'
  | 'runBenchmark'
  | 'updateOptimizationStrategy'
  | 'resetAnalysisMetrics'
> {
  const { showToast, setLoadError } = params;

  // 算法分析相关状态
  const [intentAnalysis, setIntentAnalysis] = useState<NlpAnalysisData | null>(null);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<NlpAnalysisData | null>(null);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<NlpSuggestion[]>([]);
  const [optimizerConfig, setOptimizerConfig] = useState<NlpOptimizerConfig | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<NlpBenchmarkResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('balanced');

  // 获取分析数据
  const fetchAnalysisData = useCallback(async () => {
    setIsLoadingAnalysis(true);
    try {
      const [intentRes, perfRes, suggestionsRes, configRes] = await Promise.all([
        api.nlp.getAnalysisIntent(),
        api.nlp.getAnalysisPerformance(),
        api.nlp.getAnalysisSuggestions(),
        api.nlp.getOptimizationConfig(),
      ]);

      // api 层这 4 个端点声明 data: unknown（后端形状由 NLP 服务决定），此处按本地契约断言。
      if (intentRes.code === 0) setIntentAnalysis((intentRes.data as NlpAnalysisData) ?? null);
      if (perfRes.code === 0) setPerformanceAnalysis((perfRes.data as NlpAnalysisData) ?? null);
      if (suggestionsRes.code === 0)
        setOptimizationSuggestions((suggestionsRes.data as NlpSuggestion[]) ?? []);
      if (configRes.code === 0) setOptimizerConfig((configRes.data as NlpOptimizerConfig) ?? null);
      setLoadError(false);
    } catch (error) {
      logger.error('获取分析数据失败:', error);
      setLoadError(true);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, []);

  // 运行基准测试
  const runBenchmark = useCallback(async () => {
    setIsBenchmarking(true);
    try {
      const response = await api.nlp.benchmarkIntentClassifier({ iterations: 10 });
      if (response) {
        setBenchmarkResults(response as NlpBenchmarkResult);
        showToast('success', '基准测试完成');
      }
    } catch (error) {
      showToast('error', '基准测试失败');
    } finally {
      setIsBenchmarking(false);
    }
  }, [showToast]);

  // 更新优化策略
  const updateOptimizationStrategy = useCallback(
    async (strategy: string) => {
      try {
        const response = await api.nlp.setOptimizationConfig({ strategy });
        if (response) {
          setOptimizerConfig(response as NlpOptimizerConfig);
          setSelectedStrategy(strategy);
          showToast('success', '优化策略已更新');
          fetchAnalysisData();
        }
      } catch (error) {
        showToast('error', '更新优化策略失败');
      }
    },
    [fetchAnalysisData, showToast]
  );

  // 重置分析指标
  const resetAnalysisMetrics = useCallback(async () => {
    try {
      const response = await api.nlp.resetAnalysis();
      if (response) {
        showToast('success', '指标已重置');
        fetchAnalysisData();
      }
    } catch (error) {
      showToast('error', '重置失败');
    }
  }, [fetchAnalysisData, showToast]);

  // —— 组件性能表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const performanceColumns = useMemo<ColumnType<PerformanceRow>[]>(
    () => buildPerformanceColumns(),
    []
  );

  return {
    intentAnalysis,
    setIntentAnalysis,
    performanceAnalysis,
    setPerformanceAnalysis,
    optimizationSuggestions,
    setOptimizationSuggestions,
    optimizerConfig,
    setOptimizerConfig,
    isLoadingAnalysis,
    setIsLoadingAnalysis,
    benchmarkResults,
    setBenchmarkResults,
    isBenchmarking,
    setIsBenchmarking,
    selectedStrategy,
    setSelectedStrategy,
    performanceColumns,
    fetchAnalysisData,
    runBenchmark,
    updateOptimizationStrategy,
    resetAnalysisMetrics,
  };
}
