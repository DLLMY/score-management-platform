/**
 * 图表组件补测（D 线第十九步）：覆盖 PieChart / BarChart / ScatterChart /
 * ClusterScatterChart / RadarChart(RadarPlot) / MultiRadarChart / CompositeScoreRadar
 * 的组件体逻辑（数据加工、标题渲染、showLegend 分支等）。
 *
 * recharts 在 jsdom 无尺寸，按 ScoreChart.test.tsx 既定方案 mock 为 passthrough，
 * 仅执行组件自身逻辑，不渲染 recharts 内部图元（故数据标签等内部文本不可断言，
 * 只能断言 ResponsiveContainer 之外真实渲染的标题文本）。
 */
/// <reference types="jest" />
import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import {
  PieChart,
  BarChart,
  ScatterChart,
  ClusterScatterChart,
  RadarChart,
  MultiRadarChart,
  CompositeScoreRadar,
} from '../../charts';

vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    BarChart: Passthrough,
    Bar: (): null => null,
    PieChart: Passthrough,
    Pie: (): null => null,
    Cell: (): null => null,
    ScatterChart: Passthrough,
    Scatter: (): null => null,
    RadarChart: Passthrough,
    Radar: (): null => null,
    PolarGrid: (): null => null,
    PolarAngleAxis: (): null => null,
    PolarRadiusAxis: (): null => null,
    XAxis: (): null => null,
    YAxis: (): null => null,
    CartesianGrid: (): null => null,
    Tooltip: (): null => null,
    Legend: (): null => null,
    ResponsiveContainer: Passthrough,
  };
});

afterEach(cleanup);

describe('PieChart', () => {
  const data = [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
  ];
  it('renders default title and processed data list (outside ResponsiveContainer)', () => {
    render(<PieChart data={data} />);
    expect(screen.getByText('占比分布')).toBeInTheDocument();
    // 数据列表在 ResponsiveContainer 之外真实渲染
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
  it('renders custom title + innerRadius branch', () => {
    render(<PieChart data={data} title='分类占比' innerRadius={30} dataKey='value' nameKey='name' />);
    expect(screen.getByText('分类占比')).toBeInTheDocument();
  });
});

describe('BarChart', () => {
  const data = [
    { name: 'x', value: 5 },
    { name: 'y', value: 15 },
  ];
  it('renders default title (showLegend=false branch)', () => {
    render(<BarChart data={data} />);
    expect(screen.getByText('统计图表')).toBeInTheDocument();
  });
  it('renders with showLegend=true branch', () => {
    render(<BarChart data={data} title='分数统计' showLegend />);
    expect(screen.getByText('分数统计')).toBeInTheDocument();
  });
});

describe('ScatterChart', () => {
  const data = [
    { name: 's1', behavior_score: 80, academic_score: 70, cluster_name: '全面优秀型', x: 1, y: 2 },
  ];
  it('renders title', () => {
    render(<ScatterChart data={data} xKey='behavior_score' yKey='academic_score' title='相关性' />);
    expect(screen.getByText('相关性')).toBeInTheDocument();
  });
  it('renders without title (title falsy branch) without throwing', () => {
    const { container } = render(<ScatterChart data={data} xKey='x' yKey='y' />);
    expect(container).toBeTruthy();
  });
});

describe('ClusterScatterChart', () => {
  const data = [
    { name: 's1', behavior_score: 80, academic_score: 70, cluster_name: '双困型' },
    { name: 's2', behavior_score: 40, academic_score: 30, cluster_name: '全面优秀型' },
  ];
  it('renders title and clusters', () => {
    render(<ClusterScatterChart data={data} title='群体分布' />);
    expect(screen.getByText('群体分布')).toBeInTheDocument();
  });
  it('renders without title without throwing', () => {
    const { container } = render(<ClusterScatterChart data={data} />);
    expect(container).toBeTruthy();
  });
});

describe('RadarChart (RadarPlot)', () => {
  const data = [{ dimension: '行为', score: 60 }];
  it('renders title', () => {
    render(<RadarChart data={data} title='能力雷达' />);
    expect(screen.getByText('能力雷达')).toBeInTheDocument();
  });
  it('renders without title without throwing', () => {
    const { container } = render(<RadarChart data={data} />);
    expect(container).toBeTruthy();
  });
});

describe('MultiRadarChart', () => {
  const data = [
    { name: 'stu1', data: [{ dimension: '行为', score: 60 }] },
    { name: 'stu2', data: [{ dimension: '学业', score: 80 }] },
  ];
  it('renders title + flattens dimensions (body logic)', () => {
    render(<MultiRadarChart data={data} title='对比' />);
    expect(screen.getByText('对比')).toBeInTheDocument();
  });
  it('renders without title without throwing', () => {
    const { container } = render(<MultiRadarChart data={data} />);
    expect(container).toBeTruthy();
  });
});

describe('CompositeScoreRadar', () => {
  const scores = { behavior: 70, academic: 80, compliance: 60, composite: 75 };
  it('renders title', () => {
    render(<CompositeScoreRadar scores={scores} title='综合' />);
    expect(screen.getByText('综合')).toBeInTheDocument();
  });
  it('renders without title without throwing', () => {
    const { container } = render(<CompositeScoreRadar scores={scores} />);
    expect(container).toBeTruthy();
  });
});
