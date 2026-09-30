import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EngagementTrendChart } from './EngagementTrendChart';
import type { EngagementTrendResult } from '../../types';

const base: EngagementTrendResult = {
  user_id: 1,
  weeks: 4,
  trend: 'up',
  series: [
    {
      week_index: 1,
      week_label: '2026-01',
      week_end: '2026-01-07',
      engagement_score: 60,
      level: 'medium',
      has_data: true,
      attendance_rate: 0.9,
      homework_rate: 0.8,
      activity_rate: 0.7,
      leave_days: 0,
    },
    {
      week_index: 2,
      week_label: '2026-02',
      week_end: '2026-02-07',
      engagement_score: 80,
      level: 'high',
      has_data: true,
      attendance_rate: 0.95,
      homework_rate: 0.85,
      activity_rate: 0.75,
      leave_days: 0,
    },
  ],
};

describe('EngagementTrendChart', () => {
  it('空 series → 显示无数据提示且不渲染 SVG', () => {
    const { container } = render(<EngagementTrendChart trend={{ ...base, series: [] }} />);
    expect(container.textContent).toContain('暂无参与度数据');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('有数据 → 渲染 SVG 折线/面积/数据点并展示 up 文案', () => {
    const { container } = render(<EngagementTrendChart trend={base} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeTruthy();
    expect(container.querySelector('polygon')).toBeTruthy();
    expect(container.querySelectorAll('circle').length).toBe(2);
    expect(container.textContent).toContain('上升');
  });

  it('trend down → 下降文案；trend stable → 平稳文案', () => {
    const { container: cDown } = render(
      <EngagementTrendChart trend={{ ...base, trend: 'down' }} />
    );
    expect(cDown.textContent).toContain('下降');

    const { container: cStable } = render(
      <EngagementTrendChart trend={{ ...base, trend: 'stable' }} />
    );
    expect(cStable.textContent).toContain('平稳');
  });
});
