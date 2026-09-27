import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PredictionTab } from '../PredictionTab';
import type { AlgorithmAnalysisDeps } from '../types';
import type { BatchPredictionData, RiskStudent, PredictionResult } from '../../../types';
import type { ColumnType } from '../../../components';

const predictionColumns: ColumnType<PredictionResult>[] = [
  { title: '姓名', key: 'name', dataIndex: 'name' },
];

const baseDeps = {
  predictionData: null as BatchPredictionData | null,
  riskStudents: [] as RiskStudent[],
  predictionDays: 7,
  filteredPredictions: [] as PredictionResult[],
  filteredRiskStudents: [] as RiskStudent[],
  predictionDetailColumns: predictionColumns,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<PredictionTab deps={deps} />);
}

const dataFull: BatchPredictionData = {
  summary: {
    avg_current_score: 70,
    avg_predicted_score: 75,
    improvement_count: 5,
    decline_count: 2,
    stable_count: 3,
  },
  predictions: [],
};

describe('PredictionTab', () => {
  it('predictionData=null：暂无积分预测数据 + 提示', () => {
    renderWith();
    expect(screen.getByText('暂无积分预测数据')).toBeInTheDocument();
    expect(screen.getByText('请确保已有足够的积分记录数据')).toBeInTheDocument();
  });

  it('summary 缺省：三计数与风险学生数兜底为 0', () => {
    const { container } = renderWith({
      predictionData: { summary: undefined as never, predictions: [] },
    });
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(container.textContent).toContain('暂无预测数据');
  });

  it('summary 三计数渲染（上升/稳定/下降）', () => {
    renderWith({ predictionData: dataFull });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('风险学生列表：high 红点 + 下降红色 + ArrowDown + 置信度', () => {
    const rs: RiskStudent[] = [
      {
        user_id: 1,
        name: '张三',
        class_name: '一班',
        risk_score: 80,
        risk_level: 'high',
        warning_count: 1,
        predicted_change: -3.5,
        confidence: 0.82,
      },
      {
        user_id: 2,
        name: '李四',
        class_name: '二班',
        risk_score: 60,
        risk_level: 'medium',
        warning_count: 0,
        predicted_change: 2.0,
        confidence: 0.5,
      },
    ];
    const { container } = renderWith({
      predictionData: dataFull,
      riskStudents: rs,
      filteredRiskStudents: rs,
    });
    expect(screen.getByText('需要关注的学生')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('预测未来7天积分呈下降趋势的学生')).toBeInTheDocument();
    expect(screen.getByText('3.5分')).toBeInTheDocument();
    expect(screen.getByText('置信度: 82%')).toBeInTheDocument();
    expect(screen.getByText('2.0分')).toBeInTheDocument();
    expect(screen.getByText('置信度: 50%')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).toBeTruthy();
    expect(container.querySelector('.bg-yellow-500')).toBeTruthy();
  });

  it('预测详情表渲染 prediction 行（filteredPredictions）', () => {
    const preds: PredictionResult[] = [
      {
        user_id: 10,
        name: '王五',
        current_score: 60,
        predicted_score: 70,
        trend: 'up',
        confidence: 0.9,
      },
    ];
    renderWith({ predictionData: dataFull, filteredPredictions: preds });
    expect(screen.getByText('积分预测详情')).toBeInTheDocument();
    expect(screen.getByText('王五')).toBeInTheDocument();
  });
});
