import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useStableToast } from '../../hooks';
import logger from '../../utils/logger';
import type {
  AlgorithmStatistics,
  BatchPredictionData,
  BatchAnomalyData,
  RuleRecommendData,
  BatchScorePredictData,
  BatchRiskPredictData,
  RiskStudent,
} from '../../types';
import { TABS, ANALYSIS_CONFIG } from './constants';
import type { AlgorithmAnalysisViewDeps } from './AlgorithmAnalysisShell';
import { useModelLogic } from './useModelLogic';
import { useRuleApplicationLogic } from './useRuleApplicationLogic';
import { useStudentProfileLogic } from './useStudentProfileLogic';
import { useEngagementLogic } from './useEngagementLogic';

export interface AlgorithmAnalysisLogicResult extends AlgorithmAnalysisViewDeps {
  /** 当前激活 Tab */
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  /** Tab 导航容器 ref（自动滚动进可视区） */
  tabNavRef: React.RefObject<HTMLDivElement>;
  /** 壳层专用：搜索关键词 / 各天数选择器 / 重载回调 */
  setSearchKeyword: React.Dispatch<React.SetStateAction<string>>;
  setPredictionDays: React.Dispatch<React.SetStateAction<number>>;
  setAnomalyDays: React.Dispatch<React.SetStateAction<number>>;
  anomalyDays: number;
  setRecommendDays: React.Dispatch<React.SetStateAction<number>>;
  recommendDays: number;
  loadPrediction: () => Promise<void>;
  loadAnomaly: () => Promise<void>;
  loadStatistics: () => Promise<void>;
}

/**
 * 智能分析增强页的逻辑层 hook（组合根）。
 *
 * 承接原 AlgorithmAnalysis.tsx 中全部 state / effect / handler / useMemo，
 * 主文件退化为「全局状态 + 核心加载器 + 跨域 effect」的薄装配，
 * 域逻辑（模型 / 规则应用 / 学生画像 / 参与度归因导出）下沉到独立子 hook。
 * deps 形状与 AlgorithmAnalysisViewDeps 保持一致，故 Shell 与各 Tab 无需改动。
 */
export function useAlgorithmAnalysisLogic(): AlgorithmAnalysisLogicResult {
  const { showToast } = useStableToast();
  // 支持 URL 直达：/#/algorithm-analysis?tab=batchAttribution（教师工作台「一键查看」入口用）
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || '';
  const [activeTab, setActiveTab] = useState<string>(() =>
    TABS.some((t) => t.id === urlTab) ? urlTab : 'statistics'
  );
  const tabNavRef = useRef<HTMLDivElement>(null);

  // 选中的 Tab 自动滚动进可视区，避免「学生画像」等靠右标签被 overflow 裁掉
  useEffect(() => {
    const el = tabNavRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    // 可选调用：jsdom/部分环境无 scrollIntoView，避免整页崩溃
    el?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // 统计/班级/趋势加载失败警示（不阻断内容区，仅提示数据可能不完整）
  const [loadWarn, setLoadWarn] = useState<boolean>(false);

  // 原有数据
  const [statistics, setStatistics] = useState<AlgorithmStatistics | null>(null);

  // 新增数据：预测
  const [predictionData, setPredictionData] = useState<BatchPredictionData | null>(null);
  const [riskStudents, setRiskStudents] = useState<RiskStudent[]>([]);
  const [predictionDays, setPredictionDays] = useState<number>(
    ANALYSIS_CONFIG.defaultDays.prediction
  );

  // 新增数据：异常检测
  const [anomalyData, setAnomalyData] = useState<BatchAnomalyData | null>(null);
  const [anomalyDays, setAnomalyDays] = useState<number>(ANALYSIS_CONFIG.defaultDays.anomaly);

  // 新增数据：规则推荐
  const [ruleRecommendData, setRuleRecommendData] = useState<RuleRecommendData | null>(null);

  // 新增数据：成绩预测
  const [scorePredictData, setScorePredictData] = useState<BatchScorePredictData | null>(null);

  // 新增数据：风险评估
  const [riskPredictData, setRiskPredictData] = useState<BatchRiskPredictData | null>(null);

  const [recommendDays, setRecommendDays] = useState<number>(ANALYSIS_CONFIG.defaultDays.recommend);

  // 使用 useMemo 优化过滤逻辑
  const filteredPredictions = useMemo(() => {
    if (!predictionData) return [];
    const { predictions } = predictionData;
    if (!searchKeyword) return predictions;
    const lowerKeyword = searchKeyword.toLowerCase();
    return predictions.filter((p) => p.name.toLowerCase().includes(lowerKeyword));
  }, [predictionData, searchKeyword]);

  const filteredRiskStudents = useMemo(() => {
    if (!searchKeyword) return riskStudents;
    const lowerKeyword = searchKeyword.toLowerCase();
    return riskStudents.filter((s) => s.name.toLowerCase().includes(lowerKeyword));
  }, [riskStudents, searchKeyword]);

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    try {
      const params = selectedClass ? { class_name: selectedClass } : undefined;
      const res = await api.algorithm.getStatistics(params);
      setStatistics(res || null);
      setLoadWarn(false);
    } catch (err) {
      logger.error('加载统计数据失败:', err);
      setLoadWarn(true);
    }
  }, [selectedClass]);

  // 加载预测数据
  const loadPrediction = useCallback(async () => {
    try {
      setLoading(true);
      // 注：api.ts::request() 已自动剥 envelope（{success, data} → data），所以这里直接用 res/data，不要再 .data
      const res = await api.algorithm.getBatchPrediction(
        selectedClass || undefined,
        predictionDays
      );
      setPredictionData(res || null);

      // 加载风险学生
      const riskRes = await api.algorithm.getRiskStudents(predictionDays);
      setRiskStudents(Array.isArray(riskRes) ? riskRes.slice(0, 10) : []);
    } catch (err) {
      logger.error('加载预测数据失败:', err);
      showToast('error', '加载预测数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, predictionDays, showToast]);

  // 加载异常检测数据
  const loadAnomaly = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.algorithm.getBatchAnomaly(selectedClass || undefined, anomalyDays);
      setAnomalyData(res || null);
    } catch (err) {
      logger.error('加载异常检测数据失败:', err);
      showToast('error', '加载异常检测数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, anomalyDays, showToast]);

  // 加载规则推荐数据
  const loadRuleRecommend = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.algorithm.getRuleRecommend(selectedClass || undefined, recommendDays);
      setRuleRecommendData(res || null);
    } catch (err) {
      logger.error('加载规则推荐数据失败:', err);
      showToast('error', '加载规则推荐数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, recommendDays, showToast]);

  // 加载成绩预测数据
  const loadScorePredict = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.algorithm.getBatchScorePredict(
        selectedClass || undefined,
        recommendDays
      );
      setScorePredictData(res || null);
    } catch (err) {
      logger.error('加载成绩预测数据失败:', err);
      showToast('error', '加载成绩预测数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, recommendDays, showToast]);

  // 加载风险评估数据
  const loadRiskPredict = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.algorithm.getBatchRiskPredict(
        selectedClass || undefined,
        recommendDays
      );
      setRiskPredictData(res || null);
    } catch (err) {
      logger.error('加载风险评估数据失败:', err);
      showToast('error', '加载风险评估数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedClass, recommendDays, showToast]);

  // —— 域逻辑子模块（状态 / 回调 / Tab 自动加载 effect 已下沉）——
  const model = useModelLogic({ showToast });
  const ruleApp = useRuleApplicationLogic({ showToast, selectedClass, activeTab });
  const studentProfile = useStudentProfileLogic({
    showToast,
    predictionDays,
    recommendDays,
    anomalyDays,
    activeTab,
    setLoadWarn,
  });
  const engagement = useEngagementLogic({ showToast, selectedClass, activeTab, setLoadWarn });

  // 初始化加载基础数据
  const { loadClasses } = studentProfile;
  useEffect(() => {
    const loadBaseData = async () => {
      await Promise.all([loadStatistics(), loadClasses()]);
    };
    loadBaseData();
  }, [selectedClass, loadStatistics, loadClasses]);

  // 切换标签页时加载对应数据
  useEffect(() => {
    const loadTabData = async () => {
      setLoading(true);
      setError(null);

      try {
        switch (activeTab) {
          case 'prediction':
            await loadPrediction();
            break;
          case 'anomaly':
            await loadAnomaly();
            break;
          case 'ruleRecommend':
            await loadRuleRecommend();
            break;
          case 'scorePredict':
            await loadScorePredict();
            break;
          case 'riskPredict':
            await loadRiskPredict();
            break;
        }
      } catch (err) {
        logger.error('加载数据失败:', err);
        setError(err instanceof Error ? err.message : '加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadTabData();
  }, [
    activeTab,
    selectedClass,
    loadPrediction,
    loadAnomaly,
    loadRuleRecommend,
    loadScorePredict,
    loadRiskPredict,
  ]);

  return {
    // —— 选择器 / 全局过滤 ——
    selectedClass,
    setSelectedClass,
    searchKeyword,
    loading,
    error,
    loadWarn,
    // —— 统计 ——
    statistics,
    // —— 积分预测 ——
    predictionData,
    riskStudents,
    predictionDays,
    filteredPredictions,
    filteredRiskStudents,
    // —— 异常检测 ——
    anomalyData,
    // —— 规则推荐 ——
    ruleRecommendData,
    // —— 成绩预测 ——
    scorePredictData,
    // —— 风险评估 ——
    riskPredictData,
    // —— 壳层专用 ——
    activeTab,
    setActiveTab,
    tabNavRef,
    setSearchKeyword,
    setPredictionDays,
    setAnomalyDays,
    anomalyDays,
    setRecommendDays,
    recommendDays,
    loadPrediction,
    loadAnomaly,
    loadStatistics,
    // —— 域子模块 ——
    ...model,
    ...ruleApp,
    ...studentProfile,
    ...engagement,
  };
}
