import logger from '../utils/logger';
/**
 * 智能分析增强页面组件
 * 在原有算法分析基础上，增加预测和异常检测功能
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Target,
  RefreshCw,
  TrendingUp,
  Award,
  CheckCircle,
  TrendingDown,
  Activity,
  AlertCircle,
  LineChart,
  Bell,
  Lightbulb,
  BookOpen,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
  Brain,
  Zap,
  Sparkles,
  Search,
  AlertTriangle,
  UserCircle,
  Users,
  Download,
} from 'lucide-react';
// 注：LineChart 用于参与度分析 Tab 的周趋势折线图标识
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton } from '../components';
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
} from '../types';

const TABS = [
  { id: 'statistics', label: '统计分析', icon: BarChart3 },
  { id: 'prediction', label: '积分预测', icon: TrendingUp, new: true },
  { id: 'anomaly', label: '异常检测', icon: Activity, new: true },
  { id: 'ruleRecommend', label: '规则推荐', icon: Lightbulb, new: true },
  { id: 'scorePredict', label: '成绩预测', icon: BookOpen, new: true },
  { id: 'riskPredict', label: '风险评估', icon: ShieldCheck, new: true },
  { id: 'modelManager', label: '模型管理', icon: Brain, new: true },
  { id: 'ruleApplication', label: '智能规则应用', icon: Zap, new: true },
  { id: 'studentProfile', label: '学生画像', icon: UserCircle, new: true },
  { id: 'batchAttribution', label: '班级归因', icon: Users, new: true },
  { id: 'engagement', label: '参与度分析', icon: LineChart, new: true },
];

const SEVERITY_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  high: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50 dark:bg-red-500/10' },
  medium: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    light: 'bg-yellow-50 dark:bg-yellow-500/10',
  },
  low: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50 dark:bg-green-500/10' },
};

/**
 * 算法分析页可调阈值 / 目标值（集中管理，消除散落魔法数）。
 *
 * 说明：
 * - 评分分布的「分段边界」(90/80/70) 由后端 score_distribution_service 计算，
 *   此处 scoreDistributionTargets.label 仅作展示对齐；「目标占比」为教学管理目标，
 *   当前为前端单点维护常量。若需管理员后台可配置，应从后端 SystemConfig 下发
 *   （key 如 analysis.score_distribution_targets），本常量作为兜底默认值。
 * - scoreBands / scoreColorThresholds / engagementScoreThresholds / defaultDays
 *   均为展示与默认时间窗参数，集中在此便于统一调整。
 */
type ScoreBand = { label: string; min: number; max?: number; color: string };
const ANALYSIS_CONFIG = {
  // 评分分布目标占比（与后端 band key: excellent/good/medium/low 一一对应）
  scoreDistributionTargets: [
    { key: 'excellent', label: '90分以上', targetPct: 10, color: 'bg-green-500' },
    { key: 'good', label: '80分以上', targetPct: 30, color: 'bg-blue-500' },
    { key: 'medium', label: '70分以上', targetPct: 40, color: 'bg-yellow-500' },
    { key: 'low', label: '70分以下', targetPct: 20, color: 'bg-red-500' },
  ] as Array<{
    key: 'excellent' | 'good' | 'medium' | 'low';
    label: string;
    targetPct: number;
    color: string;
  }>,
  // 成绩分布预测分段（统计分析 Tab）
  scoreBands: [
    { label: '不及格', min: 0, max: 60, color: 'bg-red-500' },
    { label: '及格', min: 60, max: 70, color: 'bg-yellow-500' },
    { label: '良好', min: 70, max: 80, color: 'bg-blue-500' },
    { label: '优秀', min: 80, color: 'bg-green-500' },
  ] as ScoreBand[],
  // 预测成绩着色阈值
  scoreColorThresholds: { excellent: 80, good: 60 },
  // 参与度评分着色阈值
  engagementScoreThresholds: { high: 70, medium: 45 },
  // 各算法默认时间窗（天）
  defaultDays: { prediction: 7, anomaly: 30, recommend: 30 },
};

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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
      case 'up':
        return <ArrowUp className='w-4 h-4 text-green-500' />;
      case 'falling':
      case 'down':
        return <ArrowDown className='w-4 h-4 text-red-500' />;
      default:
        return <Minus className='w-4 h-4 text-gray-400' />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'rising':
      case 'up':
        return 'text-green-600 bg-green-50 dark:bg-green-500/10';
      case 'falling':
      case 'down':
        return 'text-red-600 bg-red-50 dark:bg-red-500/10';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-500/10';
    }
  };

  const renderStatistics = () => {
    if (loadWarn) {
      // 加载失败 ≠ 无数据：区分展示，避免引导用户"去导入数据"
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <BarChart3 className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>统计数据加载失败</p>
          <p className='text-sm mt-1'>请稍后重试，或检查后端服务是否可用</p>
        </div>
      );
    }
    if (!statistics) {
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <BarChart3 className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>暂无统计数据</p>
          <p className='text-sm mt-1'>请确保已导入学生数据</p>
        </div>
      );
    }

    return (
      <div className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>学生总数</div>
            <div className='text-3xl font-bold text-gray-800 dark:text-white mt-1'>
              {statistics.student_count != null ? statistics.student_count : '—'}
            </div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>平均行为积分</div>
            <div className='text-3xl font-bold text-blue-600 mt-1'>
              {statistics.avg_behavior_score != null
                ? statistics.avg_behavior_score.toFixed(1)
                : '—'}
            </div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>平均学业成绩</div>
            <div className='text-3xl font-bold text-green-600 mt-1'>
              {statistics.avg_academic_score != null
                ? statistics.avg_academic_score.toFixed(1)
                : '—'}
            </div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>积分-成绩相关性</div>
            <div className='text-3xl font-bold text-purple-600 mt-1'>
              {statistics.correlation != null ? statistics.correlation.toFixed(2) : '—'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrediction = () => {
    if (!predictionData) {
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <TrendingUp className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>暂无积分预测数据</p>
          <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
        </div>
      );
    }

    const { summary } = predictionData;
    const improvementCount = summary?.improvement_count ?? 0;
    const stableCount = summary?.stable_count ?? 0;
    const declineCount = summary?.decline_count ?? 0;

    return (
      <div className='space-y-6'>
        {/* 趋势统计 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <TrendingUp className='w-4 h-4 text-green-500' />
              上升趋势
            </div>
            <div className='text-3xl font-bold text-green-600'>{improvementCount}</div>
            <div className='text-xs text-gray-400 mt-1'>预计积分增加</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Minus className='w-4 h-4 text-gray-400' />
              稳定
            </div>
            <div className='text-3xl font-bold text-gray-600'>{stableCount}</div>
            <div className='text-xs text-gray-400 mt-1'>积分无明显变化</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <TrendingDown className='w-4 h-4 text-red-500' />
              下降趋势
            </div>
            <div className='text-3xl font-bold text-red-600'>{declineCount}</div>
            <div className='text-xs text-gray-400 mt-1'>预计积分减少</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Target className='w-4 h-4 text-blue-500' />
              风险学生
            </div>
            <div className='text-3xl font-bold text-orange-600'>{(riskStudents || []).length}</div>
            <div className='text-xs text-gray-400 mt-1'>需要关注</div>
          </div>
        </div>

        {/* 风险学生列表 */}
        {riskStudents.length > 0 && (
          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <AlertTriangle className='w-5 h-5 text-orange-500' />
                需要关注的学生
              </h3>
              <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                预测未来{predictionDays}天积分呈下降趋势的学生
              </p>
            </div>
            <div className='p-6'>
              <div className='space-y-3'>
                {filteredRiskStudents.map((student) => (
                  <div
                    key={student.user_id}
                    className='flex items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-500/5 rounded-lg border border-orange-200/50 dark:border-orange-500/20'
                  >
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          student.risk_level === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                      />
                      <div>
                        <div className='font-medium text-gray-800 dark:text-white'>
                          {student.name}
                        </div>
                        <div className='text-sm text-gray-500 dark:text-slate-400'>
                          {student.class_name}
                        </div>
                      </div>
                    </div>
                    <div className='text-right'>
                      <div
                        className={`flex items-center gap-1 font-medium ${
                          (student.predicted_change || 0) < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {(student.predicted_change || 0) < 0 ? (
                          <ArrowDown className='w-4 h-4' />
                        ) : (
                          <ArrowUp className='w-4 h-4' />
                        )}
                        {Math.abs(student.predicted_change || 0).toFixed(1)}分
                      </div>
                      <div className='text-xs text-gray-400'>
                        置信度: {((student.confidence || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 预测详情 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <LineChart className='w-5 h-5 text-blue-500' />
              积分预测详情
            </h3>
          </div>
          <div className='p-6'>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-gray-200 dark:border-slate-700'>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      学生
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      当前积分
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      趋势
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      预测变化
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      置信度
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.slice(0, 10).map((item) => {
                    // 防御式兜底：归一化函数已保证字段存在并默认为 0，但相邻的算术比较仍需安全值。
                    const current = typeof item.current_score === 'number' ? item.current_score : 0;
                    const predicted =
                      typeof item.predicted_score === 'number' ? item.predicted_score : current;
                    const trend = item.trend || 'stable';
                    const hasTrend = !!item.trend; // 趋势缺失显示 '--'，不冒充"稳定"
                    const confidence = typeof item.confidence === 'number' ? item.confidence : 0;
                    return (
                      <tr
                        key={`${item.user_id ?? item.name ?? ''}-${item.name ?? ''}`}
                        className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                      >
                        <td className='py-3 px-4'>
                          <div className='font-medium text-gray-800 dark:text-white'>
                            {item.name || '未知学生'}
                          </div>
                        </td>
                        <td className='py-3 px-4 font-medium text-gray-800 dark:text-white'>
                          {current.toFixed(1)}
                        </td>
                        <td className='py-3 px-4'>
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
                        </td>
                        <td className='py-3 px-4'>
                          <span
                            className={`font-medium ${
                              predicted > current
                                ? 'text-green-600'
                                : predicted < current
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {(predicted - current).toFixed(1)}分
                          </span>
                        </td>
                        <td className='py-3 px-4'>
                          <div className='w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                            <div
                              className='bg-blue-500 h-2 rounded-full'
                              style={{ width: `${confidence * 100}%` }}
                            />
                          </div>
                          <div className='text-xs text-gray-400 mt-1'>
                            {(confidence * 100).toFixed(0)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAnomaly = () => {
    if (!anomalyData) {
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <Activity className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>暂无异常检测数据</p>
          <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
        </div>
      );
    }

    const { summary, anomalies } = anomalyData;
    const safeSummary = summary || {
      total_anomalies: 0,
      high_severity_count: 0,
      medium_severity_count: 0,
      low_severity_count: 0,
    };
    const safeList = Array.isArray(anomalies) ? anomalies : [];
    const filteredAnomalies = searchKeyword
      ? safeList.filter((a) => (a?.name ?? '').toLowerCase().includes(searchKeyword.toLowerCase()))
      : safeList;

    return (
      <div className='space-y-6'>
        {/* 异常统计 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>异常总数</div>
            <div className='text-3xl font-bold text-red-600 mt-1'>
              {safeSummary.total_anomalies ?? 0}
            </div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>高严重度</div>
            <div className='text-3xl font-bold text-red-600 mt-1'>
              {safeSummary.high_severity_count ?? 0}
            </div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>中严重度</div>
            <div className='text-3xl font-bold text-yellow-600 mt-1'>
              {safeSummary.medium_severity_count ?? 0}
            </div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='text-sm text-gray-500 dark:text-slate-400'>低严重度</div>
            <div className='text-3xl font-bold text-green-600 mt-1'>
              {safeSummary.low_severity_count ?? 0}
            </div>
          </div>
        </div>

        {/* 异常列表 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <AlertCircle className='w-5 h-5 text-red-500' />
              异常记录列表
            </h3>
          </div>
          <div className='p-6'>
            {filteredAnomalies.length === 0 ? (
              <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
                <CheckCircle className='w-12 h-12 mx-auto mb-3 text-green-500' />
                <p>{searchKeyword ? '未找到匹配的记录' : '未检测到异常'}</p>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredAnomalies.map((anomaly, idx) => {
                  const aName = anomaly?.name ?? '未知学生';
                  const aType = anomaly?.anomaly_type ?? '异常';
                  const aSev = (anomaly?.severity ?? 'low') as 'high' | 'medium' | 'low';
                  const aColor = SEVERITY_COLORS[aSev] || { bg: '', text: '', light: '' };
                  const aDesc = anomaly?.description ?? '';
                  const aScoreNum =
                    typeof anomaly?.score_change === 'number' &&
                    Number.isFinite(anomaly.score_change)
                      ? anomaly.score_change
                      : 0;
                  const aDetected = anomaly?.detected_at ?? '';
                  return (
                    <div
                      key={`${aName}-${idx}`}
                      className='p-4 bg-red-50/50 dark:bg-red-500/5 rounded-lg border border-red-200/50 dark:border-red-500/20'
                    >
                      <div className='flex items-center justify-between mb-3'>
                        <div className='flex items-center gap-3'>
                          <div className='w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center'>
                            <AlertCircle className='w-4 h-4 text-red-600' />
                          </div>
                          <div>
                            <div className='font-medium text-gray-800 dark:text-white'>{aName}</div>
                            <div className='text-sm text-gray-500 dark:text-slate-400'>{aType}</div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            aColor.light ?? ''
                          } ${aColor.text ?? ''}`}
                        >
                          {aSev === 'high'
                            ? '高严重度'
                            : aSev === 'medium'
                            ? '中严重度'
                            : '低严重度'}
                        </span>
                      </div>

                      <div className='text-sm text-gray-600 dark:text-slate-300 mb-2'>{aDesc}</div>
                      <div className='flex items-center gap-4 text-xs text-gray-400'>
                        <span>
                          积分变化: {aScoreNum > 0 ? '+' : ''}
                          {aScoreNum}
                        </span>
                        <span>检测时间: {aDetected}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRuleRecommend = () => {
    if (!ruleRecommendData) {
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <Lightbulb className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>暂无规则推荐数据</p>
          <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
        </div>
      );
    }

    const { summary, recommendations } = ruleRecommendData;
    const safeSummary = summary ?? {
      total_recommendations: 0,
      avg_confidence: 0,
      estimated_total_impact: 0,
    };
    const safeRecommendations: any[] = Array.isArray(recommendations) ? recommendations : [];
    const filteredRecommendations = searchKeyword
      ? safeRecommendations.filter((r) =>
          String(r?.rule_name ?? '')
            .toLowerCase()
            .includes(searchKeyword.toLowerCase())
        )
      : safeRecommendations;

    return (
      <div className='space-y-6'>
        {/* 推荐统计 */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Sparkles className='w-4 h-4 text-purple-500' />
              总推荐数
            </div>
            <div className='text-3xl font-bold text-purple-600'>
              {safeSummary.total_recommendations}
            </div>
            <div className='text-xs text-gray-400 mt-1'>智能推荐</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Zap className='w-4 h-4 text-yellow-500' />
              平均置信度
            </div>
            <div className='text-3xl font-bold text-yellow-600'>
              {((safeSummary.avg_confidence || 0) * 100).toFixed(0)}%
            </div>
            <div className='text-xs text-gray-400 mt-1'>推荐可信度</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Target className='w-4 h-4 text-blue-500' />
              预计影响
            </div>
            <div className='text-3xl font-bold text-blue-600'>
              {safeSummary.estimated_total_impact}
            </div>
            <div className='text-xs text-gray-400 mt-1'>积分变化</div>
          </div>
        </div>

        {/* 规则推荐列表 */}
        {filteredRecommendations.length > 0 ? (
          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <Lightbulb className='w-5 h-5 text-green-500' />
                规则推荐列表
              </h3>
              <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                根据数据分析推荐的规则调整建议
              </p>
            </div>
            <div className='p-6'>
              <div className='space-y-4'>
                {filteredRecommendations.map((rule, idx) => {
                  const ruleId = rule?.rule_id ?? `idx-${idx}`;
                  const ruleName = rule?.rule_name ?? '未命名规则';
                  const ruleCategory = rule?.category ?? '未分类';
                  const ruleDesc = rule?.description ?? '';
                  const ruleConfidence =
                    typeof rule?.confidence === 'number' && Number.isFinite(rule.confidence)
                      ? rule.confidence
                      : 0;
                  const ruleImpact =
                    typeof rule?.estimated_impact === 'number' &&
                    Number.isFinite(rule.estimated_impact)
                      ? rule.estimated_impact
                      : 0;
                  return (
                    <div
                      key={ruleId}
                      className='p-4 bg-green-50/50 dark:bg-green-500/5 rounded-lg border border-green-200/50 dark:border-green-500/20'
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <div>
                          <div className='font-medium text-gray-800 dark:text-white'>
                            {ruleName}
                          </div>
                          <div className='text-sm text-gray-500 dark:text-slate-400'>
                            {ruleCategory}
                          </div>
                        </div>
                        <span className='px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-600'>
                          置信度: {(ruleConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-3'>
                        <div>
                          <div className='text-gray-500 dark:text-slate-400'>预计影响</div>
                          <div
                            className={`font-medium ${
                              ruleImpact > 0
                                ? 'text-green-600'
                                : ruleImpact < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {ruleImpact > 0 ? '+' : ''}
                            {ruleImpact}分
                          </div>
                        </div>
                      </div>
                      <div className='text-sm text-gray-600 dark:text-slate-300'>{ruleDesc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <CheckCircle className='w-12 h-12 mx-auto mb-3 text-green-500' />
            <p>暂无规则推荐建议</p>
            <p className='text-sm mt-1'>当前规则体系运行良好</p>
          </div>
        )}
      </div>
    );
  };

  const renderScorePredict = () => {
    if (!scorePredictData) {
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <BookOpen className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>暂无成绩预测数据</p>
          <p className='text-sm mt-1'>请确保已有足够的积分记录和考试数据</p>
        </div>
      );
    }

    const { summary, predictions } = scorePredictData;
    const filteredPredictions = searchKeyword
      ? predictions.filter((p) => p.name.toLowerCase().includes(searchKeyword.toLowerCase()))
      : predictions;

    return (
      <div className='space-y-6'>
        {/* 预测统计 */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <BookOpen className='w-4 h-4 text-blue-500' />
              当前平均分
            </div>
            <div className='text-3xl font-bold text-blue-600'>
              {(summary.avg_current_score ?? null) != null
                ? summary.avg_current_score.toFixed(1)
                : '—'}
            </div>
            <div className='text-xs text-gray-400 mt-1'>现有成绩</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <TrendingUp className='w-4 h-4 text-green-500' />
              平均分预测
            </div>
            <div className='text-3xl font-bold text-green-600'>
              {(summary.avg_predicted_score ?? null) != null
                ? summary.avg_predicted_score.toFixed(1)
                : '—'}
            </div>
            <div className='text-xs text-gray-400 mt-1'>预计考试分数</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Award className='w-4 h-4 text-purple-500' />
              涉及科目
            </div>
            <div className='text-3xl font-bold text-purple-600'>
              {summary.subjects && summary.subjects.length > 0 ? summary.subjects.length : '综合'}
            </div>
            <div className='text-xs text-gray-400 mt-1'>
              {summary.subjects && summary.subjects.length > 0
                ? summary.subjects.join(', ')
                : '综合评分'}
            </div>
          </div>
        </div>

        {/* 成绩分布 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <BarChart3 className='w-5 h-5 text-blue-500' />
              成绩分布预测
            </h3>
          </div>
          <div className='p-6'>
            <div className='space-y-3'>
              {ANALYSIS_CONFIG.scoreBands.map((item, idx) => {
                const count = predictions.filter(
                  (p) =>
                    (p.predicted_score ?? 0) >= item.min &&
                    (item.max === undefined || (p.predicted_score ?? 0) < item.max)
                ).length;
                const percent = predictions.length > 0 ? (count / predictions.length) * 100 : 0;
                return (
                  <div key={idx}>
                    <div className='flex items-center justify-between text-sm mb-1'>
                      <span className='text-gray-600 dark:text-slate-300'>{item.label}</span>
                      <span className='text-gray-500 dark:text-slate-400'>
                        {count}人 ({percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className='w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3'>
                      <div
                        className={`${item.color} h-3 rounded-full transition-all`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 预测详情 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <LineChart className='w-5 h-5 text-blue-500' />
              学生成绩预测详情
            </h3>
          </div>
          <div className='p-6'>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-gray-200 dark:border-slate-700'>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      学生
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      科目
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      当前分数
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      预测分数
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      趋势
                    </th>
                    <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                      置信度
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.slice(0, 15).map((item, idx) => {
                    // 后端即使经 api.ts 归一化，仍可能因历史脏数据/缓存返回 undefined；兜底保证渲染不崩。
                    const currentNum =
                      typeof item.current_score === 'number' && Number.isFinite(item.current_score)
                        ? item.current_score
                        : 0;
                    const predictedNum =
                      typeof item.predicted_score === 'number' &&
                      Number.isFinite(item.predicted_score)
                        ? item.predicted_score
                        : 0;
                    const trendKey: 'up' | 'down' | 'stable' =
                      item.trend === 'up' || item.trend === 'down' ? item.trend : 'stable';
                    const confidenceNum =
                      typeof item.confidence === 'number' && Number.isFinite(item.confidence)
                        ? item.confidence
                        : 0;
                    return (
                      <tr
                        key={idx}
                        className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                      >
                        <td className='py-3 px-4'>
                          <div className='font-medium text-gray-800 dark:text-white'>
                            {item.name}
                          </div>
                        </td>
                        <td className='py-3 px-4'>
                          <div className='font-medium text-gray-800 dark:text-white'>
                            {item.subject || '综合'}
                          </div>
                        </td>
                        <td className='py-3 px-4'>
                          <span className='text-lg font-medium text-gray-600'>
                            {currentNum.toFixed(1)}
                          </span>
                        </td>
                        <td className='py-3 px-4'>
                          <span
                            className={`text-xl font-bold ${
                              predictedNum >= ANALYSIS_CONFIG.scoreColorThresholds.excellent
                                ? 'text-green-600'
                                : predictedNum >= ANALYSIS_CONFIG.scoreColorThresholds.good
                                ? 'text-blue-600'
                                : 'text-red-600'
                            }`}
                          >
                            {predictedNum.toFixed(1)}
                          </span>
                        </td>
                        <td className='py-3 px-4'>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(
                              trendKey
                            )}`}
                          >
                            {getTrendIcon(trendKey)}
                            {trendKey === 'up' ? '上升' : trendKey === 'down' ? '下降' : '稳定'}
                          </span>
                        </td>
                        <td className='py-3 px-4'>
                          <div className='w-16 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                            <div
                              className='bg-blue-500 h-2 rounded-full'
                              style={{ width: `${confidenceNum * 100}%` }}
                            />
                          </div>
                          <div className='text-xs text-gray-400 mt-1'>
                            {(confidenceNum * 100).toFixed(0)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRiskPredict = () => {
    if (!riskPredictData) {
      return (
        <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
          <ShieldCheck className='w-12 h-12 mx-auto mb-3 text-gray-400' />
          <p>暂无风险评估数据</p>
          <p className='text-sm mt-1'>请确保已有足够的积分记录数据</p>
        </div>
      );
    }

    // 后端字段名与前端类型不一致，已在 api.getBatchRiskPredict 中归一化；
    // 此处仍做一层兜底，防止后端形状再次变动时整页崩溃。
    const summary = riskPredictData.summary ?? {
      high_risk_count: 0,
      medium_risk_count: 0,
      low_risk_count: 0,
      avg_risk_score: 0,
    };
    const risks = Array.isArray(riskPredictData.risks) ? riskPredictData.risks : [];
    const filteredResults = searchKeyword
      ? risks.filter((r) => (r.name ?? '').toLowerCase().includes(searchKeyword.toLowerCase()))
      : risks;
    const totalStudents =
      summary.high_risk_count + summary.medium_risk_count + summary.low_risk_count;

    return (
      <div className='space-y-6'>
        {/* 导出 */}
        <div className='flex items-center justify-between'>
          <p className='text-sm text-gray-500 dark:text-slate-400'>
            基于多维度综合评估（积分趋势 / 行为 / 出勤）
          </p>
          <button
            onClick={() => handleExport('risk', 30)}
            disabled={exporting !== null}
            className='px-4 py-2 rounded-lg border border-red-400 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5'
          >
            <Download className='w-4 h-4' />
            {exporting === 'risk' ? '导出中...' : '导出 Excel'}
          </button>
        </div>
        {/* 风险统计 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <ShieldCheck className='w-4 h-4 text-blue-500' />
              评估学生数
            </div>
            <div className='text-3xl font-bold text-blue-600'>{totalStudents}</div>
            <div className='text-xs text-gray-400 mt-1'>参与风险评估</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <AlertTriangle className='w-4 h-4 text-red-500' />
              高风险
            </div>
            <div className='text-3xl font-bold text-red-600'>{summary.high_risk_count}</div>
            <div className='text-xs text-gray-400 mt-1'>需要立即干预</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <Bell className='w-4 h-4 text-yellow-500' />
              中风险
            </div>
            <div className='text-3xl font-bold text-yellow-600'>{summary.medium_risk_count}</div>
            <div className='text-xs text-gray-400 mt-1'>需要关注</div>
          </div>
          <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2'>
              <CheckCircle className='w-4 h-4 text-green-500' />
              低风险
            </div>
            <div className='text-3xl font-bold text-green-600'>{summary.low_risk_count}</div>
            <div className='text-xs text-gray-400 mt-1'>正常关注</div>
          </div>
        </div>

        {/* 风险学生列表 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <AlertTriangle className='w-5 h-5 text-red-500' />
              风险学生评估结果
            </h3>
            <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
              基于多维度综合评估，识别需要关注的学生
            </p>
          </div>
          <div className='p-6'>
            {filteredResults.length === 0 ? (
              <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
                <CheckCircle className='w-12 h-12 mx-auto mb-3 text-green-500' />
                <p>{searchKeyword ? '未找到匹配的学生' : '暂无风险学生'}</p>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredResults.map((student, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      student.risk_level === 'high'
                        ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20'
                        : student.risk_level === 'medium'
                        ? 'bg-yellow-50/50 dark:bg-yellow-500/5 border-yellow-200/50 dark:border-yellow-500/20'
                        : 'bg-green-50/50 dark:bg-green-500/5 border-green-200/50 dark:border-green-500/20'
                    }`}
                  >
                    <div className='flex items-center justify-between mb-3'>
                      <div className='flex items-center gap-3'>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            student.risk_level === 'high'
                              ? 'bg-red-500'
                              : student.risk_level === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                        />
                        <div>
                          <div className='font-medium text-gray-800 dark:text-white'>
                            {student.name}
                          </div>
                          <div className='text-sm text-gray-500 dark:text-slate-400'>
                            风险评分:{' '}
                            {student.risk_score != null ? student.risk_score.toFixed(1) : '—'}
                          </div>
                        </div>
                      </div>
                      <div className='text-right'>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            student.risk_level === 'high'
                              ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
                              : student.risk_level === 'medium'
                              ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600'
                              : 'bg-green-100 dark:bg-green-500/20 text-green-600'
                          }`}
                        >
                          {student.risk_level === 'high'
                            ? '高风险'
                            : student.risk_level === 'medium'
                            ? '中风险'
                            : '低风险'}
                        </span>
                      </div>
                    </div>

                    {/* 风险因素 */}
                    {(student.contributing_factors?.length ?? 0) > 0 && (
                      <div className='mb-3'>
                        <div className='text-xs font-medium text-gray-500 dark:text-slate-400 mb-2'>
                          风险因素
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          {(student.contributing_factors ?? []).slice(0, 3).map((factor, fIdx) => (
                            <span
                              key={fIdx}
                              className='px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 推荐行动 */}
                    {(student.recommended_actions?.length ?? 0) > 0 && (
                      <div className='pt-3 border-t border-gray-200/50 dark:border-gray-700/50'>
                        <div className='text-xs font-medium text-gray-500 dark:text-slate-400 mb-2'>
                          推荐行动
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          {(student.recommended_actions ?? []).map((action, aIdx) => (
                            <span
                              key={aIdx}
                              className='px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                            >
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 风险分布 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <BarChart3 className='w-5 h-5 text-blue-500' />
              风险分布
            </h3>
          </div>
          <div className='p-6'>
            <div className='flex items-center justify-center gap-8'>
              {[
                {
                  level: '高风险',
                  count: summary.high_risk_count,
                  color: 'bg-red-500',
                  light: 'bg-red-100 dark:bg-red-500/20',
                },
                {
                  level: '中风险',
                  count: summary.medium_risk_count,
                  color: 'bg-yellow-500',
                  light: 'bg-yellow-100 dark:bg-yellow-500/20',
                },
                {
                  level: '低风险',
                  count: summary.low_risk_count,
                  color: 'bg-green-500',
                  light: 'bg-green-100 dark:bg-green-500/20',
                },
              ].map((item, idx) => {
                const percent = totalStudents > 0 ? (item.count / totalStudents) * 100 : 0;
                return (
                  <div key={idx} className='text-center'>
                    <div
                      className={`w-20 h-20 rounded-full ${item.color} flex items-center justify-center mx-auto mb-2`}
                    >
                      <span className='text-white font-bold text-lg'>{item.count}</span>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${item.light} ${
                        item.level === '高风险'
                          ? 'text-red-600'
                          : item.level === '中风险'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {item.level}
                    </div>
                    <div className='text-xs text-gray-400 mt-1'>{percent.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染模型管理页面
  const renderModelManager = () => {
    return (
      <div className='space-y-6'>
        {/* 模型管理说明 */}
        <div className='bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-xl p-6 border border-blue-200/50 dark:border-blue-500/20'>
          <div className='flex items-start gap-4'>
            <Brain className='w-6 h-6 text-blue-500 mt-1' />
            <div>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-2'>
                模型管理中心
              </h3>
              <p className='text-sm text-gray-600 dark:text-slate-300'>
                在这里可以训练和评估智能分析系统的机器学习模型。建议在以下情况重新训练模型：
              </p>
              <ul className='mt-2 text-sm text-gray-600 dark:text-slate-300 space-y-1'>
                <li>• 系统首次部署后</li>
                <li>• 数据分布发生显著变化时（如学期初、学期末）</li>
                <li>• 模型预测效果下降时</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 规则推荐模型 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <Lightbulb className='w-5 h-5 text-purple-500' />
              规则推荐模型
            </h3>
          </div>
          <div className='p-6 space-y-4'>
            <div className='flex flex-col sm:flex-row sm:items-end gap-4'>
              <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  训练数据天数
                </label>
                <select
                  className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                  defaultValue='90'
                >
                  <option value='30'>30天</option>
                  <option value='60'>60天</option>
                  <option value='90'>90天</option>
                  <option value='180'>180天</option>
                </select>
              </div>
              <div className='flex flex-wrap gap-2'>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={() => trainRuleModel(90)}
                  disabled={trainingModel === 'ruleRecommend'}
                  className='px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                  {trainingModel === 'ruleRecommend' ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      训练中...
                    </>
                  ) : (
                    <>
                      <Zap className='w-4 h-4' />
                      训练模型
                    </>
                  )}
                </PermissionButton>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={() => evaluateRuleModel(30)}
                  disabled={evaluatingModel === 'ruleRecommend'}
                  className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                  {evaluatingModel === 'ruleRecommend' ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      评估中...
                    </>
                  ) : (
                    <>
                      <TrendingUp className='w-4 h-4' />
                      评估模型
                    </>
                  )}
                </PermissionButton>
              </div>
            </div>

            {/* 训练结果 */}
            {modelTrainingData.ruleRecommend && (
              <div className='bg-purple-50/50 dark:bg-purple-500/10 rounded-lg p-4 border border-purple-200/50 dark:border-purple-500/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <CheckCircle className='w-5 h-5 text-green-500' />
                  <span className='font-medium text-gray-800 dark:text-white'>训练完成</span>
                </div>
                <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                  {JSON.stringify(modelTrainingData.ruleRecommend, null, 2)}
                </pre>
              </div>
            )}

            {/* 评估结果 */}
            {modelEvaluationData.ruleRecommend && (
              <div className='bg-blue-50/50 dark:bg-blue-500/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-500/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <TrendingUp className='w-5 h-5 text-blue-500' />
                  <span className='font-medium text-gray-800 dark:text-white'>评估结果</span>
                </div>
                <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                  {JSON.stringify(modelEvaluationData.ruleRecommend, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* 成绩预测模型 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <BookOpen className='w-5 h-5 text-blue-500' />
              成绩预测模型
            </h3>
          </div>
          <div className='p-6 space-y-4'>
            <div className='flex flex-col sm:flex-row sm:items-end gap-4'>
              <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  训练数据天数
                </label>
                <select
                  className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  defaultValue='90'
                >
                  <option value='30'>30天</option>
                  <option value='60'>60天</option>
                  <option value='90'>90天</option>
                  <option value='180'>180天</option>
                </select>
              </div>
              <div className='flex flex-wrap gap-2'>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={() => trainScoreModel(90)}
                  disabled={trainingModel === 'scorePredict'}
                  className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                  {trainingModel === 'scorePredict' ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      训练中...
                    </>
                  ) : (
                    <>
                      <Zap className='w-4 h-4' />
                      训练模型
                    </>
                  )}
                </PermissionButton>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={() => evaluateScoreModel(30)}
                  disabled={evaluatingModel === 'scorePredict'}
                  className='px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                  {evaluatingModel === 'scorePredict' ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      评估中...
                    </>
                  ) : (
                    <>
                      <TrendingUp className='w-4 h-4' />
                      评估模型
                    </>
                  )}
                </PermissionButton>
              </div>
            </div>

            {/* 训练结果 */}
            {modelTrainingData.scorePredict && (
              <div className='bg-blue-50/50 dark:bg-blue-500/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-500/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <CheckCircle className='w-5 h-5 text-green-500' />
                  <span className='font-medium text-gray-800 dark:text-white'>训练完成</span>
                </div>
                <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                  {JSON.stringify(modelTrainingData.scorePredict, null, 2)}
                </pre>
              </div>
            )}

            {/* 评估结果 */}
            {modelEvaluationData.scorePredict && (
              <div className='bg-green-50/50 dark:bg-green-500/10 rounded-lg p-4 border border-green-200/50 dark:border-green-500/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <TrendingUp className='w-5 h-5 text-green-500' />
                  <span className='font-medium text-gray-800 dark:text-white'>评估结果</span>
                </div>
                <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                  {JSON.stringify(modelEvaluationData.scorePredict, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* 风险预测模型 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <ShieldCheck className='w-5 h-5 text-red-500' />
              风险预测模型
            </h3>
          </div>
          <div className='p-6 space-y-4'>
            <div className='flex items-center gap-4'>
              <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  训练数据天数
                </label>
                <select
                  className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500'
                  defaultValue='90'
                >
                  <option value='30'>30天</option>
                  <option value='60'>60天</option>
                  <option value='90'>90天</option>
                  <option value='180'>180天</option>
                </select>
              </div>
              <div className='flex gap-2'>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={() => trainRiskModel(90)}
                  disabled={trainingModel === 'riskPredict'}
                  className='px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                  {trainingModel === 'riskPredict' ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      训练中...
                    </>
                  ) : (
                    <>
                      <Zap className='w-4 h-4' />
                      训练模型
                    </>
                  )}
                </PermissionButton>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={() => evaluateRiskModel(30)}
                  disabled={evaluatingModel === 'riskPredict'}
                  className='px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
                >
                  {evaluatingModel === 'riskPredict' ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      评估中...
                    </>
                  ) : (
                    <>
                      <TrendingUp className='w-4 h-4' />
                      评估模型
                    </>
                  )}
                </PermissionButton>
              </div>
            </div>

            {/* 训练结果 */}
            {modelTrainingData.riskPredict && (
              <div className='bg-red-50/50 dark:bg-red-500/10 rounded-lg p-4 border border-red-200/50 dark:border-red-500/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <CheckCircle className='w-5 h-5 text-green-500' />
                  <span className='font-medium text-gray-800 dark:text-white'>训练完成</span>
                </div>
                <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                  {JSON.stringify(modelTrainingData.riskPredict, null, 2)}
                </pre>
              </div>
            )}

            {/* 评估结果 */}
            {modelEvaluationData.riskPredict && (
              <div className='bg-orange-50/50 dark:bg-orange-500/10 rounded-lg p-4 border border-orange-200/50 dark:border-orange-500/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <TrendingUp className='w-5 h-5 text-orange-500' />
                  <span className='font-medium text-gray-800 dark:text-white'>评估结果</span>
                </div>
                <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                  {JSON.stringify(modelEvaluationData.riskPredict, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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

  const renderRuleApplication = () => {
    const stats = ruleApplicationData.scoreDistributionStats as {
      success?: boolean;
      total_students?: number;
      distribution?: { excellent: number; good: number; medium: number; low: number };
      counts?: { excellent: number; good: number; medium: number; low: number };
      statistics?: { avg: number; std: number; min: number; max: number };
    };

    const earningRules = Array.isArray(ruleApplicationData.earningRules)
      ? (ruleApplicationData.earningRules as Array<{
          behavior_type: string;
          base_score: number;
          variance: number;
          description: string;
        }>)
      : [];

    const spendingRules = Array.isArray(ruleApplicationData.spendingRules)
      ? (ruleApplicationData.spendingRules as Array<{
          spending_type: string;
          base_cost: number;
          min_score: number;
          description: string;
        }>)
      : [];

    const rewardTypes = Array.isArray(ruleApplicationData.rewardTypes)
      ? (ruleApplicationData.rewardTypes as Array<{
          type: string;
          name: string;
          cost: number;
          min_rank: number;
          description: string;
        }>)
      : [];

    const students = ruleApplicationData.students || [];

    return (
      <div className='space-y-6'>
        <div className='bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-xl p-6 border border-purple-200/50 dark:border-purple-500/20'>
          <div className='flex items-start gap-4'>
            <Zap className='w-6 h-6 text-purple-500 mt-1' />
            <div>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-2'>
                智能规则自动应用中心
              </h3>
              <p className='text-sm text-gray-600 dark:text-slate-300'>
                基于规则推荐模型的智能应用，自动匹配并执行积分规则，控制评分分布，构建完整的积分生态闭环。
              </p>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <Target className='w-5 h-5 text-blue-500' />
                评分分布统计
              </h3>
              <PermissionButton
                permission='algorithm.manage'
                onClick={handleAdjustDistribution}
                className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm transition-colors flex items-center gap-2'
              >
                <RefreshCw className='w-4 h-4' />
                调整分布
              </PermissionButton>
            </div>
            <div className='p-6'>
              {stats && (stats as { success?: boolean }).success ? (
                <>
                  <div className='grid grid-cols-2 gap-4 mb-4'>
                    <div className='bg-green-50 dark:bg-green-500/10 rounded-lg p-4'>
                      <div className='text-sm text-gray-500 dark:text-slate-400'>学生总数</div>
                      <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                        {stats.total_students}
                      </div>
                    </div>
                    <div className='bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4'>
                      <div className='text-sm text-gray-500 dark:text-slate-400'>平均分</div>
                      <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                        {stats.statistics?.avg || 0}
                      </div>
                    </div>
                  </div>
                  <div className='space-y-3'>
                    {ANALYSIS_CONFIG.scoreDistributionTargets.map((t) => {
                      const cnt = (stats.counts?.[t.key] as number) || 0;
                      const pct = ((stats.distribution?.[t.key] as number) || 0) * 100;
                      return (
                        <div key={t.key}>
                          <div className='flex justify-between text-sm mb-1'>
                            <span className='text-gray-600 dark:text-slate-400'>
                              {t.label} (目标{t.targetPct}%)
                            </span>
                            <span className='text-gray-800 dark:text-white'>
                              {cnt}人 ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className='w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2'>
                            <div
                              className={`${t.color} h-2 rounded-full`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
                  <Target className='w-12 h-12 mx-auto mb-3 text-gray-400' />
                  <p>暂无评分分布数据</p>
                  <p className='text-xs mt-1 text-gray-400 dark:text-slate-500'>
                    需学生已有积分/成绩记录；可在右侧「规则应用控制」选择学生执行规则，或点击「调整分布」生成
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <Zap className='w-5 h-5 text-purple-500' />
                规则应用控制
              </h3>
            </div>
            <div className='p-6 space-y-4'>
              <>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                    选择学生
                  </label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) =>
                      setSelectedUserId(e.target.value ? Number(e.target.value) : null)
                    }
                    className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                  >
                    <option value=''>请选择学生</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.class_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                    行为类型
                  </label>
                  <select
                    value={selectedBehaviorType}
                    onChange={(e) => setSelectedBehaviorType(e.target.value)}
                    className='w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                  >
                    {earningRules.map((rule) => (
                      <option key={rule.behavior_type} value={rule.behavior_type}>
                        {rule.description} (+{rule.base_score}分)
                      </option>
                    ))}
                  </select>
                </div>
                <PermissionButton
                  permission='algorithm.manage'
                  onClick={handleApplyRule}
                  disabled={!selectedUserId || ruleApplicationData.applyingRule}
                  className='w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
                >
                  {ruleApplicationData.applyingRule ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      应用中...
                    </>
                  ) : (
                    <>
                      <Zap className='w-4 h-4' />
                      应用规则
                    </>
                  )}
                </PermissionButton>
                {ruleApplicationData.applyingResult && (
                  <div className='bg-purple-50/50 dark:bg-purple-500/10 rounded-lg p-4 border border-purple-200/50 dark:border-purple-500/20'>
                    <div className='flex items-center gap-2 mb-2'>
                      <CheckCircle className='w-5 h-5 text-green-500' />
                      <span className='font-medium text-gray-800 dark:text-white'>应用结果</span>
                    </div>
                    <pre className='text-sm text-gray-600 dark:text-slate-300 overflow-auto'>
                      {JSON.stringify(ruleApplicationData.applyingResult, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <ArrowUp className='w-5 h-5 text-green-500' />
                积分获取途径 ({earningRules.length})
              </h3>
            </div>
            <div className='p-6'>
              <div className='space-y-3'>
                {earningRules.map((rule) => (
                  <div
                    key={rule.behavior_type}
                    className='bg-green-50/50 dark:bg-green-500/10 rounded-lg p-3'
                  >
                    <div className='flex justify-between items-center'>
                      <span className='font-medium text-gray-800 dark:text-white'>
                        {rule.description}
                      </span>
                      <span className='text-green-600 dark:text-green-400 font-bold'>
                        +{rule.base_score}
                      </span>
                    </div>
                    <div className='text-xs text-gray-500 dark:text-slate-400 mt-1'>
                      波动范围: ±{rule.variance}分
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <ArrowDown className='w-5 h-5 text-red-500' />
                积分消费渠道 ({spendingRules.length})
              </h3>
            </div>
            <div className='p-6'>
              <div className='space-y-3'>
                {spendingRules.map((rule) => (
                  <div
                    key={rule.spending_type}
                    className='bg-red-50/50 dark:bg-red-500/10 rounded-lg p-3'
                  >
                    <div className='flex justify-between items-center'>
                      <span className='font-medium text-gray-800 dark:text-white'>
                        {rule.description}
                      </span>
                      <span className='text-red-600 dark:text-red-400 font-bold'>
                        -{rule.base_cost}
                      </span>
                    </div>
                    <div className='text-xs text-gray-500 dark:text-slate-400 mt-1'>
                      最低积分: {rule.min_score}分
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <Award className='w-5 h-5 text-yellow-500' />
                奖励类型 ({rewardTypes.length})
              </h3>
            </div>
            <div className='p-6'>
              <div className='space-y-3'>
                {rewardTypes.map((reward) => (
                  <div
                    key={reward.type}
                    className='bg-yellow-50/50 dark:bg-yellow-500/10 rounded-lg p-3'
                  >
                    <div className='flex justify-between items-center'>
                      <span className='font-medium text-gray-800 dark:text-white'>
                        {reward.name}
                      </span>
                      <span className='text-yellow-600 dark:text-yellow-400 font-bold'>
                        {reward.cost}分
                      </span>
                    </div>
                    <div className='text-xs text-gray-500 dark:text-slate-400 mt-1'>
                      {reward.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
              <Sparkles className='w-5 h-5 text-orange-500' />
              特殊场景处理 - 手机拿取奖励
            </h3>
          </div>
          <div className='p-6'>
            <div className='bg-orange-50 dark:bg-orange-500/10 rounded-lg p-4 mb-4'>
              <p className='text-sm text-gray-600 dark:text-slate-300'>
                手机拿取行为是一种特殊奖励行为，学生可以通过排名获得相应奖励，使用该奖励后自动扣取积分。
                单次扣取幅度控制在总分的5%-15%范围内，确保形成明显的分数下降效果，激励学生通过后续良好表现增加积分。
              </p>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg'>
                <div className='w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center'>
                  <TrendingUp className='w-5 h-5 text-green-600 dark:text-green-400' />
                </div>
                <div>
                  <div className='text-sm font-medium text-gray-800 dark:text-white'>正向激励</div>
                  <div className='text-xs text-gray-500 dark:text-slate-400'>
                    模型运行良好时分数正常提升
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg'>
                <div className='w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center'>
                  <TrendingDown className='w-5 h-5 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <div className='text-sm font-medium text-gray-800 dark:text-white'>
                    手机拿取扣分
                  </div>
                  <div className='text-xs text-gray-500 dark:text-slate-400'>
                    单次扣5%-15%，效果明显
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg'>
                <div className='w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center'>
                  <Activity className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                </div>
                <div>
                  <div className='text-sm font-medium text-gray-800 dark:text-white'>波动控制</div>
                  <div className='text-xs text-gray-500 dark:text-slate-400'>
                    波动幅度控制在±20%以内
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBatchAttribution = () => {
    const data = batchAttribution;
    const students = data?.students || [];
    const failed = data?.failed_students || [];
    const topFactors = (s: BatchAttributionStudent) =>
      (s.factors || [])
        .slice(0, 2)
        .map((f) => `${f.name}${f.contribution >= 0 ? '+' : ''}${f.contribution.toFixed(1)}`)
        .join('、') || '—';

    return (
      <div className='space-y-6'>
        {/* 控制区 */}
        <div className='flex flex-col sm:flex-row sm:items-end gap-4 bg-purple-50/60 dark:bg-purple-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <Users className='w-5 h-5 text-purple-500' />
            <label
              htmlFor='batch-attribution-class'
              className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
            >
              选择班级:
            </label>
            <select
              id='batch-attribution-class'
              data-testid='batch-attribution-class-select'
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className='px-3 py-1.5 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[140px]'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
            {selectedClass && (
              <button
                type='button'
                onClick={() => setSelectedClass('')}
                className='text-xs text-purple-600 dark:text-purple-400 hover:underline'
                title='清除选择'
              >
                清除
              </button>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <label
              htmlFor='batch-attribution-days'
              className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
            >
              归因窗口(天):
            </label>
            <input
              id='batch-attribution-days'
              data-testid='batch-attribution-days-input'
              type='number'
              min={7}
              max={180}
              value={batchAttributionDays}
              onChange={(e) => setBatchAttributionDays(Number(e.target.value) || 30)}
              className='w-20 px-2 py-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white'
            />
          </div>
          <button
            onClick={() => loadBatchAttribution()}
            disabled={batchAttributionLoading || !selectedClass}
            className='px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors'
          >
            {batchAttributionLoading ? '归因中...' : '生成全班成绩波动归因'}
          </button>
          <button
            onClick={() => handleExport('attribution', batchAttributionDays)}
            disabled={exporting !== null || !selectedClass}
            className='px-4 py-2 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5'
          >
            <Download className='w-4 h-4' />
            {exporting === 'attribution' ? '导出中...' : '导出 Excel'}
          </button>
        </div>

        {batchAttributionError && (
          <div className='text-center py-8 text-red-500'>{batchAttributionError}</div>
        )}

        {!selectedClass && !batchAttributionLoading && (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <Users className='w-12 h-12 mx-auto mb-3 text-gray-400' />
            <p className='text-sm'>请先在上方【选择班级】下拉框中选择班级后开始归因</p>
            <p className='text-xs mt-2 text-gray-400 dark:text-slate-500'>
              （页面顶部"班级"下拉框与此处同效，二选一即可）
            </p>
          </div>
        )}

        {selectedClass && !batchAttributionLoading && !batchAttributionError && data && (
          <>
            {/* 汇总卡片 */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>班级人数</div>
                <div className='text-3xl font-bold text-gray-800 dark:text-white mt-1'>
                  {data.total}
                </div>
              </div>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>有效归因</div>
                <div className='text-3xl font-bold text-green-600 mt-1'>{data.with_data}</div>
              </div>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>缺数据</div>
                <div className='text-3xl font-bold text-gray-600 mt-1'>
                  {data.analyzed - data.with_data}
                </div>
              </div>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>异常隔离</div>
                <div className='text-3xl font-bold text-red-600 mt-1'>{data.failed}</div>
              </div>
            </div>

            {/* 表格 */}
            <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
              <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
                <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                  <BarChart3 className='w-5 h-5 text-purple-500' />
                  全班成绩波动归因
                </h3>
              </div>
              <div className='p-6'>
                {students.length === 0 ? (
                  <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
                    该班级暂无归因数据
                  </div>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b border-gray-200 dark:border-slate-700'>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            学生
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            成绩变化
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            主要归因
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            置信度
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            状态
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, idx) => (
                          <tr
                            key={s.user_id ?? idx}
                            className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                          >
                            <td className='py-3 px-4'>
                              <div className='font-medium text-gray-800 dark:text-white'>
                                {s.name}
                              </div>
                              {s.error && <div className='text-xs text-red-500'>{s.error}</div>}
                            </td>
                            <td className='py-3 px-4'>
                              {s.has_data ? (
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
                              )}
                            </td>
                            <td className='py-3 px-4 text-gray-600 dark:text-slate-300'>
                              {s.has_data ? topFactors(s) : '数据不足'}
                            </td>
                            <td className='py-3 px-4'>
                              {s.has_data ? (
                                <div className='w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                                  <div
                                    className='bg-purple-500 h-2 rounded-full'
                                    style={{
                                      width: `${Math.min(100, (s.confidence || 0) * 100)}%`,
                                    }}
                                  />
                                </div>
                              ) : (
                                <span className='text-gray-400'>—</span>
                              )}
                            </td>
                            <td className='py-3 px-4'>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  s.has_data
                                    ? 'bg-green-100 dark:bg-green-500/20 text-green-600'
                                    : 'bg-gray-100 dark:bg-gray-500/20 text-gray-500'
                                }`}
                              >
                                {s.has_data ? '已归因' : '缺数据'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {failed.length > 0 && (
                  <div className='mt-4 p-4 bg-red-50/50 dark:bg-red-500/5 rounded-lg border border-red-200/50 dark:border-red-500/20'>
                    <div className='text-sm font-medium text-red-600 mb-2'>
                      异常隔离（{failed.length} 人，不影响其余结果）
                    </div>
                    <div className='space-y-1 text-sm text-gray-600 dark:text-slate-300'>
                      {failed.map((f) => (
                        <div key={f.user_id}>
                          {f.name}：{f.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {batchAttributionLoading && (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-purple-500' />
            <p className='text-sm'>正在批量归因...</p>
          </div>
        )}
      </div>
    );
  };

  // 参与度等级徽章配色
  const engagementLevelBadge = (level: string) => {
    if (level === 'high') return 'bg-green-100 dark:bg-green-500/20 text-green-600';
    if (level === 'medium') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600';
    return 'bg-gray-100 dark:bg-gray-500/20 text-gray-500';
  };

  const renderEngagement = () => {
    const data = engagementRank;
    const students = data?.students || [];
    const ranked = students.filter((s) => s.has_data);
    const trend = engagementTrend;
    const trendStudent = students.find((s) => s.user_id === engagementTrendUserId) || null;

    return (
      <div className='space-y-6'>
        {/* 控制区 */}
        <div className='flex flex-col sm:flex-row sm:items-end gap-4 bg-purple-50/60 dark:bg-purple-500/10 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <LineChart className='w-5 h-5 text-purple-500' />
            <label
              htmlFor='engagement-class'
              className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
            >
              选择班级:
            </label>
            <select
              id='engagement-class'
              data-testid='engagement-class-select'
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setEngagementTrendUserId(null);
                setEngagementTrend(null);
              }}
              className='px-3 py-1.5 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[140px]'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
            {selectedClass && (
              <button
                type='button'
                onClick={() => {
                  setSelectedClass('');
                  setEngagementTrendUserId(null);
                  setEngagementTrend(null);
                }}
                className='text-xs text-purple-600 dark:text-purple-400 hover:underline'
                title='清除选择'
              >
                清除
              </button>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <label
              htmlFor='engagement-days'
              className='text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap'
            >
              统计天数:
            </label>
            <input
              id='engagement-days'
              data-testid='engagement-days-input'
              type='number'
              min={7}
              max={180}
              value={engagementRankDays}
              onChange={(e) => setEngagementRankDays(Number(e.target.value) || 30)}
              className='w-20 px-2 py-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white'
            />
          </div>
          <button
            onClick={() => loadEngagementRank()}
            disabled={engagementRankLoading || !selectedClass}
            className='px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors'
          >
            {engagementRankLoading ? '计算中...' : '生成全班参与度排名'}
          </button>
          <button
            onClick={() => handleExport('engagement', engagementRankDays)}
            disabled={exporting !== null || !selectedClass}
            className='px-4 py-2 rounded-lg border border-purple-500 text-purple-600 dark:text-purple-400 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-500/10 disabled:opacity-50 transition-colors flex items-center gap-1.5'
          >
            <Download className='w-4 h-4' />
            {exporting === 'engagement' ? '导出中...' : '导出 Excel'}
          </button>
        </div>

        {engagementRankError && (
          <div className='text-center py-8 text-red-500'>{engagementRankError}</div>
        )}

        {!selectedClass && !engagementRankLoading && (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <LineChart className='w-12 h-12 mx-auto mb-3 text-gray-400' />
            <p className='text-sm'>请先在上方【选择班级】下拉框中选择班级后开始分析</p>
            <p className='text-xs mt-2 text-gray-400 dark:text-slate-500'>
              （页面顶部"班级"下拉框与此处同效，二选一即可）
            </p>
          </div>
        )}

        {selectedClass && !engagementRankLoading && !engagementRankError && data && (
          <>
            {/* 汇总卡片 */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>班级人数</div>
                <div className='text-3xl font-bold text-gray-800 dark:text-white mt-1'>
                  {data.total}
                </div>
              </div>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>有效参与度</div>
                <div className='text-3xl font-bold text-green-600 mt-1'>{data.with_data}</div>
              </div>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>高参与度</div>
                <div className='text-3xl font-bold text-purple-600 mt-1'>
                  {ranked.filter((s) => s.level === 'high').length}
                </div>
              </div>
              <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                <div className='text-sm text-gray-500 dark:text-slate-400'>异常隔离</div>
                <div className='text-3xl font-bold text-red-600 mt-1'>{data.failed}</div>
              </div>
            </div>

            {/* 排名榜 */}
            <div className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'>
              <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700'>
                <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                  <BarChart3 className='w-5 h-5 text-purple-500' />
                  全班参与度排名榜
                </h3>
              </div>
              <div className='p-6'>
                {students.length === 0 ? (
                  <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
                    该班级暂无参与度数据
                  </div>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b border-gray-200 dark:border-slate-700'>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            排名
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            学生
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            参与度
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            等级
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            出勤率
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            作业率
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            活跃度
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            请假(天)
                          </th>
                          <th className='text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400'>
                            周趋势
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, idx) => (
                          <tr
                            key={s.user_id ?? idx}
                            className='border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer'
                            onClick={() => {
                              if (s.has_data) {
                                setEngagementTrendUserId(s.user_id);
                                const el = document.getElementById('engagement-trend-section');
                                el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                          >
                            <td className='py-3 px-4'>
                              <span
                                className={`font-bold ${
                                  s.rank && s.rank <= 3 ? 'text-purple-600' : 'text-gray-500'
                                }`}
                              >
                                {s.rank ? `#${s.rank}` : '—'}
                              </span>
                            </td>
                            <td className='py-3 px-4'>
                              <div className='font-medium text-gray-800 dark:text-white'>
                                {s.name}
                              </div>
                              {s.error && <div className='text-xs text-red-500'>{s.error}</div>}
                            </td>
                            <td className='py-3 px-4'>
                              {s.has_data ? (
                                <span
                                  className={`font-medium ${
                                    (s.engagement_score || 0) >=
                                    ANALYSIS_CONFIG.engagementScoreThresholds.high
                                      ? 'text-green-600'
                                      : (s.engagement_score || 0) >=
                                        ANALYSIS_CONFIG.engagementScoreThresholds.medium
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {(s.engagement_score || 0).toFixed(1)}
                                </span>
                              ) : (
                                <span className='text-gray-400'>—</span>
                              )}
                            </td>
                            <td className='py-3 px-4'>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${engagementLevelBadge(
                                  s.level
                                )}`}
                              >
                                {s.level === 'high' ? '高' : s.level === 'medium' ? '中' : '低'}
                              </span>
                            </td>
                            <td className='py-3 px-4 text-gray-600 dark:text-slate-300'>
                              {s.components?.attendance_rate != null
                                ? `${(s.components.attendance_rate * 100).toFixed(0)}%`
                                : '—'}
                            </td>
                            <td className='py-3 px-4 text-gray-600 dark:text-slate-300'>
                              {s.components?.homework_rate != null
                                ? `${(s.components.homework_rate * 100).toFixed(0)}%`
                                : '—'}
                            </td>
                            <td className='py-3 px-4 text-gray-600 dark:text-slate-300'>
                              {s.components?.activity_rate != null
                                ? `${(s.components.activity_rate * 100).toFixed(0)}%`
                                : '—'}
                            </td>
                            <td className='py-3 px-4 text-gray-600 dark:text-slate-300'>
                              {s.components?.leave_days ?? 0}
                            </td>
                            <td className='py-3 px-4'>
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {engagementRankLoading && (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-purple-500' />
            <p className='text-sm'>正在计算全班参与度...</p>
          </div>
        )}

        {/* 个人周趋势 */}
        {selectedClass && engagementTrendUserId && (
          <div
            id='engagement-trend-section'
            className='bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700'
          >
            <div className='px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <LineChart className='w-5 h-5 text-purple-500' />
                {trendStudent ? `${trendStudent.name} 的参与度周趋势` : '参与度周趋势'}
              </h3>
              <div className='flex items-center gap-2'>
                <span className='text-sm text-gray-500 dark:text-slate-400'>近</span>
                <select
                  value={engagementTrendWeeks}
                  onChange={(e) => setEngagementTrendWeeks(Number(e.target.value))}
                  className='px-2 py-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm'
                >
                  {[4, 6, 8, 12].map((w) => (
                    <option key={w} value={w}>
                      {w}周
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='p-6'>
              {engagementTrendLoading && (
                <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
                  <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-purple-500' />
                  <p className='text-sm'>加载周趋势...</p>
                </div>
              )}
              {!engagementTrendLoading && trend && <EngagementTrendChart trend={trend} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 参与度周趋势 SVG 折线图
  const EngagementTrendChart = ({ trend }: { trend: EngagementTrendResult }) => {
    const series = (trend.series || []).filter((p) => p.has_data);
    if (series.length === 0) {
      return (
        <div className='text-center py-8 text-gray-500 dark:text-slate-400'>
          该学生近 {trend.weeks} 周暂无参与度数据
        </div>
      );
    }
    const W = 720;
    const H = 240;
    const padL = 40;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const scores = series.map((p) => p.engagement_score);
    const maxS = Math.max(100, ...scores);
    const minS = Math.min(0, ...scores);
    const span = maxS - minS || 1;
    const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
    const yOf = (v: number) => padT + innerH - ((v - minS) / span) * innerH;
    const xOf = (i: number) => padL + stepX * i;
    const pts = series.map((p, i) => `${xOf(i)},${yOf(p.engagement_score)}`).join(' ');
    const trendColor =
      trend.trend === 'up' ? '#16a34a' : trend.trend === 'down' ? '#dc2626' : '#8b5cf6';
    const areaPts = `${padL},${padT + innerH} ${pts} ${xOf(series.length - 1)},${padT + innerH}`;
    return (
      <div>
        <div className='flex items-center justify-between mb-3'>
          <div className='text-sm text-gray-600 dark:text-slate-300'>
            趋势：
            <span className='font-medium' style={{ color: trendColor }}>
              {trend.trend === 'up' ? '↑ 上升' : trend.trend === 'down' ? '↓ 下降' : '→ 平稳'}
            </span>
          </div>
          <div className='text-xs text-gray-400'>共 {series.length} 周有效数据</div>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className='w-full h-auto'
          preserveAspectRatio='xMidYMid meet'
        >
          {/* 网格线 */}
          {[0, 25, 50, 75, 100].map((g) => {
            const y = yOf(g);
            return (
              <g key={g}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke='#e5e7eb'
                  strokeWidth={1}
                  strokeDasharray='3 3'
                />
                <text x={padL - 6} y={y + 4} textAnchor='end' fontSize={10} fill='#9ca3af'>
                  {g}
                </text>
              </g>
            );
          })}
          {/* 面积 */}
          <polygon points={areaPts} fill={trendColor} fillOpacity={0.08} />
          {/* 折线 */}
          <polyline
            points={pts}
            fill='none'
            stroke={trendColor}
            strokeWidth={2.5}
            strokeLinejoin='round'
            strokeLinecap='round'
          />
          {/* 数据点 */}
          {series.map((p, i) => (
            <g key={p.week_index}>
              <circle cx={xOf(i)} cy={yOf(p.engagement_score)} r={3.5} fill={trendColor} />
              <text x={xOf(i)} y={H - 10} textAnchor='middle' fontSize={9} fill='#9ca3af'>
                {p.week_label.replace(/^\d{4}-/, '')}
              </text>
              <text
                x={xOf(i)}
                y={yOf(p.engagement_score) - 8}
                textAnchor='middle'
                fontSize={9}
                fill='#4b5563'
              >
                {p.engagement_score.toFixed(0)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  const renderStudentProfile = () => {
    const selectedStudent = students.find((s) => s.id === selectedProfileUserId) || null;

    const renderScoreCard = (
      title: string,
      icon: React.ReactNode,
      current: number | undefined,
      predicted: number | undefined,
      trend: string | undefined,
      confidence: number | undefined,
      interval?: [number, number]
    ) => {
      const cur = typeof current === 'number' ? current : 0;
      const pred = typeof predicted === 'number' ? predicted : cur;
      const conf = typeof confidence === 'number' ? confidence : 0;
      const t = trend || 'stable';
      const hasTrend = !!trend; // 趋势缺失显示 '--'，不冒充"稳定"
      return (
        <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-3'>
            {icon}
            {title}
          </div>
          <div className='flex items-end gap-2'>
            <div className='text-3xl font-bold text-gray-800 dark:text-white'>{cur.toFixed(1)}</div>
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                pred - cur >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {getTrendIcon(t)}
              {pred >= cur ? '+' : ''}
              {(pred - cur).toFixed(1)}
            </div>
          </div>
          <div className='flex items-center justify-between mt-3 text-xs text-gray-400'>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${getTrendColor(
                t
              )}`}
            >
              {hasTrend ? (t === 'up' ? '上升' : t === 'down' ? '下降' : '稳定') : '--'}
            </span>
            <span>置信度 {(conf * 100).toFixed(0)}%</span>
          </div>
          {interval && interval.length === 2 && (
            <div className='mt-3'>
              <div className='flex items-center justify-between text-[11px] text-gray-400 mb-1'>
                <span>95% 预测区间</span>
                <span>
                  {interval[0].toFixed(1)} ~ {interval[1].toFixed(1)}
                </span>
              </div>
              <div className='relative h-2 rounded-full bg-gray-100 dark:bg-slate-700'>
                {(() => {
                  const lo = Math.min(interval[0], interval[1], pred);
                  const hi = Math.max(interval[0], interval[1], pred);
                  const span = hi - lo || 1;
                  const bandL = ((Math.min(interval[0], interval[1]) - lo) / span) * 100;
                  const bandW = (Math.abs(interval[1] - interval[0]) / span) * 100;
                  const dotL = ((pred - lo) / span) * 100;
                  return (
                    <>
                      <div
                        className='absolute top-0 h-2 rounded-full bg-blue-200 dark:bg-blue-500/30'
                        style={{ left: `${bandL}%`, width: `${bandW}%` }}
                      />
                      <div
                        className='absolute -top-0.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800'
                        style={{ left: `calc(${dotL}% - 6px)` }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderAnomalyCard = (label: string, a?: AnomalyResult) => {
      // 数据缺失（接口未返回该维度）≠ 无异常：显示"数据缺失"而非 fail-open 的绿色"正常"
      const missing = !a;
      const noAnomaly = !missing && !a.description && a.score_change === 0 && a.severity === 'low';
      const sev = a?.severity || 'low';
      const sevStyle = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
      return (
        <div className='bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-800 dark:text-white'>{label}</span>
            {missing ? (
              <span className='px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'>
                数据缺失
              </span>
            ) : noAnomaly ? (
              <span className='px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 dark:bg-green-500/10'>
                正常
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${sevStyle.light} ${sevStyle.text}`}
              >
                {sev === 'high' ? '高' : sev === 'medium' ? '中' : '低'}
              </span>
            )}
          </div>
          {missing ? (
            <p className='text-sm text-gray-400'>该维度暂无检测数据</p>
          ) : noAnomaly ? (
            <p className='text-sm text-gray-400'>未检测到异常</p>
          ) : (
            <div className='space-y-1'>
              <p className='text-sm text-gray-600 dark:text-slate-300'>{a?.description || '—'}</p>
              {a && a.score_change !== 0 && (
                <p
                  className={`text-xs font-medium ${
                    a.score_change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  积分变化 {a.score_change > 0 ? '+' : ''}
                  {a.score_change.toFixed(1)}
                </p>
              )}
              {a?.detected_at && <p className='text-xs text-gray-400'>检测时间 {a.detected_at}</p>}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className='space-y-6'>
        {/* 学生选择器 */}
        <div className='bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center gap-4'>
          <div className='flex items-center gap-2'>
            <UserCircle className='w-5 h-5 text-primary-500' />
            <span className='text-sm text-gray-700 dark:text-slate-300'>选择学生:</span>
          </div>
          <select
            value={selectedProfileUserId ?? ''}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              setSelectedProfileUserId(id);
              setStudentProfile(null);
              if (id !== null) loadStudentProfile(id);
            }}
            className='flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'
          >
            <option value=''>请选择学生...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.class_name ? `（${s.class_name}）` : ''}
              </option>
            ))}
          </select>
        </div>

        {profileError && (
          <div className='bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-4 text-red-600 dark:text-red-400'>
            {profileError}
          </div>
        )}

        {!selectedProfileUserId && (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <UserCircle className='w-12 h-12 mx-auto mb-3 text-gray-400' />
            <p>请选择一名学生查看其算法画像</p>
            <p className='text-sm mt-1'>集成预测 / 成绩 / 风险 / 异常检测四大单用户算法</p>
          </div>
        )}

        {profileLoading && selectedProfileUserId && (
          <div className='text-center py-12 text-gray-500 dark:text-slate-400'>
            <Loader2 className='w-8 h-8 mx-auto mb-3 animate-spin text-primary-500' />
            <p>加载学生画像中...</p>
          </div>
        )}

        {selectedStudent && studentProfile && !profileLoading && (
          <div className='space-y-6'>
            {/* 标题 */}
            <div className='flex items-center gap-3'>
              <UserCircle className='w-8 h-8 text-primary-500' />
              <div>
                <h3 className='text-xl font-bold text-gray-800 dark:text-white'>
                  {selectedStudent.name}
                </h3>
                <p className='text-sm text-gray-500 dark:text-slate-400'>
                  {selectedStudent.class_name || '未分配班级'}
                </p>
              </div>
            </div>

            {/* 积分预测 + 成绩预测 */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {renderScoreCard(
                '积分预测',
                <TrendingUp className='w-4 h-4 text-blue-500' />,
                studentProfile.prediction?.current_score,
                studentProfile.prediction?.predicted_score,
                studentProfile.prediction?.trend,
                studentProfile.prediction?.confidence,
                studentProfile.prediction?.confidence_interval
              )}
              {renderScoreCard(
                '成绩预测',
                <BookOpen className='w-4 h-4 text-indigo-500' />,
                studentProfile.scorePredict?.current_score,
                studentProfile.scorePredict?.predicted_score,
                studentProfile.scorePredict?.trend,
                studentProfile.scorePredict?.confidence,
                studentProfile.scorePredict?.confidence_interval
              )}
            </div>

            {/* 风险评估 */}
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4'>
                <ShieldCheck className='w-5 h-5 text-red-500' />
                风险评估
              </h4>
              {studentProfile.riskPredict ? (
                <div className='space-y-4'>
                  <div className='flex items-center gap-4'>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        studentProfile.riskPredict.risk_level === 'high'
                          ? 'bg-red-50 text-red-600 dark:bg-red-500/10'
                          : studentProfile.riskPredict.risk_level === 'medium'
                          ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10'
                          : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'
                      }`}
                    >
                      {studentProfile.riskPredict.risk_level === 'high'
                        ? '高风险'
                        : studentProfile.riskPredict.risk_level === 'medium'
                        ? '中风险'
                        : '低风险'}
                    </span>
                    <span className='text-sm text-gray-500 dark:text-slate-400'>
                      风险分 {studentProfile.riskPredict.risk_score.toFixed(1)}
                    </span>
                  </div>
                  {studentProfile.riskPredict.sub_risks &&
                    studentProfile.riskPredict.sub_risks.length > 0 && (
                      <div>
                        <div className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                          多维风险分
                        </div>
                        <div className='space-y-2'>
                          {studentProfile.riskPredict.sub_risks.map((s) => {
                            const barColor =
                              s.level === 'high'
                                ? 'bg-red-500'
                                : s.level === 'medium'
                                ? 'bg-yellow-500'
                                : 'bg-blue-500';
                            const labelColor =
                              s.level === 'high'
                                ? 'text-red-600 dark:text-red-400'
                                : s.level === 'medium'
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-blue-600 dark:text-blue-400';
                            const pct = Math.max(4, Math.min(100, Math.round(s.score * 100)));
                            return (
                              <div key={s.key}>
                                <div className='flex items-center justify-between text-xs mb-1'>
                                  <span className='text-gray-600 dark:text-slate-300'>
                                    {s.name}
                                  </span>
                                  <span className={`font-medium ${labelColor}`}>
                                    {s.level === 'high' ? '高' : s.level === 'medium' ? '中' : '低'}{' '}
                                    · {s.score.toFixed(2)}
                                  </span>
                                </div>
                                <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden'>
                                  <div
                                    className={`h-full ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  {studentProfile.riskPredict.contributing_factors.length > 0 && (
                    <div>
                      <div className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                        风险因子
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        {studentProfile.riskPredict.contributing_factors.map((f, i) => (
                          <span
                            key={i}
                            className='px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 text-xs text-gray-600 dark:text-slate-300'
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {studentProfile.riskPredict.recommended_actions.length > 0 && (
                    <div>
                      <div className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                        建议措施
                      </div>
                      <ul className='list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-slate-300'>
                        {studentProfile.riskPredict.recommended_actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className='text-sm text-gray-400'>暂无风险评估数据</p>
              )}
            </div>

            {/* 参与度指数 */}
            <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
              <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4'>
                <Activity className='w-5 h-5 text-emerald-500' />
                参与度指数
              </h4>
              {studentProfile.engagement ? (
                (() => {
                  const eng = studentProfile.engagement!;
                  if (!eng.has_data) {
                    return (
                      <p className='text-sm text-gray-400'>{eng.description || '暂无参与度数据'}</p>
                    );
                  }
                  const comps: Array<{ label: string; rate: number | null }> = [
                    { label: '出勤率', rate: eng.components.attendance_rate },
                    { label: '作业提交率', rate: eng.components.homework_rate },
                    { label: '积分活跃度', rate: eng.components.activity_rate },
                  ];
                  return (
                    <div className='space-y-4'>
                      <div className='flex items-center gap-4 flex-wrap'>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            eng.level === 'high'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                              : eng.level === 'medium'
                              ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'
                          }`}
                        >
                          {eng.level === 'high'
                            ? '高参与度'
                            : eng.level === 'medium'
                            ? '中参与度'
                            : '低参与度'}
                        </span>
                        <span className='text-sm text-gray-500 dark:text-slate-400'>
                          参与度分 {eng.engagement_score.toFixed(1)}
                        </span>
                        {eng.components.leave_days > 0 && (
                          <span className='text-xs text-gray-400'>
                            近 {eng.days} 天请假 {eng.components.leave_days} 天
                          </span>
                        )}
                      </div>
                      <div className='space-y-2'>
                        {comps
                          .filter((c) => c.rate !== null)
                          .map((c) => {
                            const pct = Math.max(
                              2,
                              Math.min(100, Math.round((c.rate as number) * 100))
                            );
                            return (
                              <div key={c.label}>
                                <div className='flex items-center justify-between text-xs mb-1'>
                                  <span className='text-gray-600 dark:text-slate-300'>
                                    {c.label}
                                  </span>
                                  <span className='font-medium text-gray-600 dark:text-slate-300'>
                                    {Math.round((c.rate as number) * 100)}%
                                  </span>
                                </div>
                                <div className='h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden'>
                                  <div
                                    className='h-full bg-emerald-500'
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {eng.description && (
                        <p className='text-xs text-gray-400'>{eng.description}</p>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className='text-sm text-gray-400'>暂无参与度数据</p>
              )}
            </div>

            {/* 异常检测 */}
            <div>
              <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-3'>
                <AlertCircle className='w-5 h-5 text-orange-500' />
                异常检测
              </h4>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {renderAnomalyCard('综合异常', studentProfile.anomaly)}
                {renderAnomalyCard('突变检测', studentProfile.sudden)}
                {renderAnomalyCard('趋势异常', studentProfile.trend)}
                {renderAnomalyCard('群体偏离', studentProfile.group)}
              </div>
            </div>

            {/* 成绩波动归因 */}
            {(() => {
              const attr = studentProfile.attribution;
              if (!attr || !attr.has_data) {
                return (
                  <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                    <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-2'>
                      <LineChart className='w-5 h-5 text-purple-500' />
                      成绩波动归因
                    </h4>
                    <p className='text-sm text-gray-400'>{attr?.summary || '暂无归因数据'}</p>
                  </div>
                );
              }
              const maxAbs = Math.max(1, ...attr.factors.map((f) => Math.abs(f.contribution)));
              return (
                <div className='bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700'>
                  <h4 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4'>
                    <LineChart className='w-5 h-5 text-purple-500' />
                    成绩波动归因
                  </h4>
                  <p className='text-sm text-gray-600 dark:text-slate-300'>{attr.summary}</p>
                  <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mt-2'>
                    <span className='text-gray-500 dark:text-slate-400'>
                      前期{' '}
                      <b className='text-gray-800 dark:text-white'>
                        {attr.score_before.toFixed(1)}
                      </b>
                      {' → '}近期{' '}
                      <b className='text-gray-800 dark:text-white'>{attr.score_after.toFixed(1)}</b>
                    </span>
                    <span
                      className={`font-medium ${
                        attr.total_change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      净变化 {attr.total_change >= 0 ? '+' : ''}
                      {attr.total_change.toFixed(1)}
                    </span>
                    <span className='text-gray-400'>
                      置信度 {(attr.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className='space-y-3 mt-4'>
                    {attr.factors.map((f) => {
                      const widthPct = Math.min(100, (Math.abs(f.contribution) / maxAbs) * 100);
                      const color =
                        f.direction === 'positive'
                          ? 'bg-green-500'
                          : f.direction === 'negative'
                          ? 'bg-red-500'
                          : 'bg-gray-400';
                      return (
                        <div key={f.key}>
                          <div className='flex items-center justify-between text-sm mb-1'>
                            <span className='font-medium text-gray-700 dark:text-slate-300'>
                              {f.name}
                            </span>
                            <span
                              className={`font-medium ${
                                f.direction === 'positive'
                                  ? 'text-green-600'
                                  : f.direction === 'negative'
                                  ? 'text-red-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              {f.contribution >= 0 ? '+' : ''}
                              {f.contribution.toFixed(1)} 分
                            </span>
                          </div>
                          <div className='w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2'>
                            <div
                              className={`${color} h-2 rounded-full`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          {f.detail && <p className='text-xs text-gray-400 mt-1'>{f.detail}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
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
          {activeTab === 'statistics' && renderStatistics()}
          {activeTab === 'prediction' && renderPrediction()}
          {activeTab === 'anomaly' && renderAnomaly()}
          {activeTab === 'ruleRecommend' && renderRuleRecommend()}
          {activeTab === 'scorePredict' && renderScorePredict()}
          {activeTab === 'riskPredict' && renderRiskPredict()}
          {activeTab === 'modelManager' && renderModelManager()}
          {activeTab === 'ruleApplication' && renderRuleApplication()}
          {activeTab === 'studentProfile' && renderStudentProfile()}
          {activeTab === 'batchAttribution' && renderBatchAttribution()}
          {activeTab === 'engagement' && renderEngagement()}
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
