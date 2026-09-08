import React from 'react';
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
  BatchAttributionStudent,
  EngagementRankResult,
  EngagementTrendResult,
  BatchAttributionResult,
} from '../../types';
import type { ColumnType } from '../../components/data-display/DataTable';

export interface ModelTrainingState {
  ruleRecommend?: { status: string; message: string; model_info?: unknown };
  scorePredict?: { status: string; message: string; model_info?: unknown };
  riskPredict?: { status: string; message: string; model_info?: unknown };
}

export interface ModelEvalState {
  ruleRecommend?: ModelEvaluationResult;
  scorePredict?: ModelEvaluationResult;
  riskPredict?: ModelEvaluationResult;
}

export interface RuleApplicationState {
  scoreDistributionStats?: unknown;
  earningRules?: unknown;
  spendingRules?: unknown;
  rewardTypes?: unknown;
  applyingRule?: boolean;
  applyingResult?: unknown;
  students?: Array<{ id: number; name: string; class_name?: string }>;
}

export interface StudentProfileState {
  prediction?: PredictionResult;
  scorePredict?: ScorePredictResult;
  riskPredict?: RiskPredictResult;
  anomaly?: import('../../types').AnomalyResult;
  sudden?: import('../../types').AnomalyResult;
  trend?: import('../../types').AnomalyResult;
  group?: import('../../types').AnomalyResult;
  attribution?: import('../../types').ScoreAttributionResult;
  engagement?: import('../../types').EngagementResult;
}

export type ClassOption = { id: number; name: string };
export type StudentOption = { id: number; name: string; class_name?: string };

/**
 * 主组件（壳）向各 Tab 子模块透传的全部状态 / setter / 回调 / 列定义。
 * 单一对象透传，子模块按需解构——行为与原闭包完全一致，tsc 校验缺失引用。
 */
export interface AlgorithmAnalysisDeps {
  // —— 选择器 / 全局过滤 ——
  selectedClass: string;
  setSelectedClass: React.Dispatch<React.SetStateAction<string>>;
  searchKeyword: string;
  loading: boolean;
  error: string | null;
  loadWarn: boolean;

  // —— 统计 ——
  statistics: AlgorithmStatistics | null;

  // —— 积分预测 ——
  predictionData: BatchPredictionData | null;
  riskStudents: RiskStudent[];
  predictionDays: number;
  filteredPredictions: PredictionResult[];
  filteredRiskStudents: RiskStudent[];

  // —— 异常检测 ——
  anomalyData: BatchAnomalyData | null;

  // —— 规则推荐 ——
  ruleRecommendData: RuleRecommendData | null;

  // —— 成绩预测 ——
  scorePredictData: BatchScorePredictData | null;

  // —— 风险评估 ——
  riskPredictData: BatchRiskPredictData | null;

  // —— 模型管理 ——
  modelTrainingData: ModelTrainingState;
  modelEvaluationData: ModelEvalState;
  trainingModel: string | null;
  evaluatingModel: string | null;
  trainRuleModel: (days?: number) => Promise<void>;
  evaluateRuleModel: (days?: number) => Promise<void>;
  trainScoreModel: (days?: number) => Promise<void>;
  evaluateScoreModel: (days?: number) => Promise<void>;
  trainRiskModel: (days?: number) => Promise<void>;
  evaluateRiskModel: (days?: number) => Promise<void>;

  // —— 智能规则应用 ——
  ruleApplicationData: RuleApplicationState;
  selectedUserId: number | null;
  setSelectedUserId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedBehaviorType: string;
  setSelectedBehaviorType: React.Dispatch<React.SetStateAction<string>>;
  handleAdjustDistribution: () => Promise<void>;
  handleApplyRule: () => Promise<void>;

  // —— 班级归因 ——
  batchAttribution: BatchAttributionResult | null;
  batchAttributionDays: number;
  setBatchAttributionDays: React.Dispatch<React.SetStateAction<number>>;
  batchAttributionLoading: boolean;
  batchAttributionError: string | null;
  loadBatchAttribution: () => Promise<void>;

  // —— 参与度分析 ——
  engagementRank: EngagementRankResult | null;
  engagementRankDays: number;
  setEngagementRankDays: React.Dispatch<React.SetStateAction<number>>;
  engagementRankLoading: boolean;
  engagementRankError: string | null;
  engagementTrend: EngagementTrendResult | null;
  engagementTrendUserId: number | null;
  setEngagementTrendUserId: React.Dispatch<React.SetStateAction<number | null>>;
  engagementTrendWeeks: number;
  setEngagementTrendWeeks: React.Dispatch<React.SetStateAction<number>>;
  engagementTrendLoading: boolean;
  setEngagementTrend: React.Dispatch<React.SetStateAction<EngagementTrendResult | null>>;
  loadEngagementRank: () => Promise<void>;

  // —— 学生画像 ——
  classes: ClassOption[];
  students: StudentOption[];
  selectedProfileUserId: number | null;
  setSelectedProfileUserId: React.Dispatch<React.SetStateAction<number | null>>;
  studentProfile: StudentProfileState | null;
  setStudentProfile: React.Dispatch<React.SetStateAction<StudentProfileState | null>>;
  profileLoading: boolean;
  profileError: string | null;
  loadStudentProfile: (userId: number) => Promise<void>;

  // —— 导出 ——
  exporting: 'engagement' | 'attribution' | 'risk' | null;
  handleExport: (tab: 'engagement' | 'attribution' | 'risk', days: number) => Promise<void>;

  // —— 列定义（主组件 memo）——
  predictionDetailColumns: ColumnType<PredictionResult>[];
  scorePredictColumns: ColumnType<ScorePredictResult>[];
  attributionColumns: ColumnType<BatchAttributionStudent>[];
  engagementColumns: ColumnType<import('../../types').EngagementStudentRank>[];
}
