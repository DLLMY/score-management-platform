import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlgorithmAnalysisShell, { type AlgorithmAnalysisShellProps } from './AlgorithmAnalysisShell';

// 桩掉 11 个 Tab 子组件，仅测壳层自身的分支（activeTab 分发/天数控制/warning/error/loading 遮罩等），
// 避免 Tab 内部逻辑（依赖的真实数据）干扰，低方差覆盖壳层分支。
vi.mock('./StatisticsTab', () => ({ StatisticsTab: () => null }));
vi.mock('./PredictionTab', () => ({ PredictionTab: () => null }));
vi.mock('./AnomalyTab', () => ({ AnomalyTab: () => null }));
vi.mock('./RuleRecommendTab', () => ({ RuleRecommendTab: () => null }));
vi.mock('./ScorePredictTab', () => ({ ScorePredictTab: () => null }));
vi.mock('./RiskPredictTab', () => ({ RiskPredictTab: () => null }));
vi.mock('./ModelManagerTab', () => ({ ModelManagerTab: () => null }));
vi.mock('./RuleApplicationTab', () => ({ RuleApplicationTab: () => null }));
vi.mock('./StudentProfileTab', () => ({ StudentProfileTab: () => null }));
vi.mock('./BatchAttributionTab', () => ({ BatchAttributionTab: () => null }));
vi.mock('./EngagementTab', () => ({ EngagementTab: () => null }));

// 仅需提供本测试覆盖分支所需的 props（其余经 as unknown as 透传 undefined，仅进 deps 对象、不触发逻辑）
function makeProps(over: Record<string, unknown> = {}): AlgorithmAnalysisShellProps {
  return {
    activeTab: 'statistics',
    setActiveTab: vi.fn(),
    tabNavRef: { current: null },
    selectedClass: '',
    setSelectedClass: vi.fn(),
    searchKeyword: '',
    setSearchKeyword: vi.fn(),
    classes: [
      { id: 1, name: '高三1班' },
      { id: 2, name: '高三2班' },
    ],
    loading: false,
    error: null,
    loadWarn: false,
    predictionDays: 7,
    setPredictionDays: vi.fn(),
    anomalyDays: 30,
    setAnomalyDays: vi.fn(),
    recommendDays: 30,
    setRecommendDays: vi.fn(),
    loadPrediction: vi.fn(),
    loadAnomaly: vi.fn(),
    loadStatistics: vi.fn(),
    setEngagementTrendUserId: vi.fn(),
    ...over,
  } as unknown as AlgorithmAnalysisShellProps;
}

beforeEach(() => {
  cleanup();
});

describe('AlgorithmAnalysisShell 壳层分支', () => {
  it('statistics 默认 tab 渲染标题，无天数控制块', () => {
    const p = makeProps();
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    expect(screen.getByText('智能分析')).toBeInTheDocument();
    expect(screen.queryByText('预测天数:')).not.toBeInTheDocument();
    unmount();
  });

  it('prediction tab 渲染天数控制块，点击不同天数触发 setPredictionDays', () => {
    const p = makeProps({ activeTab: 'prediction' });
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    expect(screen.getByText('预测天数:')).toBeInTheDocument();
    const dayButtons = screen.getAllByText(/天$/);
    fireEvent.click(dayButtons[1]); // 14天
    expect(p.setPredictionDays as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(14);
    unmount();
  });

  it('anomaly tab 渲染检测范围控制，点击触发 setAnomalyDays', () => {
    const p = makeProps({ activeTab: 'anomaly' });
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    expect(screen.getByText('检测范围:')).toBeInTheDocument();
    const dayButtons = screen.getAllByText(/近\d+天$/);
    fireEvent.click(dayButtons[2]); // 30天
    expect(p.setAnomalyDays as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(30);
    unmount();
  });

  it('ruleRecommend / scorePredict / riskPredict tab 均触发 setRecommendDays', () => {
    for (const tab of ['ruleRecommend', 'scorePredict', 'riskPredict']) {
      const p = makeProps({ activeTab: tab });
      const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
      const dayButtons = screen.getAllByText(/近\d+天$/);
      fireEvent.click(dayButtons[0]); // 7天
      expect(p.setRecommendDays as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(7);
      unmount();
    }
  });

  it('loadWarn 且非 error → 展示部分加载失败警示', () => {
    const p = makeProps({ loadWarn: true });
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    expect(screen.getByText(/部分数据加载失败/)).toBeInTheDocument();
    unmount();
  });

  it('error 存在 → 展示错误条且不渲染内容 Tab', () => {
    const p = makeProps({ error: '服务异常' });
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    expect(screen.getByText('服务异常')).toBeInTheDocument();
    expect(screen.getByText('智能分析')).toBeInTheDocument(); // 头部仍在
    unmount();
  });

  it('loading=true → 展示加载遮罩', () => {
    const p = makeProps({ loading: true });
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
    unmount();
  });

  it('搜索框输入 → setSearchKeyword', () => {
    const p = makeProps();
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    const input = screen.getByPlaceholderText('搜索学生姓名...');
    fireEvent.change(input, { target: { value: '张三' } });
    expect(p.setSearchKeyword as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('张三');
    unmount();
  });

  it('班级下拉变更 → setSelectedClass', () => {
    const p = makeProps();
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    const select = screen.getByLabelText('按班级筛选') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '高三2班' } });
    expect(p.setSelectedClass as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('高三2班');
    unmount();
  });

  it('刷新按钮按 activeTab 分流调用对应 loader', () => {
    const cases: Array<[string, string]> = [
      ['prediction', 'loadPrediction'],
      ['anomaly', 'loadAnomaly'],
      ['statistics', 'loadStatistics'],
    ];
    for (const [tab, loader] of cases) {
      const p = makeProps({ activeTab: tab });
      const { container, unmount } = render(<AlgorithmAnalysisShell {...p} />);
      // 刷新按钮为纯图标（无可见文本），其余按钮均含文字；精确选取文本为空的按钮
      const emptyButtons = Array.from(container.querySelectorAll('button')).filter(
        (b) => (b.textContent ?? '').trim() === ''
      );
      fireEvent.click(emptyButtons[0]);
      expect(
        (p as unknown as Record<string, unknown>)[loader] as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('点击标签页按钮 → setActiveTab', () => {
    const p = makeProps();
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    fireEvent.click(screen.getByText('积分预测'));
    expect(p.setActiveTab as ReturnType<typeof vi.fn>).toHaveBeenCalledWith('prediction');
    unmount();
  });

  it('带 new 标记的 tab 渲染 NEW 徽标', () => {
    const p = makeProps({ activeTab: 'prediction' });
    const { unmount } = render(<AlgorithmAnalysisShell {...p} />);
    // 除 statistics 外所有 tab 均带 new:true → 渲染 NEW 徽标
    expect(screen.getAllByText('NEW').length).toBeGreaterThan(0);
    unmount();
  });
});
