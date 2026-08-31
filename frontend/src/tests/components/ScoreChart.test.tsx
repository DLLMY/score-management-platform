/**
 * ScoreChart 测试 —— 覆盖报告 P0 的 "ScoreChart 数值展示"：
 * 趋势百分比计算（涨/跌/单点无趋势）与标题渲染。
 * recharts 在 jsdom 无尺寸，mock 为 passthrough 以免尺寸测量抛错。
 */
/// <reference types="jest" />
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import ScoreChart from '../../components/charts/ScoreChart';
import { renderWithProviders } from '../utils/test-utils';

vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    LineChart: Passthrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ResponsiveContainer: Passthrough,
  };
});

describe('ScoreChart numeric display', () => {
  test('renders default title', () => {
    renderWithProviders(<ScoreChart data={[{ date: 'd1', score: 10 }]} />);
    expect(screen.getByText('积分趋势')).toBeInTheDocument();
  });

  test('custom title is rendered', () => {
    renderWithProviders(<ScoreChart data={[{ date: 'd1', score: 1 }]} title='我的积分' />);
    expect(screen.getByText('我的积分')).toBeInTheDocument();
  });

  test('single data point shows "--" (no trend)', () => {
    renderWithProviders(<ScoreChart data={[{ date: 'd1', score: 5 }]} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  test('upward trend shows positive percent with "+"', () => {
    // 10 -> 20 => +100%
    renderWithProviders(
      <ScoreChart data={[{ date: 'd1', score: 10 }, { date: 'd2', score: 20 }]} />
    );
    expect(screen.getByText(/\+100%/)).toBeInTheDocument();
  });

  test('downward trend shows negative percent without "+"', () => {
    // 20 -> 10 => -50%
    renderWithProviders(
      <ScoreChart data={[{ date: 'd1', score: 20 }, { date: 'd2', score: 10 }]} />
    );
    expect(screen.getByText(/-50%/)).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });
});
