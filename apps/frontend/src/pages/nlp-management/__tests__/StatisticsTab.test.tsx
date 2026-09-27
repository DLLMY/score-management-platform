import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatisticsTab } from '../StatisticsTab';
import type { NLPDeps, Statistics, ModelEvaluation } from '../types';

const statsFull: Statistics = {
  total_rules: 100,
  add_rules: 60,
  deduct_rules: 40,
  total_usage: 500,
  manual_corrections: 7,
  accuracy_rate: 0.88,
  high_usage_rules: [
    {
      id: 1,
      behavior_keyword: '积极',
      behavior_description: '积极回答问题',
      score_value: 3,
      score_type: 'add',
      behavior_tags: ['active'],
      match_pattern: '',
      priority: 1,
      is_active: true,
      usage_count: 10,
      accuracy_rate: 0.85,
      created_at: '',
      updated_at: '',
    },
    {
      id: 2,
      behavior_keyword: '睡觉',
      behavior_description: '上课睡觉',
      score_value: 5,
      score_type: 'deduct',
      behavior_tags: ['bad'],
      match_pattern: '',
      priority: 2,
      is_active: true,
      usage_count: 4,
      accuracy_rate: 0.6,
      created_at: '',
      updated_at: '',
    },
  ],
};

const modelEvalFull: ModelEvaluation = {
  accuracy_rate: 0.95,
  precision: 0.9,
  recall: 0.85,
  f1_score: 0.88,
  total_samples: 200,
  correct_count: 190,
  incorrect_count: 10,
};

const modelEvalZero: ModelEvaluation = {
  accuracy_rate: 0,
  precision: 0,
  recall: 0,
  f1_score: 0,
  total_samples: 0,
  correct_count: 0,
  incorrect_count: 0,
};

const baseDeps: {
  statistics: Statistics | null;
  modelEvaluation: ModelEvaluation | null;
} = {
  statistics: null,
  modelEvaluation: null,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as NLPDeps;
  return render(<StatisticsTab deps={deps} />);
}

describe('StatisticsTab', () => {
  it('statistics/modelEvaluation 均为 null：不渲染任何统计块', () => {
    const { container } = renderWith();
    // 「规则总数」卡片与「样本总数:」指标内容均条件渲染
    expect(screen.queryByText('规则总数')).toBeNull();
    expect(screen.queryByText('样本总数:')).toBeNull();
    expect(container.textContent).not.toContain('100');
  });

  it('仅 modelEvaluation=null：渲染统计卡片 + 高频规则，不渲染模型指标', () => {
    renderWith({ statistics: statsFull });
    expect(screen.getByText('规则总数')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('积极回答问题')).toBeInTheDocument();
    expect(screen.getByText('上课睡觉')).toBeInTheDocument();
    // 模型指标内容（样本总数行）不渲染，模型性能指标为常驻标题故只校验内容
    expect(screen.queryByText('样本总数:')).toBeNull();
  });

  it('仅 statistics=null：渲染模型性能指标，不渲染统计卡片', () => {
    const { container } = renderWith({ modelEvaluation: modelEvalFull });
    expect(screen.getByText('模型性能指标')).toBeInTheDocument();
    expect(container.textContent).toContain('95.0%');
    expect(container.textContent).toContain('90.0%');
    expect(container.textContent).toContain('85.0%');
    expect(container.textContent).toContain('88.0%');
    expect(container.textContent).toContain('样本总数: 200 | 正确: 190 | 错误: 10');
    // 统计卡片不渲染
    expect(screen.queryByText('规则总数')).toBeNull();
  });

  it('两者均非 null：完整渲染', () => {
    const { container } = renderWith({ statistics: statsFull, modelEvaluation: modelEvalFull });
    expect(screen.getByText('规则总数')).toBeInTheDocument();
    expect(screen.getByText('模型性能指标')).toBeInTheDocument();
    expect(container.textContent).toContain('95.0%');
    expect(container.textContent).toContain('高频规则');
  });

  it('high_usage_rules 为空数组：高频规则标题仍在但无条目', () => {
    renderWith({ statistics: { ...statsFull, high_usage_rules: [] } });
    expect(screen.getByText('高频规则')).toBeInTheDocument();
    expect(screen.queryByText('积极回答问题')).toBeNull();
  });

  it('模型指标 accuracy_rate=0：百分比显示 0.0% 且进度条宽度为 0%', () => {
    const { container } = renderWith({ modelEvaluation: modelEvalZero });
    expect(container.textContent).toContain('0.0%');
    expect(container.querySelector('[style*="width: 0%"]')).toBeTruthy();
  });
});
