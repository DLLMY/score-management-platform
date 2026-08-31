import logger from '../utils/logger';
/**
 * 智能分析增强页面组件
 * 在原有算法分析基础上，增加预测和异常检测功能
 *
 * 本文件为主壳（状态 + 数据加载 + 列定义 + Tab 分发）；
 * 各 Tab 渲染逻辑已抽到 ./algorithm-analysis/ 子模块，行为与原闭包一致。
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Target,
  RefreshCw,
  TrendingUp,
  Activity,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ShieldCheck,
  Brain,
  Zap,
  Sparkles,
  Bell,
  Search,
  Loader2,
} from 'lucide-react';
// 注：LineChart / Users / UserCircle / BarChart3 等图标由子模块自行 import
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import type { ColumnType } from '../components/data-display/DataTable';
import {
  AlgorithmStatistics,
  BatchPredictionData,
  BatchAnomalyData,
  RuleRecommendData,
  BatchScorePredictData,
  BatchRiskPredictData,
  RiskStudent,
  ModelEvaluationResult,
  PredictionResult,
  ScorePredictResult,
  RiskPredictResult,
  AnomalyResult,
  ScoreAttributionResult,
  EngagementResult,
  EngagementRankResult,
  EngagementTrendResult,
  BatchAttributionResult,
  BatchAttributionStudent,
  EngagementStudentRank,
} from '../types';

import { TABS, ANALYSIS_CONFIG } from './algorithm-analysis/constants';
import { getTrendIcon, getTrendColor, engagementLevelBadge, topFactors } from './algorithm-analysis/helpers';
import type { AlgorithmAnalysisDeps } from './algorithm-analysis/types';
import { StatisticsTab } from './algorithm-analysis/StatisticsTab';
import { PredictionTab } from './algorithm-analysis/PredictionTab';
import { AnomalyTab } from './algorithm-analysis/AnomalyTab';
import { RuleRecommendTab } from './algorithm-analysis/RuleRecommendTab';
import { ScorePredictTab } from './algorithm-analysis/ScorePredictTab';
import { RiskPredictTab } from './algorithm-analysis/RiskPredictTab';
import { ModelManagerTab } from './algorithm-analysis/ModelManagerTab';
import { RuleApplicationTab } from './algorithm-analysis/RuleApplicationTab';
import { BatchAttributionTab } from './algorithm-analysis/BatchAttributionTab';
import { EngagementTab } from './algorithm-analysis/EngagementTab';
import { StudentProfileTab } from './algorithm-analysis/StudentProfileTab';

export default function AlgorithmAnalysis(): React.ReactElement {
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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // 统计/班级/趋势加载失败警示（不阻断内容区，仅提示数据可能不完整）
  const [loadWarn, setLoadWarn] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

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

  // 新增数据：模型管理
  const [modelTrainingData, setModelTrainingData] = useState<{
    ruleRecommend?: { status: string; message: string; model_info?: unknown };
    scorePredict?: { status: string; message: string; model_info?: unknown };
    riskPredict?: { status: string; message: string; model_info?: unknown };
  }>({});
  const [modelEvaluationData, setModelEvaluationData] = useState<{
    ruleRecommend?: ModelEvaluationResult;
    scorePredict?: ModelEvaluationResult;
    riskPredict?: ModelEvaluationResult;
  }>({});
  const [trainingModel, setTrainingModel] = useState<string | null>(null);
  const [evaluatingModel, setEvaluatingModel] = useState<string | null>(null);

  const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([]);

  // 学生画像（单用户算法下钻）
  const [students, setStudents] = useState<
    Array<{ id: number; name: string; class_name?: string }>
  >([]);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<{
    prediction?: PredictionResult;
    scorePredict?: ScorePredictResult;
    riskPredict?: RiskPredictResult;
    anomaly?: AnomalyResult;
    sudden?: AnomalyResult;
    trend?: AnomalyResult;
    group?: AnomalyResult;
    attribution?: ScoreAttributionResult;
    engagement?: EngagementResult;
  } | null>(null);

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

  // 训练规则推荐模型
  const trainRuleModel = useCallback(
    async (days: number = 90) => {
      try {
        setTrainingModel('ruleRecommend');
        const data = await api.algorithm.trainRuleRecommendModel(days);
        setModelTrainingData((prev) => ({ ...prev, ruleRecommend: data }));
        showToast('success', data.message || '规则推荐模型训练完成');
      } catch (err) {
        logger.error('训练规则推荐模型失败:', err);
        showToast('error', '训练规则推荐模型失败');
      } finally {
        setTrainingModel(null);
      }
    },
    [showToast]
  );

  // 评估规则推荐模型
  const evaluateRuleModel = useCallback(
    async (days: number = 30) => {
      try {
        setEvaluatingModel('ruleRecommend');
        const data = await api.algorithm.evaluateRuleRecommendModel(days);
        setModelEvaluationData((prev) => ({ ...prev, ruleRecommend: data }));
      } catch (err) {
        logger.error('评估规则推荐模型失败:', err);
        showToast('error', '评估规则推荐模型失败');
      } finally {
        setEvaluatingModel(null);
      }
    },
    [showToast]
  );

  // 训练成绩预测模型
  const trainScoreModel = useCallback(
    async (days: number = 90) => {
      try {
        setTrainingModel('scorePredict');
        const data = await api.algorithm.trainScorePredictModel(days);
        setModelTrainingData((prev) => ({ ...prev, scorePredict: data }));
        showToast('success', data.message || '成绩预测模型训练完成');
      } catch (err) {
        logger.error('训练成绩预测模型失败:', err);
        showToast('error', '训练成绩预测模型失败');
      } finally {
        setTrainingModel(null);
      }
    },
    [showToast]
  );

  // 评估成绩预测模型
  const evaluateScoreModel = useCallback(
    async (days: number = 30) => {
      try {
        setEvaluatingModel('scorePredict');
        const data = await api.algorithm.evaluateScorePredictModel(days);
        setModelEvaluationData((prev) => ({ ...prev, scorePredict: data }));
      } catch (err) {
        logger.error('评估成绩预测模型失败:', err);
        showToast('error', '评估成绩预测模型失败');
      } finally {
        setEvaluatingModel(null);
      }
    },
    [showToast]
  );

  // 训练风险预测模型
  const trainRiskModel = useCallback(
    async (days: number = 90) => {
      try {
        setTrainingModel('riskPredict');
        const data = await api.algorithm.trainRiskPredictModel(days);
        setModelTrainingData((prev) => ({ ...prev, riskPredict: data }));
        showToast('success', data?.message || '风险预测模型训练完成');
      } catch (err) {
        logger.error('训练风险预测模型失败:', err);
        showToast('error', '训练风险预测模型失败');
      } finally {
        setTrainingModel(null);
      }
    },
    [showToast]
  );

  const evaluateRiskModel = useCallback(
    async (days: number = 30) => {
      try {
        setEvaluatingModel('riskPredict');
        const data = await api.algorithm.evaluateRiskPredictModel(days);
        setModelEvaluationData((prev) => ({ ...prev, riskPredict: data }));
      } catch (err) {
        logger.error('评估风险预测模型失败:', err);
        showToast('error', '评估风险预测模型失败');
      } finally {
        setEvaluatingModel(null);
      }
    },
    [showToast]
  );

  // 加载班级列表
  const loadClasses = useCallback(async () => {
    try {
      const data = (await api.classes.getAll()) as unknown;
      const classesData = Array.isArray(data)
        ? data
        : (data as { classes?: { id: number; name: string }[] }).classes || [];
      setClasses(classesData);
      setLoadWarn(false);
    } catch (err) {
      logger.error('加载班级列表失败:', err);
      setClasses([]);
      setLoadWarn(true);
    }
  }, []);

  // 加载学生列表（用于学生画像下钻）
  const loadStudents = useCallback(async () => {
    if (students.length > 0) return;
    try {
      const usersResponse = (await api.users.getAll()) as unknown;
      const usersList =
        (
          usersResponse as {
            users?: Array<{ id: number | string; name: string; class_name?: string }>;
          }
        ).users || [];
      const studentList = usersList.map((u) => ({
        id: typeof u.id === 'number' ? u.id : parseInt(String(u.id), 10),
        name: u.name,
        class_name: u.class_name || '',
      }));
      setStudents(studentList);
    } catch (err) {
      logger.error('加载学生列表失败:', err);
      showToast('error', '加载学生列表失败');
    }
  }, [students, showToast]);

  // 加载单个学生画像（并行消费全部单用户算法接口）
  const loadStudentProfile = useCallback(
    async (userId: number) => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const [
          prediction,
          scorePredict,
          riskPredict,
          anomaly,
          sudden,
          trend,
          group,
          attribution,
          engagement,
        ] = await Promise.all([
          api.algorithm.getPrediction(userId, predictionDays),
          api.algorithm.getScorePredict(userId, recommendDays),
          api.algorithm.getRiskPredict(userId, recommendDays),
          api.algorithm.getUserAnomaly(userId, anomalyDays),
          api.algorithm.getSuddenChange(userId, anomalyDays),
          api.algorithm.getTrendAnomaly(userId, anomalyDays),
          api.algorithm.getGroupAnomaly(userId, anomalyDays),
          api.algorithm.getScoreAttribution(userId, recommendDays),
          api.algorithm.getEngagement(userId, anomalyDays),
        ]);
        setStudentProfile({
          prediction,
          scorePredict,
          riskPredict,
          anomaly,
          sudden,
          trend,
          group,
          attribution,
          engagement,
        });
      } catch (err) {
        logger.error('加载学生画像失败:', err);
        const msg = err instanceof Error ? err.message : '加载学生画像失败';
        setProfileError(msg);
        showToast('error', '加载学生画像失败');
      } finally {
        setProfileLoading(false);
      }
    },
    [predictionDays, recommendDays, anomalyDays, showToast]
  );

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

  // 初始化加载基础数据
  useEffect(() => {
    const loadBaseData = async () => {
      await Promise.all([loadStatistics(), loadClasses()]);
    };
    loadBaseData();
  }, [selectedClass, loadStatistics, loadClasses]);

  // 进入学生画像 Tab 时加载学生列表
  useEffect(() => {
    if (activeTab === 'studentProfile') {
      loadStudents();
    }
  }, [activeTab, loadStudents]);

  // 进入班级归因 Tab 且已选班级时，自动批量归因
  useEffect(() => {
    if (activeTab === 'batchAttribution' && selectedClass) {
      loadBatchAttribution();
    }
  }, [activeTab, selectedClass, batchAttributionDays, loadBatchAttribution]);

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

  const [ruleApplicationData, setRuleApplicationData] = useState<{
    scoreDistributionStats?: unknown;
    earningRules?: unknown;
    spendingRules?: unknown;
    rewardTypes?: unknown;
    applyingRule?: boolean;
    applyingResult?: unknown;
    students?: Array<{ id: number; name: string; class_name?: string }>;
  }>({});

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

  // 积分预测详情列
  const predictionDetailColumns = useMemo<ColumnType<PredictionResult>[]>(
    () => [
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (value) => (
          <div className='font-medium text-gray-800 dark:text-white'>
            {String(value ?? '') || '未知学生'}
          </div>
        ),
      },
      {
        title: '当前积分',
        key: 'current_score',
        dataIndex: 'current_score',
        render: (value) => {
          const current = typeof value === 'number' ? value : 0;
          return (
            <span className='font-medium text-gray-800 dark:text-white'>
              {current.toFixed(1)}
            </span>
          );
        },
      },
      {
        title: '趋势',
        key: 'trend',
        dataIndex: 'trend',
        render: (value) => {
          const hasTrend = !!value;
          const trend = String(value || 'stable');
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(
                trend
              )}`}
            >
              {getTrendIcon(trend)}
              {hasTrend
                ? trend === 'up'
                  ? '上升'
                  : trend === 'down'
                  ? '下降'
                  : '稳定'
                : '--'}
            </span>
          );
        },
      },
      {
        title: '预测变化',
        key: 'predicted_change',
        render: (_, item) => {
          const current = typeof item.current_score === 'number' ? item.current_score : 0;
          const predicted =
            typeof item.predicted_score === 'number' ? item.predicted_score : current;
          const diff = predicted - current;
          return (
            <span
              className={`font-medium ${
                diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              {diff.toFixed(1)}分
            </span>
          );
        },
      },
      {
        title: '置信度',
        key: 'confidence',
        dataIndex: 'confidence',
        render: (value) => {
          const confidence = typeof value === 'number' ? value : 0;
          return (
            <div>
              <div className='w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                <div
                  className='bg-blue-500 h-2 rounded-full'
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <div className='text-xs text-gray-400 mt-1'>{(confidence * 100).toFixed(0)}%</div>
            </div>
          );
        },
      },
    ],
    []
  );

  // 学生成绩预测详情列
  const scorePredictColumns = useMemo<ColumnType<ScorePredictResult>[]>(
    () => [
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (value) => (
          <div className='font-medium text-gray-800 dark:text-white'>
            {String(value ?? '')}
          </div>
        ),
      },
      {
        title: '科目',
        key: 'subject',
        dataIndex: 'subject',
        render: (value) => (
          <div className='font-medium text-gray-800 dark:text-white'>
            {String(value ?? '') || '综合'}
          </div>
        ),
      },
      {
        title: '当前分数',
        key: 'current_score',
        dataIndex: 'current_score',
        render: (value) => {
          const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
          return <span className='text-lg font-medium text-gray-600'>{n.toFixed(1)}</span>;
        },
      },
      {
        title: '预测分数',
        key: 'predicted_score',
        dataIndex: 'predicted_score',
        render: (value) => {
          const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
          return (
            <span
              className={`text-xl font-bold ${
                n >= ANALYSIS_CONFIG.scoreColorThresholds.excellent
                  ? 'text-green-600'
                  : n >= ANALYSIS_CONFIG.scoreColorThresholds.good
                  ? 'text-blue-600'
                  : 'text-red-600'
              }`}
            >
              {n.toFixed(1)}
            </span>
          );
        },
      },
      {
        title: '趋势',
        key: 'trend',
        dataIndex: 'trend',
        render: (value) => {
          const t: 'up' | 'down' | 'stable' = value === 'up' || value === 'down' ? value : 'stable';
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(
                t
              )}`}
            >
              {getTrendIcon(t)}
              {t === 'up' ? '上升' : t === 'down' ? '下降' : '稳定'}
            </span>
          );
        },
      },
      {
        title: '置信度',
        key: 'confidence',
        dataIndex: 'confidence',
        render: (value) => {
          const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
          return (
            <div>
              <div className='w-16 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                <div
                  className='bg-blue-500 h-2 rounded-full'
                  style={{ width: `${n * 100}%` }}
                />
              </div>
              <div className='text-xs text-gray-400 mt-1'>{(n * 100).toFixed(0)}%</div>
            </div>
          );
        },
      },
    ],
    []
  );

  // 全班成绩波动归因列
  const attributionColumns = useMemo<ColumnType<BatchAttributionStudent>[]>(
    () => [
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (_, s) => (
          <div>
            <div className='font-medium text-gray-800 dark:text-white'>{s.name}</div>
            {s.error && <div className='text-xs text-red-500'>{s.error}</div>}
          </div>
        ),
      },
      {
        title: '成绩变化',
        key: 'total_change',
        dataIndex: 'total_change',
        render: (_, s) =>
          s.has_data ? (
            <span
              className={`font-medium ${
                (s.total_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(s.total_change || 0) >= 0 ? '+' : ''}
              {(s.total_change || 0).toFixed(1)}
            </span>
          ) : (
            <span className='text-gray-400'>—</span>
          ),
      },
      {
        title: '主要归因',
        key: 'factors',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.has_data ? topFactors(s) : '数据不足'}
          </span>
        ),
      },
      {
        title: '置信度',
        key: 'confidence',
        dataIndex: 'confidence',
        render: (_, s) =>
          s.has_data ? (
            <div className='w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
              <div
                className='bg-purple-500 h-2 rounded-full'
                style={{ width: `${Math.min(100, (s.confidence || 0) * 100)}%` }}
              />
            </div>
          ) : (
            <span className='text-gray-400'>—</span>
          ),
      },
      {
        title: '状态',
        key: 'has_data',
        render: (_, s) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              s.has_data
                ? 'bg-green-100 dark:bg-green-500/20 text-green-600'
                : 'bg-gray-100 dark:bg-gray-500/20 text-gray-500'
            }`}
          >
            {s.has_data ? '已归因' : '缺数据'}
          </span>
        ),
      },
    ],
    []
  );

  // 全班参与度排名榜列
  const engagementColumns = useMemo<ColumnType<EngagementStudentRank>[]>(
    () => [
      {
        title: '排名',
        key: 'rank',
        dataIndex: 'rank',
        render: (_, s) => (
          <span className={`font-bold ${s.rank && s.rank <= 3 ? 'text-purple-600' : 'text-gray-500'}`}>
            {s.rank ? `#${s.rank}` : '—'}
          </span>
        ),
      },
      {
        title: '学生',
        key: 'name',
        dataIndex: 'name',
        render: (_, s) => (
          <div>
            <div className='font-medium text-gray-800 dark:text-white'>{s.name}</div>
            {s.error && <div className='text-xs text-red-500'>{s.error}</div>}
          </div>
        ),
      },
      {
        title: '参与度',
        key: 'engagement_score',
        dataIndex: 'engagement_score',
        render: (_, s) =>
          s.has_data ? (
            <span
              className={`font-medium ${
                (s.engagement_score || 0) >= ANALYSIS_CONFIG.engagementScoreThresholds.high
                  ? 'text-green-600'
                  : (s.engagement_score || 0) >= ANALYSIS_CONFIG.engagementScoreThresholds.medium
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {(s.engagement_score || 0).toFixed(1)}
            </span>
          ) : (
            <span className='text-gray-400'>—</span>
          ),
      },
      {
        title: '等级',
        key: 'level',
        dataIndex: 'level',
        render: (_, s) => (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${engagementLevelBadge(s.level)}`}>
            {s.level === 'high' ? '高' : s.level === 'medium' ? '中' : '低'}
          </span>
        ),
      },
      {
        title: '出勤率',
        key: 'attendance_rate',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.attendance_rate != null
              ? `${(s.components.attendance_rate * 100).toFixed(0)}%`
              : '—'}
          </span>
        ),
      },
      {
        title: '作业率',
        key: 'homework_rate',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.homework_rate != null
              ? `${(s.components.homework_rate * 100).toFixed(0)}%`
              : '—'}
          </span>
        ),
      },
      {
        title: '活跃度',
        key: 'activity_rate',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.activity_rate != null
              ? `${(s.components.activity_rate * 100).toFixed(0)}%`
              : '—'}
          </span>
        ),
      },
      {
        title: '请假(天)',
        key: 'leave_days',
        render: (_, s) => (
          <span className='text-gray-600 dark:text-slate-300'>
            {s.components?.leave_days ?? 0}
          </span>
        ),
      },
      {
        title: '周趋势',
        key: 'trend_action',
        width: 90,
        render: (_, s) => (
          <button
            type='button'
            disabled={!s.has_data}
            onClick={(e) => {
              e.stopPropagation();
              setEngagementTrendUserId(s.user_id);
            }}
            className={`text-xs px-2 py-1 rounded ${
              s.has_data
                ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 hover:bg-purple-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            查看
          </button>
        ),
      },
    ],
    []
  );

  // 主壳 → 各 Tab 子模块透传的全部依赖
  const deps: AlgorithmAnalysisDeps = {
    selectedClass,
    setSelectedClass,
    searchKeyword,
    loading,
    error,
    loadWarn,
    statistics,
    predictionData,
    riskStudents,
    predictionDays,
    filteredPredictions,
    filteredRiskStudents,
    anomalyData,
    ruleRecommendData,
    scorePredictData,
    riskPredictData,
    modelTrainingData,
    modelEvaluationData,
    trainingModel,
    evaluatingModel,
    trainRuleModel,
    evaluateRuleModel,
    trainScoreModel,
    evaluateScoreModel,
    trainRiskModel,
    evaluateRiskModel,
    ruleApplicationData,
    selectedUserId,
    setSelectedUserId,
    selectedBehaviorType,
    setSelectedBehaviorType,
    handleAdjustDistribution,
    handleApplyRule,
    batchAttribution,
    batchAttributionDays,
    setBatchAttributionDays,
    batchAttributionLoading,
    batchAttributionError,
    loadBatchAttribution,
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
    classes,
    students,
    selectedProfileUserId,
    setSelectedProfileUserId,
    studentProfile,
    setStudentProfile,
    profileLoading,
    profileError,
    loadStudentProfile,
    exporting,
    handleExport,
    predictionDetailColumns,
    scorePredictColumns,
    attributionColumns,
    engagementColumns,
  };

  return (
    <div className='space-y-6'>
      {/* 页面头部 */}
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-white'>智能分析</h1>
          <p className='text-gray-500 dark:text-slate-400 mt-1'>
            基于机器学习的学生行为与学业综合分析
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              placeholder='搜索学生姓名...'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className='pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
            />
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-gray-500 dark:text-slate-400 hidden sm:inline'>
              班级:
            </span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              aria-label='按班级筛选'
              data-testid='global-class-filter'
              className='px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'prediction') loadPrediction();
              else if (activeTab === 'anomaly') loadAnomaly();
              else loadStatistics();
            }}
            disabled={loading}
            className='p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors'
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div className='border-b border-gray-200 dark:border-slate-700'>
        <nav
          ref={tabNavRef}
          className='flex gap-6 overflow-x-auto'
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon className='w-4 h-4' />
              {tab.label}
              {tab.new && (
                <span className='px-1.5 py-0.5 text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full'>
                  NEW
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 预测和异常检测的特殊控制 */}
      {activeTab === 'prediction' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-blue-50/60 dark:bg-blue-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Target className='w-5 h-5 text-blue-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>预测天数:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setPredictionDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  predictionDays === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                {days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400'>
            <Brain className='w-4 h-4' />
            基于历史数据预测未来积分变化趋势
          </div>
        </div>
      )}

      {activeTab === 'anomaly' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-orange-50/60 dark:bg-orange-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Activity className='w-5 h-5 text-orange-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>检测范围:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setAnomalyDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  anomalyDays === days
                    ? 'bg-orange-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400'>
            <Zap className='w-4 h-4' />
            自动检测积分异常变化
          </div>
        </div>
      )}

      {activeTab === 'ruleRecommend' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-purple-50/60 dark:bg-purple-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Lightbulb className='w-5 h-5 text-purple-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>分析周期:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRecommendDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recommendDays === days
                    ? 'bg-purple-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400'>
            <Sparkles className='w-4 h-4' />
            基于关联规则挖掘智能推荐积分规则
          </div>
        </div>
      )}

      {activeTab === 'scorePredict' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-blue-50/60 dark:bg-blue-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <BookOpen className='w-5 h-5 text-blue-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>分析周期:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRecommendDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recommendDays === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400'>
            <TrendingUp className='w-4 h-4' />
            基于积分数据预测学生考试成绩
          </div>
        </div>
      )}

      {activeTab === 'riskPredict' && (
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 bg-red-50/60 dark:bg-red-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <ShieldCheck className='w-5 h-5 text-red-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>评估周期:</span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setRecommendDays(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  recommendDays === days
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                近{days}天
              </button>
            ))}
          </div>
          <div className='sm:ml-auto flex items-center gap-2 text-sm text-red-600 dark:text-red-400'>
            <Bell className='w-4 h-4' />
            集成学习算法实现主动风险预警
          </div>
        </div>
      )}

      {/* 加载失败警示（不阻断内容） */}
      {loadWarn && !error && (
        <div className='bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 text-amber-700 dark:text-amber-300 flex items-center gap-2'>
          <AlertTriangle className='w-4 h-4 shrink-0' />
          部分数据加载失败（统计/班级/参与度趋势），当前展示可能不完整，请刷新重试
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className='bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4 text-red-600 dark:text-red-400'>
          {error}
        </div>
      )}

      {/* 内容区域 */}
      {!error && (
        <>
          {activeTab === 'statistics' && <StatisticsTab deps={deps} />}
          {activeTab === 'prediction' && <PredictionTab deps={deps} />}
          {activeTab === 'anomaly' && <AnomalyTab deps={deps} />}
          {activeTab === 'ruleRecommend' && <RuleRecommendTab deps={deps} />}
          {activeTab === 'scorePredict' && <ScorePredictTab deps={deps} />}
          {activeTab === 'riskPredict' && <RiskPredictTab deps={deps} />}
          {activeTab === 'modelManager' && <ModelManagerTab deps={deps} />}
          {activeTab === 'ruleApplication' && <RuleApplicationTab deps={deps} />}
          {activeTab === 'studentProfile' && <StudentProfileTab deps={deps} />}
          {activeTab === 'batchAttribution' && <BatchAttributionTab deps={deps} />}
          {activeTab === 'engagement' && <EngagementTab deps={deps} />}
        </>
      )}

      {/* 加载状态遮罩 */}
      {loading && (
        <div className='fixed inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-50 pointer-events-none'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-slate-700'>
            <Loader2 className='w-8 h-8 text-primary-500 animate-spin mx-auto' />
            <span className='ml-3 text-gray-500 dark:text-slate-400 mt-2 block text-center'>
              加载中...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
