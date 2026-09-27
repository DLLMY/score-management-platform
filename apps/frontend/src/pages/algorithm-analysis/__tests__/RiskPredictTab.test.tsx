import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RiskPredictTab } from '../RiskPredictTab';
import type { AlgorithmAnalysisDeps } from '../types';
import type { BatchRiskPredictData, RiskPredictResult } from '../../../types';

const noop = vi.fn();

const baseDeps: {
  riskPredictData: BatchRiskPredictData | null;
  searchKeyword: string;
  handleExport: typeof noop;
  exporting: 'engagement' | 'attribution' | 'risk' | null;
} = {
  riskPredictData: null,
  searchKeyword: '',
  handleExport: noop,
  exporting: null,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<RiskPredictTab deps={deps} />);
}

const riskHigh: RiskPredictResult = {
  name: '张三',
  risk_level: 'high',
  risk_score: 82,
  contributing_factors: ['逃课', '成绩下滑'],
  recommended_actions: ['约谈家长', '制定帮扶计划'],
};
const riskMed: RiskPredictResult = {
  name: '李四',
  risk_level: 'medium',
  risk_score: 45,
  contributing_factors: [],
  recommended_actions: [],
};
const riskLow: RiskPredictResult = {
  name: '王五',
  risk_level: 'low',
  risk_score: 12,
  contributing_factors: [],
  recommended_actions: [],
};

const dataFull: BatchRiskPredictData = {
  summary: { high_risk_count: 1, medium_risk_count: 1, low_risk_count: 1, avg_risk_score: 50 },
  risks: [riskHigh, riskMed, riskLow],
};

describe('RiskPredictTab', () => {
  it('riskPredictData=null：暂无数据', () => {
    renderWith();
    expect(screen.getByText('暂无风险评估数据')).toBeInTheDocument();
  });

  it('summary 缺省：兜底四个计数全 0 + 占比 0.0%', () => {
    const { container } = renderWith({
      riskPredictData: { summary: undefined as never, risks: [] },
    });
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toContain('0.0%');
    expect(screen.getByText('暂无风险学生')).toBeInTheDocument();
  });

  it('risks 非数组：按空数组处理', () => {
    renderWith({
      riskPredictData: {
        summary: { high_risk_count: 0, medium_risk_count: 0, low_risk_count: 0, avg_risk_score: 0 },
        risks: 'bad' as never,
      },
    });
    expect(screen.getByText('暂无风险学生')).toBeInTheDocument();
  });

  it('risks 非空：渲染三档风险学生 + 统计', () => {
    const { container } = renderWith({ riskPredictData: dataFull });
    expect(screen.getByText('评估学生数')).toBeInTheDocument();
    expect(screen.getAllByText('高风险').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('中风险').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('低风险').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('王五')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).toBeTruthy();
    expect(container.querySelector('.bg-yellow-500')).toBeTruthy();
    expect(container.querySelector('.bg-green-500')).toBeTruthy();
  });

  it('risk_score=null：显示 —', () => {
    renderWith({
      riskPredictData: {
        summary: { high_risk_count: 0, medium_risk_count: 0, low_risk_count: 1, avg_risk_score: 0 },
        risks: [
          {
            name: '赵六',
            risk_level: 'low',
            risk_score: null as unknown as number,
            contributing_factors: [],
            recommended_actions: [],
          },
        ],
      },
    });
    expect(screen.getByText('风险评分: —')).toBeInTheDocument();
  });

  it('contributing_factors 超过 3 个：仅显示前 3', () => {
    renderWith({
      riskPredictData: {
        summary: { high_risk_count: 0, medium_risk_count: 0, low_risk_count: 1, avg_risk_score: 0 },
        risks: [
          {
            name: '孙七',
            risk_level: 'low',
            risk_score: 10,
            contributing_factors: ['a', 'b', 'c', 'd'],
            recommended_actions: [],
          },
        ],
      },
    });
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.queryByText('d')).toBeNull();
    expect(screen.getByText('风险因素')).toBeInTheDocument();
  });

  it('contributing_factors 为空：不渲染风险因素块', () => {
    renderWith({
      riskPredictData: {
        summary: { high_risk_count: 0, medium_risk_count: 0, low_risk_count: 1, avg_risk_score: 0 },
        risks: [
          {
            name: '周八',
            risk_level: 'low',
            risk_score: 5,
            contributing_factors: [],
            recommended_actions: [],
          },
        ],
      },
    });
    expect(screen.queryByText('风险因素')).toBeNull();
  });

  it('recommended_actions 非空：渲染建议措施', () => {
    renderWith({ riskPredictData: dataFull });
    expect(screen.getByText('约谈家长')).toBeInTheDocument();
    expect(screen.getByText('推荐行动')).toBeInTheDocument();
  });

  it('recommended_actions 为空：不渲染推荐行动块', () => {
    renderWith({
      riskPredictData: {
        summary: { high_risk_count: 0, medium_risk_count: 0, low_risk_count: 1, avg_risk_score: 0 },
        risks: [
          {
            name: '周八',
            risk_level: 'low',
            risk_score: 5,
            contributing_factors: [],
            recommended_actions: [],
          },
        ],
      },
    });
    expect(screen.queryByText('建议措施')).toBeNull();
  });

  it('searchKeyword 命中：过滤结果；未命中：未找到匹配的学生', () => {
    const { rerender } = renderWith({ riskPredictData: dataFull, searchKeyword: '张三' });
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.queryByText('李四')).toBeNull();
    rerender(
      <RiskPredictTab
        deps={
          {
            ...baseDeps,
            riskPredictData: dataFull,
            searchKeyword: '不存在',
          } as unknown as AlgorithmAnalysisDeps
        }
      />
    );
    expect(screen.getByText('未找到匹配的学生')).toBeInTheDocument();
  });

  it('totalStudents>0：占比按真实比例计算', () => {
    const { container } = renderWith({ riskPredictData: dataFull });
    // 高风险 1 / 总数 3 ≈ 33.3%
    expect(container.textContent).toContain('33.3%');
  });

  it('导出按钮：exporting=null 显示导出 Excel 且可点击', () => {
    const handleExport = vi.fn();
    const { container } = renderWith({ riskPredictData: dataFull, handleExport });
    const btn = screen.getByText('导出 Excel');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(handleExport).toHaveBeenCalledWith('risk', 30);
    void container;
  });

  it('导出按钮：exporting=risk 显示导出中... 且禁用', () => {
    renderWith({ riskPredictData: dataFull, exporting: 'risk' });
    const btn = screen.getByText('导出中...') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('导出按钮：exporting=attribution（非 risk）仍禁用', () => {
    renderWith({ riskPredictData: dataFull, exporting: 'attribution' });
    const btn = screen.getByText('导出 Excel') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
