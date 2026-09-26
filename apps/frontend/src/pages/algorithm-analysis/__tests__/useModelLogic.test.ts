import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelLogic, type ModelLogicDeps } from '../useModelLogic';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    algorithm: {
      trainRuleRecommendModel: vi.fn(),
      evaluateRuleRecommendModel: vi.fn(),
      trainScorePredictModel: vi.fn(),
      evaluateScorePredictModel: vi.fn(),
      trainRiskPredictModel: vi.fn(),
      evaluateRiskPredictModel: vi.fn(),
    },
  },
}));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// 注意：本测试位于 pages/algorithm-analysis/__tests__/（比源文件深一级），
// mock 路径须多一层 `..` 才能命中 src/services/api（同 B16 记录的 __tests__ 坑）。
vi.mock('../../../services/api', () => ({ default: mockApi }));
vi.mock('../../../utils/logger', () => ({ default: mockLogger }));

type ShowToast = ModelLogicDeps['showToast'];

describe('useModelLogic', () => {
  let showToast: ShowToast;

  const setup = () => {
    showToast = vi.fn() as unknown as ShowToast;
    return renderHook(() => useModelLogic({ showToast }));
  };

  beforeEach(() => {
    Object.values(mockApi.algorithm).forEach((fn) => fn.mockReset());
    mockLogger.error.mockClear();
  });

  it('初始状态为空的模型数据且无进行中的任务', () => {
    const { result } = setup();
    expect(result.current.modelTrainingData).toEqual({});
    expect(result.current.modelEvaluationData).toEqual({});
    expect(result.current.trainingModel).toBeNull();
    expect(result.current.evaluatingModel).toBeNull();
  });

  describe('trainRuleModel', () => {
    it('成功：写入 modelTrainingData 并提示后端 message（默认 90 天）', async () => {
      const data = { message: '训练完毕', version: 'v1' };
      mockApi.algorithm.trainRuleRecommendModel.mockResolvedValue(data);
      const { result } = setup();

      await act(async () => {
        await result.current.trainRuleModel();
      });

      expect(mockApi.algorithm.trainRuleRecommendModel).toHaveBeenCalledWith(90);
      expect(result.current.modelTrainingData.ruleRecommend).toEqual(data);
      expect(showToast).toHaveBeenCalledWith('success', '训练完毕');
      expect(result.current.trainingModel).toBeNull();
    });

    it('自定义天数透传；后端无 message 时使用兜底文案', async () => {
      mockApi.algorithm.trainRuleRecommendModel.mockResolvedValue({});
      const { result } = setup();

      await act(async () => {
        await result.current.trainRuleModel(60);
      });

      expect(mockApi.algorithm.trainRuleRecommendModel).toHaveBeenCalledWith(60);
      expect(showToast).toHaveBeenCalledWith('success', '规则推荐模型训练完成');
    });

    it('失败：记录日志、错误提示并复位 loading', async () => {
      const err = new Error('train failed');
      mockApi.algorithm.trainRuleRecommendModel.mockRejectedValue(err);
      const { result } = setup();

      await act(async () => {
        await result.current.trainRuleModel();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('训练规则推荐模型失败:', err);
      expect(showToast).toHaveBeenCalledWith('error', '训练规则推荐模型失败');
      expect(result.current.trainingModel).toBeNull();
      expect(result.current.modelTrainingData.ruleRecommend).toBeUndefined();
    });

    it('执行期间 trainingModel 置为 ruleRecommend', async () => {
      const data = { message: 'ok' };
      let release!: (value: typeof data) => void;
      mockApi.algorithm.trainRuleRecommendModel.mockReturnValue(
        new Promise<typeof data>((resolve) => {
          release = resolve;
        })
      );
      const { result } = setup();

      act(() => {
        void result.current.trainRuleModel();
      });
      await waitFor(() => expect(result.current.trainingModel).toBe('ruleRecommend'));

      await act(async () => {
        release(data);
      });
      await waitFor(() => expect(result.current.trainingModel).toBeNull());
    });
  });

  describe('evaluateRuleModel', () => {
    it('成功：写入 modelEvaluationData 且默认 30 天（不弹成功提示）', async () => {
      const data = { accuracy: 0.91 };
      mockApi.algorithm.evaluateRuleRecommendModel.mockResolvedValue(data);
      const { result } = setup();

      await act(async () => {
        await result.current.evaluateRuleModel();
      });

      expect(mockApi.algorithm.evaluateRuleRecommendModel).toHaveBeenCalledWith(30);
      expect(result.current.modelEvaluationData.ruleRecommend).toEqual(data);
      expect(showToast).not.toHaveBeenCalled();
      expect(result.current.evaluatingModel).toBeNull();
    });

    it('失败：错误提示', async () => {
      const err = new Error('eval failed');
      mockApi.algorithm.evaluateRuleRecommendModel.mockRejectedValue(err);
      const { result } = setup();

      await act(async () => {
        await result.current.evaluateRuleModel();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('评估规则推荐模型失败:', err);
      expect(showToast).toHaveBeenCalledWith('error', '评估规则推荐模型失败');
    });
  });

  describe('trainScoreModel / evaluateScoreModel', () => {
    it('训练成功写入 scorePredict 并提示', async () => {
      const data = { message: '成绩模型就绪' };
      mockApi.algorithm.trainScorePredictModel.mockResolvedValue(data);
      const { result } = setup();

      await act(async () => {
        await result.current.trainScoreModel();
      });

      expect(mockApi.algorithm.trainScorePredictModel).toHaveBeenCalledWith(90);
      expect(result.current.modelTrainingData.scorePredict).toEqual(data);
      expect(showToast).toHaveBeenCalledWith('success', '成绩模型就绪');
    });

    it('训练失败提示错误', async () => {
      const err = new Error('score train failed');
      mockApi.algorithm.trainScorePredictModel.mockRejectedValue(err);
      const { result } = setup();

      await act(async () => {
        await result.current.trainScoreModel();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('训练成绩预测模型失败:', err);
      expect(showToast).toHaveBeenCalledWith('error', '训练成绩预测模型失败');
    });

    it('评估成功写入 scorePredict 评估数据', async () => {
      const data = { mae: 0.3 };
      mockApi.algorithm.evaluateScorePredictModel.mockResolvedValue(data);
      const { result } = setup();

      await act(async () => {
        await result.current.evaluateScoreModel();
      });

      expect(mockApi.algorithm.evaluateScorePredictModel).toHaveBeenCalledWith(30);
      expect(result.current.modelEvaluationData.scorePredict).toEqual(data);
      expect(showToast).not.toHaveBeenCalled();
    });

    it('评估失败提示错误', async () => {
      const err = new Error('score eval failed');
      mockApi.algorithm.evaluateScorePredictModel.mockRejectedValue(err);
      const { result } = setup();

      await act(async () => {
        await result.current.evaluateScoreModel();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('评估成绩预测模型失败:', err);
      expect(showToast).toHaveBeenCalledWith('error', '评估成绩预测模型失败');
    });
  });

  describe('trainRiskModel / evaluateRiskModel', () => {
    it('训练成功写入 riskPredict 并提示（可选链取 message）', async () => {
      const data = { message: '风险模型就绪' };
      mockApi.algorithm.trainRiskPredictModel.mockResolvedValue(data);
      const { result } = setup();

      await act(async () => {
        await result.current.trainRiskModel();
      });

      expect(mockApi.algorithm.trainRiskPredictModel).toHaveBeenCalledWith(90);
      expect(result.current.modelTrainingData.riskPredict).toEqual(data);
      expect(showToast).toHaveBeenCalledWith('success', '风险模型就绪');
    });

    it('训练失败提示错误', async () => {
      const err = new Error('risk train failed');
      mockApi.algorithm.trainRiskPredictModel.mockRejectedValue(err);
      const { result } = setup();

      await act(async () => {
        await result.current.trainRiskModel();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('训练风险预测模型失败:', err);
      expect(showToast).toHaveBeenCalledWith('error', '训练风险预测模型失败');
      expect(result.current.trainingModel).toBeNull();
    });

    it('评估成功写入 riskPredict 评估数据', async () => {
      const data = { recall: 0.8 };
      mockApi.algorithm.evaluateRiskPredictModel.mockResolvedValue(data);
      const { result } = setup();

      await act(async () => {
        await result.current.evaluateRiskModel();
      });

      expect(mockApi.algorithm.evaluateRiskPredictModel).toHaveBeenCalledWith(30);
      expect(result.current.modelEvaluationData.riskPredict).toEqual(data);
    });

    it('评估失败提示错误', async () => {
      const err = new Error('risk eval failed');
      mockApi.algorithm.evaluateRiskPredictModel.mockRejectedValue(err);
      const { result } = setup();

      await act(async () => {
        await result.current.evaluateRiskModel();
      });

      expect(mockLogger.error).toHaveBeenCalledWith('评估风险预测模型失败:', err);
      expect(showToast).toHaveBeenCalledWith('error', '评估风险预测模型失败');
      expect(result.current.evaluatingModel).toBeNull();
    });
  });

  it('多次评估累计写入不同模型键，互不覆盖', async () => {
    mockApi.algorithm.evaluateRuleRecommendModel.mockResolvedValue({ a: 1 });
    mockApi.algorithm.evaluateScorePredictModel.mockResolvedValue({ b: 2 });
    const { result } = setup();

    await act(async () => {
      await result.current.evaluateRuleModel();
      await result.current.evaluateScoreModel();
    });

    expect(result.current.modelEvaluationData).toEqual({
      ruleRecommend: { a: 1 },
      scorePredict: { b: 2 },
    });
  });
});
