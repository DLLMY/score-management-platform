/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-8 拆分（2026-09-12）：模型训练域（算法列表 / 单训 / 全训 / 全评估 / 训练历史 / 模型评估）。
 * 自 useNLPManagementLogic.ts 原样搬出，showToast / setLoadError 由组合根注入。
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import api from '../../../services/api';
import logger from '../../../utils/logger';
import { buildTrainingResultColumns } from '../columns';
import type {
  MLAlgorithm,
  MLEvaluationAllResult,
  MLTrainingResult,
  MLTrainAllResult,
  ModelEvaluation,
  NLPDeps,
  ShowToast,
  TrainingRecord,
} from '../types';

export interface useNLPTrainingParams {
  showToast: ShowToast;
  setLoadError: Dispatch<SetStateAction<boolean>>;
}

export function useNLPTraining(params: useNLPTrainingParams): Pick<
  NLPDeps,
  | 'algorithms'
  | 'isTraining'
  | 'setIsTraining'
  | 'selectedAlgorithm'
  | 'setSelectedAlgorithm'
  | 'useCrossValidation'
  | 'setUseCrossValidation'
  | 'modelEvaluation'
  | 'trainingResult'
  | 'setTrainingResult'
  | 'trainAllResult'
  | 'setTrainAllResult'
  | 'isEvaluatingAll'
  | 'setIsEvaluatingAll'
  | 'evaluationAllResult'
  | 'setEvaluationAllResult'
  | 'trainingHistory'
  | 'trainingResultColumns'
  | 'handleTrainModel'
  | 'handleTrainAllModels'
  | 'handleEvaluateAllModels'
  | 'setModelEvaluation'
  | 'fetchModelEvaluation'
> & {
  /** 供组合根 activeTab effect 调用（NLPDeps 契约外扩展） */
  fetchTrainingHistory: () => Promise<void>;
} {
  const { showToast, setLoadError } = params;

  const [algorithms, setAlgorithms] = useState<MLAlgorithm[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('');
  const [useCrossValidation, setUseCrossValidation] = useState(false);
  const [trainingResult, setTrainingResult] = useState<MLTrainingResult | null>(null);
  const [trainAllResult, setTrainAllResult] = useState<MLTrainAllResult | null>(null);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
  const [evaluationAllResult, setEvaluationAllResult] = useState<MLEvaluationAllResult | null>(
    null
  );
  const [trainingHistory, setTrainingHistory] = useState<TrainingRecord[]>([]);
  const [modelEvaluation, setModelEvaluation] = useState<ModelEvaluation | null>(null);

  const fetchModelEvaluation = useCallback(async () => {
    try {
      const response = await api.nlp.evaluateModel();
      if (response) {
        setModelEvaluation(response as unknown as ModelEvaluation);
      }
    } catch (error) {
      showToast('error', '获取模型评估失败');
    }
  }, [showToast]);

  const fetchTrainingHistory = useCallback(async () => {
    try {
      const response = await api.nlp.getTrainingHistory({ page: 1, per_page: 10 });
      if (response) {
        setTrainingHistory(response.items);
      }
    } catch (error) {
      logger.error('获取训练历史失败:', error);
      showToast('error', '获取训练历史失败: ' + ((error as Error).message || '请稍后重试'));
    }
  }, [showToast]);

  const handleTrainModel = useCallback(async () => {
    // #912 实机修复：未选算法时后端 train(None) 会走 train_all 全量训练（万级样本
    // + 全算法含深度学习，10 分钟级），且与「训练全部模型」入口语义重复。
    // 这里明确拦截，避免用户误触超重负载。
    if (!selectedAlgorithm) {
      showToast('warning', '请先选择算法，或使用「训练全部模型」');
      return;
    }
    setIsTraining(true);
    setTrainingResult(null);
    try {
      const response = await api.nlp.trainModel({
        trained_by: 1,
        algorithm: selectedAlgorithm,
        use_cross_validation: useCrossValidation,
      });
      if (response) {
        setTrainingResult(response as unknown as MLTrainingResult);
        showToast('success', '模型训练成功');
        fetchModelEvaluation();
        fetchTrainingHistory();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('模型训练失败:', error);
      showToast('error', '模型训练失败: ' + ((error as Error).message || '请稍后重试'));
    } finally {
      setIsTraining(false);
    }
  }, [selectedAlgorithm, useCrossValidation, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrainAllModels = useCallback(async () => {
    setIsTraining(true);
    setTrainAllResult(null);
    try {
      const response = await api.nlp.trainAllModels({ trained_by: 1 });
      if (response) {
        setTrainAllResult(response as unknown as MLTrainAllResult);
        showToast('success', '全部模型训练成功');
        fetchModelEvaluation();
        fetchTrainingHistory();
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      logger.error('模型训练失败:', error);
      showToast('error', '模型训练失败: ' + ((error as Error).message || '请稍后重试'));
    } finally {
      setIsTraining(false);
    }
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEvaluateAllModels = useCallback(async () => {
    setIsEvaluatingAll(true);
    setEvaluationAllResult(null);
    try {
      const response = await api.nlp.evaluateAllModels();
      if (response) {
        setEvaluationAllResult(response as unknown as MLEvaluationAllResult);
        showToast('success', '评估完成');
      } else {
        showToast('error', '操作失败');
      }
    } catch (error) {
      showToast('error', '评估失败');
    } finally {
      setIsEvaluatingAll(false);
    }
  }, [showToast]);

  const fetchAlgorithms = useCallback(async () => {
    try {
      const response = await api.nlp.getAlgorithms();
      if (response) {
        setAlgorithms(response as unknown as MLAlgorithm[]);
        setLoadError(false);
      }
    } catch (error) {
      logger.error('获取算法列表失败', error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    fetchAlgorithms();
  }, [fetchAlgorithms]);

  // —— 训练对比表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const trainingResultColumns = useMemo<ReturnType<typeof buildTrainingResultColumns>>(
    () => buildTrainingResultColumns(trainAllResult),
    [trainAllResult]
  );

  return {
    algorithms,
    isTraining,
    setIsTraining,
    selectedAlgorithm,
    setSelectedAlgorithm,
    useCrossValidation,
    setUseCrossValidation,
    modelEvaluation,
    trainingResult,
    setTrainingResult,
    trainAllResult,
    setTrainAllResult,
    isEvaluatingAll,
    setIsEvaluatingAll,
    evaluationAllResult,
    setEvaluationAllResult,
    trainingHistory,
    trainingResultColumns,
    handleTrainModel,
    handleTrainAllModels,
    handleEvaluateAllModels,
    setModelEvaluation,
    fetchModelEvaluation,
    fetchTrainingHistory,
  };
}
