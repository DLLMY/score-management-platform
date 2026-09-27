import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScorePredictTab } from '../ScorePredictTab';
import type { AlgorithmAnalysisDeps } from '../types';
import type { BatchScorePredictData, ScorePredictResult } from '../../../types';
import type { ColumnType } from '../../../components';

const scorePredictColumns: ColumnType<ScorePredictResult>[] = [
  { title: '姓名', key: 'name', dataIndex: 'name' },
];

const baseDeps = {
  scorePredictData: null as BatchScorePredictData | null,
  searchKeyword: '',
  scorePredictColumns,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<ScorePredictTab deps={deps} />);
}

const dataNull: BatchScorePredictData = {
  summary: {
    avg_current_score: null as unknown as number,
    avg_predicted_score: null as unknown as number,
    subjects: [],
  },
  predictions: [],
};

const dataFull: BatchScorePredictData = {
  summary: {
    avg_current_score: 78.5,
    avg_predicted_score: 82.3,
    subjects: ['数学', '语文'],
  },
  predictions: [],
};

describe('ScorePredictTab', () => {
  it('scorePredictData=null：暂无成绩预测数据 + 提示', () => {
    renderWith();
    expect(screen.getByText('暂无成绩预测数据')).toBeInTheDocument();
    expect(screen.getByText('请确保已有足够的积分记录和考试数据')).toBeInTheDocument();
  });

  it('summary avg=null + subjects 空：显示 — 与 综合 / 综合评分', () => {
    renderWith({ scorePredictData: dataNull });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('综合')).toBeInTheDocument();
    expect(screen.getByText('综合评分')).toBeInTheDocument();
  });

  it('summary avg + subjects 正常渲染', () => {
    renderWith({ scorePredictData: dataFull });
    expect(screen.getByText('78.5')).toBeInTheDocument();
    expect(screen.getByText('82.3')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('数学, 语文')).toBeInTheDocument();
  });

  it('成绩分布预测按 predicted_score 分段计算占比', () => {
    const preds: ScorePredictResult[] = [
      {
        name: 'A',
        subject: '数学',
        current_score: 50,
        predicted_score: 55,
        trend: 'up',
        confidence: 0.8,
      },
      {
        name: 'B',
        subject: '语文',
        current_score: 88,
        predicted_score: 85,
        trend: 'up',
        confidence: 0.9,
      },
    ];
    const data: BatchScorePredictData = {
      summary: { avg_current_score: 69, avg_predicted_score: 70, subjects: ['数学', '语文'] },
      predictions: preds,
    };
    renderWith({ scorePredictData: data });
    // 不及格 1/2 = 50.0%；优秀 1/2 = 50.0%；其余 0.0%
    expect(screen.getAllByText('1人 (50.0%)').length).toBe(2);
  });

  it('searchKeyword 命中过滤：仅显示匹配行', () => {
    const preds: ScorePredictResult[] = [
      {
        name: 'A',
        subject: '数学',
        current_score: 50,
        predicted_score: 55,
        trend: 'up',
        confidence: 0.8,
      },
      {
        name: 'B',
        subject: '语文',
        current_score: 88,
        predicted_score: 85,
        trend: 'up',
        confidence: 0.9,
      },
    ];
    const data: BatchScorePredictData = {
      summary: { avg_current_score: 69, avg_predicted_score: 70, subjects: ['数学', '语文'] },
      predictions: preds,
    };
    renderWith({ scorePredictData: data, searchKeyword: 'A' });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).toBeNull();
  });

  it('searchKeyword 不命中 + 详情表空态', () => {
    const preds: ScorePredictResult[] = [
      {
        name: 'A',
        subject: '数学',
        current_score: 50,
        predicted_score: 55,
        trend: 'up',
        confidence: 0.8,
      },
    ];
    const data: BatchScorePredictData = {
      summary: { avg_current_score: 50, avg_predicted_score: 55, subjects: ['数学'] },
      predictions: preds,
    };
    renderWith({ scorePredictData: data, searchKeyword: 'zzz' });
    expect(screen.getByText('学生成绩预测详情')).toBeInTheDocument();
    expect(screen.getByText('暂无成绩预测数据')).toBeInTheDocument();
  });
});
