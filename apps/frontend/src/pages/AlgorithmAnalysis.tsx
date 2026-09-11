/**
 * 智能分析增强页面组件（装配层）
 * 在原有算法分析基础上，增加预测和异常检测功能。
 *
 * 全部 state / effect / handler / useMemo 已抽到 ./algorithm-analysis/useAlgorithmAnalysisLogic；
 * 主壳渲染（头部/标签页/各 Tab 分发/列定义）在 ./algorithm-analysis/AlgorithmAnalysisShell。
 * 本文件仅做「hook → Shell」的 props 装配。
 */

import React from 'react';
import {
  default as AlgorithmAnalysisShell,
  type AlgorithmAnalysisShellProps,
} from './algorithm-analysis/AlgorithmAnalysisShell';
import { useAlgorithmAnalysisLogic } from './algorithm-analysis/useAlgorithmAnalysisLogic';

export default function AlgorithmAnalysis(): React.ReactElement {
  const logic = useAlgorithmAnalysisLogic();

  // 主壳透传的全部依赖（不含列定义，由 Shell 内部 memo 后合并回 deps）
  const shellProps: AlgorithmAnalysisShellProps = {
    activeTab: logic.activeTab,
    setActiveTab: logic.setActiveTab,
    tabNavRef: logic.tabNavRef,
    selectedClass: logic.selectedClass,
    setSelectedClass: logic.setSelectedClass,
    searchKeyword: logic.searchKeyword,
    setSearchKeyword: logic.setSearchKeyword,
    classes: logic.classes,
    loading: logic.loading,
    error: logic.error,
    loadWarn: logic.loadWarn,
    statistics: logic.statistics,
    predictionData: logic.predictionData,
    riskStudents: logic.riskStudents,
    predictionDays: logic.predictionDays,
    setPredictionDays: logic.setPredictionDays,
    filteredPredictions: logic.filteredPredictions,
    filteredRiskStudents: logic.filteredRiskStudents,
    anomalyData: logic.anomalyData,
    anomalyDays: logic.anomalyDays,
    setAnomalyDays: logic.setAnomalyDays,
    ruleRecommendData: logic.ruleRecommendData,
    scorePredictData: logic.scorePredictData,
    riskPredictData: logic.riskPredictData,
    recommendDays: logic.recommendDays,
    setRecommendDays: logic.setRecommendDays,
    modelTrainingData: logic.modelTrainingData,
    modelEvaluationData: logic.modelEvaluationData,
    trainingModel: logic.trainingModel,
    evaluatingModel: logic.evaluatingModel,
    trainRuleModel: logic.trainRuleModel,
    evaluateRuleModel: logic.evaluateRuleModel,
    trainScoreModel: logic.trainScoreModel,
    evaluateScoreModel: logic.evaluateScoreModel,
    trainRiskModel: logic.trainRiskModel,
    evaluateRiskModel: logic.evaluateRiskModel,
    ruleApplicationData: logic.ruleApplicationData,
    selectedUserId: logic.selectedUserId,
    setSelectedUserId: logic.setSelectedUserId,
    selectedBehaviorType: logic.selectedBehaviorType,
    setSelectedBehaviorType: logic.setSelectedBehaviorType,
    handleAdjustDistribution: logic.handleAdjustDistribution,
    handleApplyRule: logic.handleApplyRule,
    batchAttribution: logic.batchAttribution,
    batchAttributionDays: logic.batchAttributionDays,
    setBatchAttributionDays: logic.setBatchAttributionDays,
    batchAttributionLoading: logic.batchAttributionLoading,
    batchAttributionError: logic.batchAttributionError,
    loadBatchAttribution: logic.loadBatchAttribution,
    engagementRank: logic.engagementRank,
    engagementRankDays: logic.engagementRankDays,
    setEngagementRankDays: logic.setEngagementRankDays,
    engagementRankLoading: logic.engagementRankLoading,
    engagementRankError: logic.engagementRankError,
    engagementTrend: logic.engagementTrend,
    engagementTrendUserId: logic.engagementTrendUserId,
    setEngagementTrendUserId: logic.setEngagementTrendUserId,
    engagementTrendWeeks: logic.engagementTrendWeeks,
    setEngagementTrendWeeks: logic.setEngagementTrendWeeks,
    engagementTrendLoading: logic.engagementTrendLoading,
    setEngagementTrend: logic.setEngagementTrend,
    loadEngagementRank: logic.loadEngagementRank,
    students: logic.students,
    selectedProfileUserId: logic.selectedProfileUserId,
    setSelectedProfileUserId: logic.setSelectedProfileUserId,
    studentProfile: logic.studentProfile,
    setStudentProfile: logic.setStudentProfile,
    profileLoading: logic.profileLoading,
    profileError: logic.profileError,
    loadStudentProfile: logic.loadStudentProfile,
    exporting: logic.exporting,
    handleExport: logic.handleExport,
    loadPrediction: logic.loadPrediction,
    loadAnomaly: logic.loadAnomaly,
    loadStatistics: logic.loadStatistics,
  };

  return <AlgorithmAnalysisShell {...shellProps} />;
}
