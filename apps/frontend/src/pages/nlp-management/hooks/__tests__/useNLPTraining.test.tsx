import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNLPTraining } from '../useNLPTraining';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    nlp: {
      getAlgorithms: vi.fn(),
      evaluateModel: vi.fn(),
      getTrainingHistory: vi.fn(),
      trainModel: vi.fn(),
      trainAllModels: vi.fn(),
      evaluateAllModels: vi.fn(),
    },
  },
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../../columns', () => ({ buildTrainingResultColumns: vi.fn(() => []) }));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    showToast: vi.fn(),
    setLoadError: vi.fn(),
    ...overrides,
  } as never;
}

describe('useNLPTraining · NLP 模型训练', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.nlp.getAlgorithms.mockResolvedValue([{ name: 'svm' }, { name: 'rf' }]);
    mockApi.nlp.evaluateModel.mockResolvedValue({ accuracy: 0.9 });
    mockApi.nlp.getTrainingHistory.mockResolvedValue({ items: [{ id: 1 }], total: 1 });
    mockApi.nlp.trainModel.mockResolvedValue({ model: 'x' });
    mockApi.nlp.trainAllModels.mockResolvedValue({ models: ['a', 'b'] });
    mockApi.nlp.evaluateAllModels.mockResolvedValue({ all: 1 });
  });

  it('挂载即拉取算法列表并暴露 algorithms / 清除 loadError', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    expect(params.setLoadError).toHaveBeenCalledWith(false);
    expect(mockApi.nlp.getAlgorithms).toHaveBeenCalledTimes(1);
  });

  it('getAlgorithms 失败 → setLoadError(true)', async () => {
    mockApi.nlp.getAlgorithms.mockRejectedValueOnce(new Error('list failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(mockApi.nlp.getAlgorithms).toHaveBeenCalled());
    expect(params.setLoadError).toHaveBeenCalledWith(true);
  });

  it('handleTrainModel：未选算法 → 警告不调用', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    await act(async () => {
      await result.current.handleTrainModel();
    });
    expect(params.showToast).toHaveBeenCalledWith('warning', '请先选择算法，或使用「训练全部模型」');
    expect(mockApi.nlp.trainModel).not.toHaveBeenCalled();
  });

  it('handleTrainModel：选中算法 → 训练成功 + 刷新评估/历史', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    act(() => result.current.setSelectedAlgorithm('svm'));
    await act(async () => {
      await result.current.handleTrainModel();
    });
    expect(mockApi.nlp.trainModel).toHaveBeenCalledWith(
      expect.objectContaining({ algorithm: 'svm', trained_by: 1 })
    );
    expect(result.current.trainingResult).toEqual({ model: 'x' });
    expect(params.showToast).toHaveBeenCalledWith('success', '模型训练成功');
    expect(result.current.modelEvaluation).toEqual({ accuracy: 0.9 });
    expect(result.current.trainingHistory).toHaveLength(1);
  });

  it('handleTrainModel：接口抛错 → error toast', async () => {
    mockApi.nlp.trainModel.mockRejectedValue(new Error('train failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    act(() => result.current.setSelectedAlgorithm('svm'));
    await act(async () => {
      await result.current.handleTrainModel();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('模型训练失败'));
  });

  it('handleTrainAllModels：训练全部模型成功', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    await act(async () => {
      await result.current.handleTrainAllModels();
    });
    expect(mockApi.nlp.trainAllModels).toHaveBeenCalledWith({ trained_by: 1 });
    expect(result.current.trainAllResult).toEqual({ models: ['a', 'b'] });
    expect(params.showToast).toHaveBeenCalledWith('success', '全部模型训练成功');
  });

  it('handleEvaluateAllModels：评估完成', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    await act(async () => {
      await result.current.handleEvaluateAllModels();
    });
    expect(mockApi.nlp.evaluateAllModels).toHaveBeenCalled();
    expect(result.current.evaluationAllResult).toEqual({ all: 1 });
    expect(params.showToast).toHaveBeenCalledWith('success', '评估完成');
  });

  it('fetchModelEvaluation / fetchTrainingHistory 可直接调用', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPTraining(params));
    await waitFor(() => expect(result.current.algorithms).toHaveLength(2));
    await act(async () => {
      await result.current.fetchModelEvaluation();
      await result.current.fetchTrainingHistory();
    });
    expect(result.current.modelEvaluation).toEqual({ accuracy: 0.9 });
    expect(result.current.trainingHistory).toHaveLength(1);
  });
});
