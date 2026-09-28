/**
 * StudentGrowthTab 补测（B33）。
 * 纯展示组件，props 驱动（insights / growthLoading），零 context/网络/store 依赖。
 * 覆盖：参与度指数三态（加载/错误/无数据/有数据）、参与度 level 四态、构成三率空值、参与度周趋势
 * （错误/空序列/上升下降平稳/有效点全缺失/点 has_data 分支/week_label 兜底）、风险预警三档+错误、干预建议
 * 有/无、积分趋势（加载/空/正负）。
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentGrowthTab } from '../StudentGrowthTab';

const renderTab = (insights: any, growthLoading = false) =>
  render(<StudentGrowthTab insights={insights} growthLoading={growthLoading} />);

describe('StudentGrowthTab · 参与度指数卡片', () => {
  it('growthLoading=true → 主指数与积分趋势均显示加载占位', () => {
    renderTab(undefined, true);
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('engagement.error → 显示 "!" 与 "加载失败"/"参与度计算失败"', () => {
    renderTab({ engagement: { error: 'boom' } });
    expect(screen.getByText('!')).toBeInTheDocument();
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('参与度计算失败，请稍后刷新重试')).toBeInTheDocument();
  });

  it('engagement 无 error 且 has_data=false → "—" 与 "暂无数据"', () => {
    renderTab({ engagement: { has_data: false } });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('engagement has_data=true high → 显示分数与 "高参与"', () => {
    renderTab({ engagement: { has_data: true, engagement_score: 88, level: 'high' } });
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('高参与')).toBeInTheDocument();
  });

  it('engagement level medium / low → 对应中文标签', () => {
    const { unmount } = renderTab({
      engagement: { has_data: true, engagement_score: 60, level: 'medium' },
    });
    expect(screen.getByText('中参与')).toBeInTheDocument();
    unmount();
    renderTab({ engagement: { has_data: true, engagement_score: 30, level: 'low' } });
    expect(screen.getByText('低参与')).toBeInTheDocument();
  });

  it('engagement 无 description → 使用默认说明文案', () => {
    renderTab({ engagement: { has_data: true, engagement_score: 70, level: 'low' } });
    expect(screen.getByText('综合出勤、作业提交与积分活跃度评估')).toBeInTheDocument();
  });
});

describe('StudentGrowthTab · 参与度构成三率', () => {
  it('has_data=true 但无 components → 不构成块', () => {
    const { container } = renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
    });
    // 仅图标（TrendingUp 等）为 svg；趋势折线图 svg 的 viewBox 为 0 0 340 140，此处不应出现
    expect(container.querySelector('svg[viewBox="0 0 340 140"]')).toBeNull();
    // has_data=true 时「参与度构成」标题仍渲染，但内部三率 bars 不渲染
    expect(screen.getByText('参与度构成')).toBeInTheDocument();
    expect(screen.queryByText('出勤率')).not.toBeInTheDocument();
  });

  it('三率均非空 → 渲染三条进度条与百分比', () => {
    renderTab({
      engagement: {
        has_data: true,
        engagement_score: 70,
        level: 'low',
        components: { attendance_rate: 0.8, homework_rate: 0.6, activity_rate: 0.9 },
      },
    });
    expect(screen.getByText('出勤率')).toBeInTheDocument();
    expect(screen.getByText('作业提交率')).toBeInTheDocument();
    expect(screen.getByText('积分活跃度')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('仅 attendance_rate 非空（其余 null）→ 只渲染出勤率条', () => {
    renderTab({
      engagement: {
        has_data: true,
        engagement_score: 70,
        level: 'low',
        components: { attendance_rate: 0.5 },
      },
    });
    expect(screen.getByText('出勤率')).toBeInTheDocument();
    expect(screen.queryByText('作业提交率')).not.toBeInTheDocument();
    expect(screen.queryByText('积分活跃度')).not.toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('StudentGrowthTab · 参与度周趋势', () => {
  it('participation_trend.error → 显示失败提示且不渲染 svg', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      participation_trend: { error: 'trend boom' },
    });
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('趋势计算失败，请稍后刷新重试')).toBeInTheDocument();
    expect(screen.queryByLabelText('参与度周趋势')).not.toBeInTheDocument();
  });

  it('participation_trend 无 series / 空数组 → 不渲染 svg（null 分支）', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      participation_trend: { series: [] },
    });
    expect(screen.queryByLabelText('参与度周趋势')).not.toBeInTheDocument();
  });

  it('trend=up/down/flat → 对应中文徽标', () => {
    const base = (trend: string) => ({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      participation_trend: {
        trend,
        series: [{ engagement_score: 80, has_data: true, week_index: 0, week_label: 'W1' }],
      },
    });
    const { unmount } = renderTab(base('up'));
    expect(screen.getByText('上升')).toBeInTheDocument();
    unmount();
    renderTab(base('down'));
    expect(screen.getByText('下降')).toBeInTheDocument();
    unmount();
    renderTab(base('flat'));
    expect(screen.getByText('平稳')).toBeInTheDocument();
  });

  it('所有点 has_data=false → 有效点为空，显示 "暂无参与度趋势数据"', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      participation_trend: {
        trend: 'up',
        series: [{ engagement_score: 80, has_data: false, week_index: 0 }],
      },
    });
    expect(screen.getByText('暂无参与度趋势数据')).toBeInTheDocument();
    expect(screen.queryByLabelText('参与度周趋势')).not.toBeInTheDocument();
  });

  it('混合点（有效+无效）→ 渲染 svg，覆盖 has_data 半径分支与 week_label 兜底', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      participation_trend: {
        trend: 'up',
        series: [
          { engagement_score: 80, has_data: true, week_index: 0, week_label: 'W1' },
          { engagement_score: 40, has_data: false, week_index: 1 },
        ],
      },
    });
    // week_index=1 无 week_label → 回退 "W2"（需图表渲染才出现）
    expect(screen.getByText('W2')).toBeInTheDocument();
    expect(screen.getByLabelText('参与度周趋势')).toBeInTheDocument();
  });
});

describe('StudentGrowthTab · 风险预警卡片', () => {
  it('risk.error → 灰色块 + "加载失败" + "风险评估失败"', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      risk: { error: 'risk boom' },
    });
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    expect(screen.getByText('风险评估失败，请稍后刷新重试')).toBeInTheDocument();
  });

  it('risk high / medium / low → 对应中文徽标', () => {
    const base = (lvl: string) => ({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      risk: { overall_risk_level: lvl, intervention_suggestions: [] },
    });
    const { unmount } = renderTab(base('high'));
    expect(screen.getByText('高风险')).toBeInTheDocument();
    unmount();
    renderTab(base('medium'));
    expect(screen.getByText('中风险')).toBeInTheDocument();
    unmount();
    renderTab(base('low'));
    expect(screen.getByText('低风险')).toBeInTheDocument();
  });

  it('risk 有干预建议 → 渲染列表（slice 前 3）', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      risk: {
        overall_risk_level: 'low',
        intervention_suggestions: ['建议A', '建议B', '建议C', '建议D'],
      },
    });
    expect(screen.getByText('建议A')).toBeInTheDocument();
    expect(screen.getByText('建议B')).toBeInTheDocument();
    expect(screen.getByText('建议C')).toBeInTheDocument();
    // 第 4 条被 slice(0,3) 截断
    expect(screen.queryByText('建议D')).not.toBeInTheDocument();
  });

  it('risk 无干预建议 → "暂无风险因素"', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      risk: { overall_risk_level: 'low', intervention_suggestions: [] },
    });
    expect(screen.getByText('暂无风险因素，表现良好')).toBeInTheDocument();
  });
});

describe('StudentGrowthTab · 近 8 周积分变动', () => {
  it('非加载且 score_trend 为空 → "暂无积分趋势数据"', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      score_trend: [],
    });
    expect(screen.getByText('暂无积分趋势数据')).toBeInTheDocument();
  });

  it('score_trend 含正负变动 → 渲染对应周柱（正负符号）', () => {
    renderTab({
      engagement: { has_data: true, engagement_score: 70, level: 'low' },
      score_trend: [
        { week_index: 1, score_change: 5 },
        { week_index: 2, score_change: -3 },
      ],
    });
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();
  });
});
