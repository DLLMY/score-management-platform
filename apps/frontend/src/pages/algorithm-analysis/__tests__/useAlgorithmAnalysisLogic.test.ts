import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAlgorithmAnalysisLogic } from '../useAlgorithmAnalysisLogic';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    algorithm: {
      getStatistics: vi.fn(),
      getBatchPrediction: vi.fn(),
      getRiskStudents: vi.fn(),
      getBatchAnomaly: vi.fn(),
      getRuleRecommend: vi.fn(),
      getBatchScorePredict: vi.fn(),
      getBatchRiskPredict: vi.fn(),
    },
  },
}));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
const { tabHolder } = vi.hoisted(() => ({ tabHolder: { value: '' } }));

vi.mock('../../../services/api', () => ({ default: mockApi }));
vi.mock('../../../utils/logger', () => ({ default: mockLogger }));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(tabHolder.value)],
}));
vi.mock('../useModelLogic', () => ({ useModelLogic: () => ({ loadModel: vi.fn() }) }));
vi.mock('../useRuleApplicationLogic', () => ({
  useRuleApplicationLogic: () => ({ handleAdjustDistribution: vi.fn() }),
}));
vi.mock('../useStudentProfileLogic', () => ({
  useStudentProfileLogic: () => ({ loadClasses: vi.fn() }),
}));
vi.mock('../useEngagementLogic', () => ({
  useEngagementLogic: () => ({ loadEngagement: vi.fn() }),
}));

beforeEach(() => {
  Object.values(mockApi.algorithm).forEach((fn) => fn.mockReset());
  mockLogger.error.mockClear();
  mockToast.mockClear();
  tabHolder.value = '';
  Element.prototype.scrollIntoView = vi.fn();
});

const setup = () => renderHook(() => useAlgorithmAnalysisLogic());

describe('useAlgorithmAnalysisLogic', () => {
  it('默认 activeTab 为 statistics', () => {
    const { result } = setup();
    expect(result.current.activeTab).toBe('statistics');
  });

  it('URL ?tab= 合法时作为初始 activeTab', () => {
    tabHolder.value = '?tab=prediction';
    const { result } = setup();
    expect(result.current.activeTab).toBe('prediction');
  });

  it('切换 activeTab 触发 scrollIntoView', async () => {
    const { result } = setup();
    // 壳层会把 tabNavRef 挂到真实导航 DOM；这里构造一个含 data-tab 子节点的节点模拟挂载
    const nav = document.createElement('div');
    const tab = document.createElement('div');
    tab.setAttribute('data-tab', 'anomaly');
    nav.appendChild(tab);
    (result.current.tabNavRef as React.MutableRefObject<HTMLDivElement>).current =
      nav as HTMLDivElement;
    await act(async () => {
      result.current.setActiveTab('anomaly');
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('loadStatistics 成功写入 statistics；失败置 loadWarn', async () => {
    mockApi.algorithm.getStatistics.mockResolvedValue({ total: 10 });
    const { result } = setup();
    await act(async () => {
      await result.current.loadStatistics();
    });
    expect(result.current.statistics).toEqual({ total: 10 });
    expect(result.current.loadWarn).toBe(false);

    mockApi.algorithm.getStatistics.mockRejectedValue(new Error('e'));
    await act(async () => {
      await result.current.loadStatistics();
    });
    expect(result.current.loadWarn).toBe(true);
  });

  it('loadPrediction 成功写入 predictionData 并裁剪 riskStudents 至 10', async () => {
    mockApi.algorithm.getBatchPrediction.mockResolvedValue({ predictions: [{ name: 'A' }] });
    mockApi.algorithm.getRiskStudents.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `s${i}` }))
    );
    const { result } = setup();
    await act(async () => {
      await result.current.loadPrediction();
    });
    expect(result.current.predictionData).toEqual({ predictions: [{ name: 'A' }] });
    expect(result.current.riskStudents).toHaveLength(10);
  });

  it('loadPrediction 失败提示 error', async () => {
    mockApi.algorithm.getBatchPrediction.mockRejectedValue(new Error('boom'));
    const { result } = setup();
    await act(async () => {
      await result.current.loadPrediction();
    });
    expect(mockToast).toHaveBeenCalledWith('error', '加载预测数据失败', undefined);
  });

  it('loadAnomaly 成功/失败', async () => {
    mockApi.algorithm.getBatchAnomaly.mockResolvedValue({ anomalies: [] });
    const { result } = setup();
    await act(async () => {
      await result.current.loadAnomaly();
    });
    expect(result.current.anomalyData).toEqual({ anomalies: [] });
    mockApi.algorithm.getBatchAnomaly.mockRejectedValue(new Error('x'));
    await act(async () => {
      await result.current.loadAnomaly();
    });
    expect(mockToast).toHaveBeenCalledWith('error', '加载异常检测数据失败', undefined);
  });

  it('切换 Tab 自动加载并写入 ruleRecommend/scorePredict/riskPredict 数据', async () => {
    mockApi.algorithm.getRuleRecommend.mockResolvedValue({ rules: [{ id: 1 }] });
    mockApi.algorithm.getBatchScorePredict.mockResolvedValue({ scores: [1] });
    mockApi.algorithm.getBatchRiskPredict.mockResolvedValue({ risks: [2] });
    const { result } = setup();
    await act(async () => {
      result.current.setActiveTab('ruleRecommend');
    });
    await waitFor(() => expect(result.current.ruleRecommendData).toEqual({ rules: [{ id: 1 }] }));
    await act(async () => {
      result.current.setActiveTab('scorePredict');
    });
    await waitFor(() => expect(result.current.scorePredictData).toEqual({ scores: [1] }));
    await act(async () => {
      result.current.setActiveTab('riskPredict');
    });
    await waitFor(() => expect(result.current.riskPredictData).toEqual({ risks: [2] }));
  });

  it('切换 Tab 自动加载对应数据（anomaly / ruleRecommend / scorePredict / riskPredict）', async () => {
    mockApi.algorithm.getBatchAnomaly.mockResolvedValue({ anomalies: [] });
    mockApi.algorithm.getRuleRecommend.mockResolvedValue({ rules: [] });
    mockApi.algorithm.getBatchScorePredict.mockResolvedValue({ scores: [] });
    mockApi.algorithm.getBatchRiskPredict.mockResolvedValue({ risks: [] });
    const { result } = setup();
    await act(async () => {
      result.current.setActiveTab('anomaly');
    });
    await waitFor(() => expect(mockApi.algorithm.getBatchAnomaly).toHaveBeenCalled());
    await act(async () => {
      result.current.setActiveTab('ruleRecommend');
    });
    await waitFor(() => expect(mockApi.algorithm.getRuleRecommend).toHaveBeenCalled());
    await act(async () => {
      result.current.setActiveTab('scorePredict');
    });
    await waitFor(() => expect(mockApi.algorithm.getBatchScorePredict).toHaveBeenCalled());
    await act(async () => {
      result.current.setActiveTab('riskPredict');
    });
    await waitFor(() => expect(mockApi.algorithm.getBatchRiskPredict).toHaveBeenCalled());
  });

  it('filteredPredictions 关键词过滤', async () => {
    mockApi.algorithm.getBatchPrediction.mockResolvedValue({
      predictions: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Alina' }],
    });
    mockApi.algorithm.getRiskStudents.mockResolvedValue([]);
    const { result } = setup();
    await act(async () => {
      await result.current.loadPrediction();
    });
    expect(result.current.filteredPredictions).toHaveLength(3);
    await act(async () => result.current.setSearchKeyword('ali'));
    expect(result.current.filteredPredictions.map((p) => p.name)).toEqual(['Alice', 'Alina']);
  });

  it('filteredRiskStudents 关键词过滤', async () => {
    mockApi.algorithm.getRiskStudents.mockResolvedValue([
      { id: 1, name: '张三' },
      { id: 2, name: '李四' },
      { id: 3, name: '张五' },
    ]);
    mockApi.algorithm.getBatchPrediction.mockResolvedValue({ predictions: [] });
    const { result } = setup();
    await act(async () => {
      await result.current.loadPrediction();
    });
    await act(async () => result.current.setSearchKeyword('张'));
    expect(result.current.filteredRiskStudents.map((s) => s.name)).toEqual(['张三', '张五']);
  });
});
