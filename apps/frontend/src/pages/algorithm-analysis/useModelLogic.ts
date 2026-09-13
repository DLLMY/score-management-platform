import { useState, useCallback } from 'react';
import api from '../../services/api';
import { useStableToast } from '../../hooks';
import logger from '../../utils/logger';
import type { ModelTrainingState, ModelEvalState } from './types';

export interface ModelLogicDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
}

export interface ModelLogicResult {
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
}

/**
 * 模型管理（三模型训练 / 评估）逻辑子模块。
 * 状态与 6 个回调原样搬自 useAlgorithmAnalysisLogic.ts，函数体逐字不变；showToast 经 deps 注入。
 */
export function useModelLogic(deps: ModelLogicDeps): ModelLogicResult {
  const { showToast } = deps;
  const [modelTrainingData, setModelTrainingData] = useState<ModelTrainingState>({});
  const [modelEvaluationData, setModelEvaluationData] = useState<ModelEvalState>({});
  const [trainingModel, setTrainingModel] = useState<string | null>(null);
  const [evaluatingModel, setEvaluatingModel] = useState<string | null>(null);

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

  return {
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
  };
}
