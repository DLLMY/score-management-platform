import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalysisTab } from '../AnalysisTab';
import type {
  NLPDeps,
  NlpAnalysisData,
  NlpBenchmarkResult,
  NlpSuggestion,
  NlpOptimizerConfig,
} from '../types';

const noop = vi.fn();
const perfColumns = [] as any;

const baseDeps: {
  isLoadingAnalysis: boolean;
  fetchAnalysisData: typeof noop;
  runBenchmark: typeof noop;
  isBenchmarking: boolean;
  resetAnalysisMetrics: typeof noop;
  intentAnalysis: NlpAnalysisData | null;
  performanceAnalysis: NlpAnalysisData | null;
  updateOptimizationStrategy: typeof noop;
  selectedStrategy: string;
  optimizerConfig: NlpOptimizerConfig | null;
  benchmarkResults: NlpBenchmarkResult | null;
  optimizationSuggestions: NlpSuggestion[];
  performanceColumns: typeof perfColumns;
} = {
  isLoadingAnalysis: false,
  fetchAnalysisData: noop,
  runBenchmark: noop,
  isBenchmarking: false,
  resetAnalysisMetrics: noop,
  intentAnalysis: null,
  performanceAnalysis: null,
  updateOptimizationStrategy: noop,
  selectedStrategy: '',
  optimizerConfig: null,
  benchmarkResults: null,
  optimizationSuggestions: [],
  performanceColumns: perfColumns,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as NLPDeps;
  return render(<AnalysisTab deps={deps} />);
}

const analysisFull: NlpAnalysisData = {
  summary: {
    accuracy: 0.95,
    cache_hit_rate: 0.7,
    avg_processing_time: 0.23,
    total_requests: 1200,
  },
  intent_breakdown: {
    add: { total: 100, correct: 95, accuracy: 0.95 },
    deduct: { total: 80, correct: 70, accuracy: 0.875 },
    query: { total: 50, correct: 30, accuracy: 0.6 },
    reset: { total: 20, correct: 10, accuracy: null as any },
    weird: { total: 10, correct: 5 },
  },
  components: { login: { calls: 100, avg_time: 0.05, error_rate: 0.01 } },
  slow_requests: [{ timestamp: '2024-01-01', processing_time: 1.5 }],
};

const bench: NlpBenchmarkResult = {
  avg_latency: 123.45,
  p95_latency: 200.1,
  avg_accuracy: 0.88,
  throughput: 50.5,
};

const optimizer: NlpOptimizerConfig = {
  intent_classifier: { tfidf_max_features: 5000, tfidf_ngram_range: [1, 3] },
  performance: { cache_ttl: 3600 },
};

const optimizerNoNgram: NlpOptimizerConfig = {
  intent_classifier: { tfidf_max_features: 5000 },
  performance: { cache_ttl: 3600 },
};

const optSugs: NlpSuggestion[] = [
  { priority: 'high', issue: '高优问题', suggestions: ['a', 'b'] },
  { priority: 'medium', issue: '中优问题', suggestions: ['c'] },
  { priority: 'low', issue: '低优问题', suggestions: [] },
  { priority: 'other', issue: '其他问题' },
];

describe('AnalysisTab', () => {
  it('isLoadingAnalysis=true：仅显示加载图标', () => {
    const { container } = renderWith({ isLoadingAnalysis: true });
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByText('刷新数据')).toBeNull();
  });

  it('isBenchmarking=true：按钮显示测试中...', () => {
    renderWith({ isBenchmarking: true });
    expect(screen.getByText('测试中...')).toBeInTheDocument();
    expect(screen.queryByText('运行基准测试')).toBeNull();
  });

  it('完整数据：渲染意图识别/性能/优化/基准/慢请求全部区块', () => {
    const { container } = renderWith({
      intentAnalysis: analysisFull,
      performanceAnalysis: analysisFull,
      optimizerConfig: optimizer,
      benchmarkResults: bench,
      optimizationSuggestions: optSugs,
      selectedStrategy: 'accuracy_first',
    });
    // 性能概览
    expect(screen.getByText('意图识别准确率')).toBeInTheDocument();
    expect(container.textContent).toContain('95.0%'); // summary accuracy
    expect(container.textContent).toContain('70.0%'); // cache_hit_rate
    expect(screen.getByText('1200')).toBeInTheDocument(); // total_requests
    expect(container.textContent).toContain('0.23ms'); // avg_processing_time
    // 意图识别分析：四档 + 未知 + 准确率分档
    expect(screen.getByText('加分')).toBeInTheDocument();
    expect(screen.getByText('扣分')).toBeInTheDocument();
    expect(screen.getByText('查询')).toBeInTheDocument();
    expect(screen.getByText('重置')).toBeInTheDocument();
    expect(screen.getByText('未知')).toBeInTheDocument();
    expect(container.textContent).toContain('95.0%');
    expect(container.textContent).toContain('87.5%');
    expect(container.textContent).toContain('60.0%');
    expect(container.querySelector('.bg-green-500')).toBeTruthy(); // accuracy>=0.9
    expect(container.querySelector('.bg-yellow-500')).toBeTruthy(); // 0.7-0.9
    expect(container.querySelector('.bg-red-500')).toBeTruthy(); // <0.7
    // 优化策略配置
    expect(screen.getByText('准确性优先')).toBeInTheDocument();
    expect(container.textContent).toContain('TF-IDF特征数=5000');
    expect(container.textContent).toContain('N-gram范围=(1, 3)');
    expect(container.textContent).toContain('缓存TTL=3600s');
    // 组件性能表格（空数据）
    expect(screen.getByText('组件性能')).toBeInTheDocument();
    // 基准测试
    expect(screen.getByText('基准测试结果')).toBeInTheDocument();
    expect(container.textContent).toContain('123.45ms');
    expect(container.textContent).toContain('200.10ms');
    expect(container.textContent).toContain('88.0%');
    expect(container.textContent).toContain('50.5/s');
    // 优化建议三档 + 其他
    expect(screen.getByText('高优问题')).toBeInTheDocument();
    expect(screen.getByText('中优问题')).toBeInTheDocument();
    expect(screen.getByText('低优问题')).toBeInTheDocument();
    expect(screen.getByText('其他问题')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument(); // suggestion list
    // 慢请求
    expect(screen.getByText('最近慢请求')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    expect(container.textContent).toContain('1500.00ms'); // processing_time*1000
  });

  it('summary 各指标为 null/undefined：显示 --', () => {
    renderWith({
      intentAnalysis: {
        summary: {
          accuracy: null as any,
          cache_hit_rate: null as any,
          avg_processing_time: null as any,
          total_requests: undefined as any,
        },
      },
    });
    // accuracy/cache/avg_processing 三处 --，total_requests 一处 -- → 至少 4 个
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(4);
  });

  it('optimizerConfig 缺 tfidf_ngram_range：N-gram 兜底为 4', () => {
    const { container } = renderWith({
      optimizerConfig: optimizerNoNgram,
    });
    expect(container.textContent).toContain('N-gram范围=(1, 4)');
  });

  it('optimizerConfig=null：不渲染当前配置块', () => {
    renderWith({ optimizerConfig: null });
    expect(screen.queryByText(/TF-IDF特征数/)).toBeNull();
  });

  it('benchmarkResults=null：不渲染基准测试块', () => {
    renderWith({ benchmarkResults: null });
    expect(screen.queryByText('基准测试结果')).toBeNull();
  });

  it('optimizationSuggestions 为空：不渲染优化建议块', () => {
    renderWith({ optimizationSuggestions: [] });
    expect(screen.queryByText('优化建议')).toBeNull();
  });

  it('intent_breakdown / components / slow_requests 缺失：对应明细区块不渲染', () => {
    renderWith({ performanceAnalysis: { summary: { total_requests: 5 } } as any });
    // 意图识别分析 h3 始终渲染，但 intent_breakdown 未提供 → 各意图明细（加分/扣分）不渲染
    expect(screen.queryByText('加分')).toBeNull();
    expect(screen.queryByText('扣分')).toBeNull();
    // slow_requests 未提供 → 不渲染慢请求区块
    expect(screen.queryByText('最近慢请求')).toBeNull();
  });

  it('selectedStrategy 高亮 + 点击策略按钮触发回调', () => {
    const update = vi.fn();
    const { container } = renderWith({
      intentAnalysis: analysisFull,
      performanceAnalysis: analysisFull,
      selectedStrategy: 'balanced',
      updateOptimizationStrategy: update,
    });
    const balancedBtn = screen.getByText('平衡模式').closest('button')!;
    expect(container.querySelector('.border-blue-500')).toBeTruthy();
    fireEvent.click(balancedBtn);
    expect(update).toHaveBeenCalledWith('balanced');
  });

  it('操作按钮：刷新/运行基准/重置 各自触发回调', () => {
    const fetchData = vi.fn();
    const run = vi.fn();
    const reset = vi.fn();
    renderWith({
      intentAnalysis: analysisFull,
      performanceAnalysis: analysisFull,
      fetchAnalysisData: fetchData,
      runBenchmark: run,
      resetAnalysisMetrics: reset,
    });
    fireEvent.click(screen.getByText('刷新数据'));
    expect(fetchData).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('运行基准测试'));
    expect(run).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('重置指标'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
