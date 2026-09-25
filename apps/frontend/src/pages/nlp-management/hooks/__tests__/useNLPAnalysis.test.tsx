import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNLPAnalysis } from '../useNLPAnalysis';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    nlp: {
      getAnalysisIntent: vi.fn(),
      getAnalysisPerformance: vi.fn(),
      getAnalysisSuggestions: vi.fn(),
      getOptimizationConfig: vi.fn(),
      benchmarkIntentClassifier: vi.fn(),
      setOptimizationConfig: vi.fn(),
      resetAnalysis: vi.fn(),
    },
  },
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../../columns', () => ({ buildPerformanceColumns: vi.fn(() => []) }));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    showToast: vi.fn(),
    setLoadError: vi.fn(),
    ...overrides,
  } as never;
}

const ENV = { code: 0, data: { k: 1 } };

describe('useNLPAnalysis · NLP 算法分析', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.nlp.getAnalysisIntent.mockResolvedValue({ code: 0, data: { intent: 'a' } });
    mockApi.nlp.getAnalysisPerformance.mockResolvedValue({ code: 0, data: { perf: 'b' } });
    mockApi.nlp.getAnalysisSuggestions.mockResolvedValue({ code: 0, data: [{ s: 1 }] });
    mockApi.nlp.getOptimizationConfig.mockResolvedValue({ code: 0, data: { strategy: 'balanced' } });
    mockApi.nlp.benchmarkIntentClassifier.mockResolvedValue({ score: 0.9 });
    mockApi.nlp.setOptimizationConfig.mockResolvedValue({ strategy: 'aggressive' });
    mockApi.nlp.resetAnalysis.mockResolvedValue({});
  });

  it('fetchAnalysisData：四路并行成功 → 写入状态并清除 loadError', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.fetchAnalysisData();
    });
    expect(mockApi.nlp.getAnalysisIntent).toHaveBeenCalled();
    expect(result.current.intentAnalysis).toEqual({ intent: 'a' });
    expect(result.current.performanceAnalysis).toEqual({ perf: 'b' });
    expect(result.current.optimizationSuggestions).toEqual([{ s: 1 }]);
    expect(result.current.optimizerConfig).toEqual({ strategy: 'balanced' });
    expect(params.setLoadError).toHaveBeenCalledWith(false);
  });

  it('fetchAnalysisData：某路抛错 → setLoadError(true)', async () => {
    mockApi.nlp.getAnalysisIntent.mockRejectedValueOnce(new Error('intent failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.fetchAnalysisData();
    });
    expect(params.setLoadError).toHaveBeenCalledWith(true);
  });

  it('runBenchmark：基准测试成功', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.runBenchmark();
    });
    expect(mockApi.nlp.benchmarkIntentClassifier).toHaveBeenCalledWith({ iterations: 10 });
    expect(result.current.benchmarkResults).toEqual({ score: 0.9 });
    expect(params.showToast).toHaveBeenCalledWith('success', '基准测试完成');
  });

  it('runBenchmark：抛错 → error toast', async () => {
    mockApi.nlp.benchmarkIntentClassifier.mockRejectedValue(new Error('bench failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.runBenchmark();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '基准测试失败');
  });

  it('updateOptimizationStrategy：更新成功并回刷分析数据', async () => {
    // 更新后 fetchAnalysisData 会回刷 optimizerConfig，服务端应返回新值 → 让 mock 同步
    mockApi.nlp.getOptimizationConfig.mockResolvedValue({ code: 0, data: { strategy: 'aggressive' } });
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.updateOptimizationStrategy('aggressive');
    });
    expect(mockApi.nlp.setOptimizationConfig).toHaveBeenCalledWith({ strategy: 'aggressive' });
    expect(result.current.optimizerConfig).toEqual({ strategy: 'aggressive' });
    expect(result.current.selectedStrategy).toBe('aggressive');
    expect(params.showToast).toHaveBeenCalledWith('success', '优化策略已更新');
  });

  it('updateOptimizationStrategy：抛错 → error toast', async () => {
    mockApi.nlp.setOptimizationConfig.mockRejectedValue(new Error('set failed'));
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.updateOptimizationStrategy('aggressive');
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '更新优化策略失败');
  });

  it('resetAnalysisMetrics：重置成功并回刷', async () => {
    const params = makeParams();
    const { result } = renderHook(() => useNLPAnalysis(params));
    await act(async () => {
      await result.current.resetAnalysisMetrics();
    });
    expect(mockApi.nlp.resetAnalysis).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith('success', '指标已重置');
  });
});
