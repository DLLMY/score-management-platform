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
} from '../../types';
import { TABS, ANALYSIS_CONFIG } from './constants';
import type { AlgorithmAnalysisViewDeps } from './AlgorithmAnalysisShell';

/** 模型训练结果（三模型共用） */
export interface ModelTrainingState {
  ruleRecommend?: { status: string; message: string; model_info?: unknown };
  scorePredict?: { status: string; message: string; model_info?: unknown };
  riskPredict?: { status: string; message: string; model_info?: unknown };
}

/** 模型评估结果（三模型共用） */
export interface ModelEvalState {
  ruleRecommend?: ModelEvaluationResult;
  scorePredict?: ModelEvaluationResult;
  riskPredict?: ModelEvaluationResult;
}

/** 智能规则应用数据 */
export interface RuleApplicationState {
  scoreDistributionStats?: unknown;
  earningRules?: unknown;
  spendingRules?: unknown;
  rewardTypes?: unknown;
  applyingRule?: boolean;
  applyingResult?: unknown;
  students?: Array<{ id: number; name: string; class_name?: string }>;
}

/** 学生画像聚合结果（单用户全部算法下钻） */
export interface StudentProfileState {
  prediction?: PredictionResult;
  scorePredict?: ScorePredictResult;
  riskPredict?: RiskPredictResult;
  anomaly?: AnomalyResult;
  sudden?: AnomalyResult;
  trend?: AnomalyResult;
  group?: AnomalyResult;
  attribution?: ScoreAttributionResult;
  engagement?: EngagementResult;
}

/** 班级下拉项 */
export interface ClassOption {
  id: number;
  name: string;
}

/** 学生下拉项 */
export interface StudentOption {
  id: number;
  name: string;
  class_name?: string;
}

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
 * 智能分析增强页的逻辑层 hook。
 *
 * 承接原 AlgorithmAnalysis.tsx 中全部 state / effect / handler / useMemo，
 * 主文件退化为「hook + 视图层」的薄装配。deps 形状与 AlgorithmAnalysisViewDeps 保持一致
 * （列定义仍由 Shell 内部 memo 后合并），故 Shell 与各 Tab 无需改动。
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
  const [modelTrainingData, setModelTrainingData] = useState<ModelTrainingState>({});
  const [modelEvaluationData, setModelEvaluationData] = useState<ModelEvalState>({});
  const [trainingModel, setTrainingModel] = useState<string | null>(null);
  const [evaluatingModel, setEvaluatingModel] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassOption[]>([]);

  // 学生画像（单用户算法下钻）
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfileState | null>(null);

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

  // 评估风险预测模型
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
        : (data as { classes?: ClassOption[] }).classes || [];
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
    // —— 模型管理 ——
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
    // —— 智能规则应用 ——
    ruleApplicationData,
    selectedUserId,
    setSelectedUserId,
    selectedBehaviorType,
    setSelectedBehaviorType,
    handleAdjustDistribution,
    handleApplyRule,
    // —— 班级归因 ——
    batchAttribution,
    batchAttributionDays,
    setBatchAttributionDays,
    batchAttributionLoading,
    batchAttributionError,
    loadBatchAttribution,
    // —— 参与度分析 ——
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
    // —— 学生画像 ——
    classes,
    students,
    selectedProfileUserId,
    setSelectedProfileUserId,
    studentProfile,
    setStudentProfile,
    profileLoading,
    profileError,
    loadStudentProfile,
    // —— 导出 ——
    exporting,
    handleExport,
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
  };
}
