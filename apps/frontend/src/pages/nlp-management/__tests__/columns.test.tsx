import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  buildRuleColumns,
  buildTrainingResultColumns,
  buildPerformanceColumns,
  buildCorrectionColumns,
} from '../columns';

const renderCell = (node: unknown) => render(node as any).container;

describe('nlp-management/columns', () => {
  describe('buildRuleColumns', () => {
    const cols = buildRuleColumns() as any;

    it('returns 7 columns with the expected titles', () => {
      expect(cols).toHaveLength(7);
      expect(cols.map((c: any) => c.title)).toEqual([
        '关键词',
        '描述',
        '分数',
        '类型',
        '标签',
        '使用次数',
        '准确率',
      ]);
    });

    it('renders an add score in green with a + prefix', () => {
      const html = renderCell(
        cols[2].render('', { score_type: 'add', score_value: 5 })
      ).textContent;
      expect(html).toContain('+5');
      expect(
        renderCell(cols[2].render('', { score_type: 'add', score_value: 5 })).querySelector(
          '.text-green-600'
        )
      ).not.toBeNull();
    });

    it('renders a non-add score in red', () => {
      const { container } = render(
        cols[2].render('', { score_type: 'subtract', score_value: 3 }) as any
      );
      expect(container.querySelector('.text-red-600')).not.toBeNull();
      expect(container.textContent).toContain('3');
    });

    it('renders the type badge (add=加分, else=扣分)', () => {
      expect(renderCell(cols[3].render('add')).textContent).toContain('加分');
      expect(renderCell(cols[3].render('subtract')).textContent).toContain('扣分');
    });

    it('renders the tag list', () => {
      const html = renderCell(cols[4].render(['a', 'b'])).textContent;
      expect(html).toContain('a');
      expect(html).toContain('b');
    });

    it('renders accuracy as a percentage or -- when null', () => {
      expect(renderCell(cols[6].render(0.5)).textContent).toContain('50.0%');
      expect(renderCell(cols[6].render(null)).textContent).toContain('--');
    });
  });

  describe('buildTrainingResultColumns', () => {
    const result = {
      algorithm: 'svm',
      evaluation: { accuracy: 0.9, precision: 0.8, recall: 0.7, f1_score: 0.85 },
      cross_validation: { mean_f1: 0.8 },
    };

    it('shows the 最佳 badge for the best algorithm', () => {
      const cols = buildTrainingResultColumns({ best_algorithm: 'svm' } as any) as any;
      expect(renderCell(cols[0].render('svm', result)).textContent).toContain('最佳');
    });

    it('does not show the 最佳 badge for a non-best algorithm', () => {
      const cols = buildTrainingResultColumns({ best_algorithm: 'xgb' } as any) as any;
      expect(renderCell(cols[0].render('svm', result)).textContent).not.toContain('最佳');
    });

    it('renders evaluation metrics as percentages', () => {
      const cols = buildTrainingResultColumns(null) as any;
      expect(renderCell(cols[1].render('', result)).textContent).toContain('90.0%');
      expect(renderCell(cols[2].render('', result)).textContent).toContain('80.0%');
      expect(renderCell(cols[3].render('', result)).textContent).toContain('70.0%');
      expect(renderCell(cols[4].render('', result)).textContent).toContain('85.0%');
    });

    it('renders - when evaluation is missing', () => {
      const cols = buildTrainingResultColumns(null) as any;
      expect(renderCell(cols[1].render('', { algorithm: 'x' })).textContent).toContain('-');
    });

    it('renders cross_validation mean_f1', () => {
      const cols = buildTrainingResultColumns(null) as any;
      expect(renderCell(cols[5].render('', result)).textContent).toContain('80.0%');
    });
  });

  describe('buildPerformanceColumns', () => {
    it('renders the component name', () => {
      const cols = buildPerformanceColumns() as any;
      expect(renderCell(cols[0].render('登录')).textContent).toContain('登录');
    });

    it('renders calls as -- when null', () => {
      const cols = buildPerformanceColumns() as any;
      expect(
        renderCell(cols[1].render('', { stats: { calls: null, avg_time: 0.01, error_rate: 0 } }))
          .textContent
      ).toContain('--');
    });

    it('renders avg_time in red and ms when over 0.1', () => {
      const cols = buildPerformanceColumns() as any;
      const { container } = render(
        cols[2].render('', { stats: { avg_time: 0.5, calls: 10, error_rate: 0 } }) as any
      );
      expect(container.querySelector('.text-red-600')).not.toBeNull();
      expect(container.textContent).toContain('500.00ms');
    });

    it('renders avg_time as -- when null', () => {
      const cols = buildPerformanceColumns() as any;
      expect(
        renderCell(cols[2].render('', { stats: { avg_time: null, calls: 10, error_rate: 0 } }))
          .textContent
      ).toContain('--');
    });

    it('renders error_rate in red when over 0.05', () => {
      const cols = buildPerformanceColumns() as any;
      const { container } = render(
        cols[3].render('', { stats: { error_rate: 0.1, calls: 10, avg_time: 0.01 } }) as any
      );
      expect(container.querySelector('.text-red-600')).not.toBeNull();
    });
  });

  describe('buildCorrectionColumns', () => {
    it('maps field_type name/intent/score to labels and falls back to raw', () => {
      const cols = buildCorrectionColumns() as any;
      expect(renderCell(cols[1].render('name')).textContent).toContain('姓名');
      expect(renderCell(cols[1].render('intent')).textContent).toContain('意图');
      expect(renderCell(cols[1].render('score')).textContent).toContain('分数');
      expect(renderCell(cols[1].render('xyz')).textContent).toContain('xyz');
    });

    it('maps status to labels', () => {
      const cols = buildCorrectionColumns() as any;
      expect(renderCell(cols[4].render('pending')).textContent).toContain('待验证');
      expect(renderCell(cols[4].render('verified')).textContent).toContain('已验证');
      expect(renderCell(cols[4].render('learned')).textContent).toContain('已学习');
      expect(renderCell(cols[4].render('rejected')).textContent).toContain('已拒绝');
      expect(renderCell(cols[4].render('weird')).textContent).toContain('weird');
    });

    it('renders original/corrected values, falling back to -', () => {
      const cols = buildCorrectionColumns() as any;
      expect(renderCell(cols[2].render('')).textContent).toContain('-');
      expect(renderCell(cols[3].render('新值')).textContent).toContain('新值');
    });

    it('renders learn_count as Number or 0', () => {
      const cols = buildCorrectionColumns() as any;
      expect(renderCell(cols[5].render('7')).textContent).toContain('7');
      expect(renderCell(cols[5].render('')).textContent).toContain('0');
    });
  });
});
