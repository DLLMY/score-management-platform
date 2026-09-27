import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RuleRecommendTab } from '../RuleRecommendTab';
import type { AlgorithmAnalysisDeps } from '../types';
import type { RuleRecommendData, RuleRecommendResult } from '../../../types';

const baseDeps: {
  ruleRecommendData: RuleRecommendData | null;
  searchKeyword: string;
} = {
  ruleRecommendData: null,
  searchKeyword: '',
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<RuleRecommendTab deps={deps} />);
}

const ruleFull: RuleRecommendResult = {
  rule_id: 1,
  rule_name: '课堂表现加分',
  description: '鼓励积极参与',
  estimated_impact: 5,
  confidence: 0.8,
  category: '课堂',
};
const ruleNegative: RuleRecommendResult = {
  rule_id: 2,
  rule_name: '迟到扣分',
  description: '减少迟到',
  estimated_impact: -3,
  confidence: 0.6,
  category: '纪律',
};

const dataFull: RuleRecommendData = {
  summary: { total_recommendations: 2, avg_confidence: 0.7, estimated_total_impact: 2 },
  recommendations: [ruleFull, ruleNegative],
};

describe('RuleRecommendTab', () => {
  it('ruleRecommendData=null：暂无数据', () => {
    renderWith();
    expect(screen.getByText('暂无规则推荐数据')).toBeInTheDocument();
  });

  it('summary 缺省：兜底统计全 0 + 平均置信度 0%', () => {
    renderWith({ ruleRecommendData: { summary: undefined as never, recommendations: [] } });
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('暂无规则推荐建议')).toBeInTheDocument();
  });

  it('recommendations 非数组：按空数组处理', () => {
    renderWith({
      ruleRecommendData: {
        summary: { total_recommendations: 0, avg_confidence: 0, estimated_total_impact: 0 },
        recommendations: 'bad' as never,
      },
    });
    expect(screen.getByText('暂无规则推荐建议')).toBeInTheDocument();
  });

  it('recommendations 非空：渲染统计 + 列表 + 置信度', () => {
    const { container } = renderWith({ ruleRecommendData: dataFull });
    expect(screen.getByText('总推荐数')).toBeInTheDocument();
    expect(screen.getByText('平均置信度')).toBeInTheDocument();
    expect(screen.getAllByText('预计影响').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('课堂表现加分')).toBeInTheDocument();
    expect(screen.getByText('迟到扣分')).toBeInTheDocument();
    // 平均置信度 0.7 → 70%
    expect(screen.getByText('70%')).toBeInTheDocument();
    void container;
  });

  it('impact>0 显示 +X分 绿色；impact<0 显示 X分 红色；impact=0 灰色', () => {
    const { container } = renderWith({ ruleRecommendData: dataFull });
    expect(container.textContent).toContain('+5分');
    expect(container.querySelector('.text-green-600')).toBeTruthy();
    expect(container.textContent).toContain('-3分');
    expect(container.querySelector('.text-red-600')).toBeTruthy();
  });

  it('impact=0：灰色显示 0分', () => {
    renderWith({
      ruleRecommendData: {
        summary: { total_recommendations: 1, avg_confidence: 0, estimated_total_impact: 0 },
        recommendations: [
          {
            rule_id: 3,
            rule_name: 'z',
            description: '',
            estimated_impact: 0,
            confidence: 0,
            category: 'c',
          },
        ],
      },
    });
    expect(screen.getByText('0分')).toBeInTheDocument();
    expect(document.querySelector('.text-gray-600')).toBeTruthy();
  });

  it('字段缺省：rule_id→idx-0 / rule_name→未命名规则 / category→未分类 / 置信度 0%', () => {
    renderWith({
      ruleRecommendData: {
        summary: { total_recommendations: 1, avg_confidence: 0, estimated_total_impact: 0 },
        recommendations: [
          {
            rule_id: null,
            rule_name: undefined as never,
            description: '',
            estimated_impact: 0,
            confidence: undefined as never,
            category: undefined as never,
          } as RuleRecommendResult,
        ],
      },
    });
    expect(screen.getByText('未命名规则')).toBeInTheDocument();
    expect(screen.getByText('未分类')).toBeInTheDocument();
    expect(screen.getByText('置信度: 0%')).toBeInTheDocument();
  });

  it('confidence/impact 非有限数：兜底 0', () => {
    renderWith({
      ruleRecommendData: {
        summary: { total_recommendations: 2, avg_confidence: 0, estimated_total_impact: 0 },
        recommendations: [
          {
            rule_id: 1,
            rule_name: 'a',
            description: '',
            estimated_impact: NaN as never,
            confidence: NaN as never,
            category: 'c',
          },
          {
            rule_id: 2,
            rule_name: 'b',
            description: '',
            estimated_impact: undefined as never,
            confidence: undefined as never,
            category: 'c',
          },
        ],
      },
    });
    expect(screen.getAllByText('置信度: 0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0分').length).toBeGreaterThanOrEqual(1);
  });

  it('searchKeyword 命中：过滤；未命中：暂无规则推荐建议', () => {
    const { rerender } = renderWith({ ruleRecommendData: dataFull, searchKeyword: '课堂' });
    expect(screen.getByText('课堂表现加分')).toBeInTheDocument();
    expect(screen.queryByText('迟到扣分')).toBeNull();
    rerender(
      <RuleRecommendTab
        deps={
          {
            ...baseDeps,
            ruleRecommendData: dataFull,
            searchKeyword: '不存在',
          } as unknown as AlgorithmAnalysisDeps
        }
      />
    );
    expect(screen.getByText('暂无规则推荐建议')).toBeInTheDocument();
  });
});
