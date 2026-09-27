import type { ReactNode } from 'react';
import { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { useAlgorithmAnalysisColumns } from '../useAlgorithmAnalysisColumns';
import type {
  PredictionResult,
  ScorePredictResult,
  BatchAttributionStudent,
  EngagementStudentRank,
} from '../../../types';

function renderCell(node: ReactNode) {
  return render(createElement('span', null, node));
}

// ColumnType.render 签名为 (value, record, index) => ReactNode，且可选；
// 统一经此辅助调用（补第三参 + 非空断言），规避 tsc「Expected 3 arguments / possibly undefined」。
function callRender<R>(
  col: { render?: (value: unknown, record: R, index: number) => ReactNode },
  value: unknown,
  record: R
): ReactNode {
  return col.render!(value, record, 0);
}

describe('useAlgorithmAnalysisColumns', () => {
  const setEngagementTrendUserId = vi.fn();
  function setup() {
    const { result } = renderHook(() => useAlgorithmAnalysisColumns(setEngagementTrendUserId));
    return result.current;
  }

  it('返回四组非空列定义', () => {
    const cols = setup();
    expect(cols.predictionDetailColumns.length).toBeGreaterThan(0);
    expect(cols.scorePredictColumns.length).toBeGreaterThan(0);
    expect(cols.attributionColumns.length).toBeGreaterThan(0);
    expect(cols.engagementColumns.length).toBeGreaterThan(0);
  });

  // ── predictionDetailColumns ──
  describe('predictionDetailColumns', () => {
    it('name: 有值 / 空值兜底', () => {
      const col = setup().predictionDetailColumns[0];
      const { unmount: u1 } = renderCell(
        callRender(col, '张三', {} as unknown as PredictionResult)
      );
      expect(screen.getByText('张三')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(callRender(col, null, {} as unknown as PredictionResult));
      expect(screen.getByText('未知学生')).toBeInTheDocument();
      u2();
    });

    it('current_score: number / 非 number 兜底 0', () => {
      const col = setup().predictionDetailColumns[1];
      const { unmount: u1 } = renderCell(callRender(col, 95.5, {} as unknown as PredictionResult));
      expect(screen.getByText('95.5')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(callRender(col, 'abc', {} as unknown as PredictionResult));
      expect(screen.getByText('0.0')).toBeInTheDocument();
      u2();
    });

    it('trend: up / down / 缺省 --', () => {
      const col = setup().predictionDetailColumns[2];
      const { unmount: u1 } = renderCell(callRender(col, 'up', {} as unknown as PredictionResult));
      expect(screen.getByText('上升')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(col, 'down', {} as unknown as PredictionResult)
      );
      expect(screen.getByText('下降')).toBeInTheDocument();
      u2();
      const { unmount: u3 } = renderCell(
        callRender(col, undefined, {} as unknown as PredictionResult)
      );
      expect(screen.getByText('--')).toBeInTheDocument();
      u3();
    });

    it('predicted_change: 正/负/零 三态着色', () => {
      const col = setup().predictionDetailColumns[3];
      const base = { current_score: 80, predicted_score: 90 } as unknown as PredictionResult;
      const { container: c1, unmount: u1 } = renderCell(callRender(col, undefined, base));
      expect(c1.textContent).toContain('10.0分');
      expect(c1.querySelector('.text-green-600')).toBeTruthy();
      u1();
      const neg = { current_score: 80, predicted_score: 70 } as unknown as PredictionResult;
      const { container: c2, unmount: u2 } = renderCell(callRender(col, undefined, neg));
      expect(c2.textContent).toContain('-10.0分');
      expect(c2.querySelector('.text-red-600')).toBeTruthy();
      u2();
      const zero = { current_score: 80, predicted_score: 80 } as unknown as PredictionResult;
      const { container: c3, unmount: u3 } = renderCell(callRender(col, undefined, zero));
      expect(c3.textContent).toContain('0.0分');
      expect(c3.querySelector('.text-gray-600')).toBeTruthy();
      u3();
    });

    it('confidence: number 百分比 / 非 number 0%', () => {
      const col = setup().predictionDetailColumns[4];
      const { unmount: u1 } = renderCell(callRender(col, 0.8, {} as unknown as PredictionResult));
      expect(screen.getByText('80%')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(col, undefined, {} as unknown as PredictionResult)
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
      u2();
    });
  });

  // ── scorePredictColumns ──
  describe('scorePredictColumns', () => {
    it('name / subject: 空值兜底', () => {
      const cols = setup().scorePredictColumns;
      const { unmount: u1 } = renderCell(
        callRender(cols[0], '李四', {} as unknown as ScorePredictResult)
      );
      expect(screen.getByText('李四')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(cols[1], undefined, {} as unknown as ScorePredictResult)
      );
      expect(screen.getByText('综合')).toBeInTheDocument();
      u2();
    });

    it('current_score: number / 非有限数兜底 0', () => {
      const col = setup().scorePredictColumns[2];
      const { unmount: u1 } = renderCell(callRender(col, 88, {} as unknown as ScorePredictResult));
      expect(screen.getByText('88.0')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(callRender(col, NaN, {} as unknown as ScorePredictResult));
      expect(screen.getByText('0.0')).toBeInTheDocument();
      u2();
    });

    it('predicted_score: 优秀/良好/低分 三态着色', () => {
      const col = setup().scorePredictColumns[3];
      const { container: c1, unmount: u1 } = renderCell(
        callRender(col, 95, {} as unknown as ScorePredictResult)
      );
      expect(c1.querySelector('.text-green-600')).toBeTruthy();
      u1();
      const { container: c2, unmount: u2 } = renderCell(
        callRender(col, 70, {} as unknown as ScorePredictResult)
      );
      expect(c2.querySelector('.text-blue-600')).toBeTruthy();
      u2();
      const { container: c3, unmount: u3 } = renderCell(
        callRender(col, 30, {} as unknown as ScorePredictResult)
      );
      expect(c3.querySelector('.text-red-600')).toBeTruthy();
      u3();
    });

    it('trend: up / down / 缺省 稳定', () => {
      const col = setup().scorePredictColumns[4];
      const { unmount: u1 } = renderCell(
        callRender(col, 'up', {} as unknown as ScorePredictResult)
      );
      expect(screen.getByText('上升')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(col, 'down', {} as unknown as ScorePredictResult)
      );
      expect(screen.getByText('下降')).toBeInTheDocument();
      u2();
      const { unmount: u3 } = renderCell(
        callRender(col, undefined, {} as unknown as ScorePredictResult)
      );
      expect(screen.getByText('稳定')).toBeInTheDocument();
      u3();
    });

    it('confidence: number 百分比 / 非 number 0%', () => {
      const col = setup().scorePredictColumns[5];
      const { unmount: u1 } = renderCell(callRender(col, 0.6, {} as unknown as ScorePredictResult));
      expect(screen.getByText('60%')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(col, undefined, {} as unknown as ScorePredictResult)
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
      u2();
    });
  });

  // ── attributionColumns ──
  describe('attributionColumns', () => {
    it('name: 含 error 时展示错误信息', () => {
      const col = setup().attributionColumns[0];
      const rec = { name: '王五', error: '数据缺失' } as unknown as BatchAttributionStudent;
      const { unmount } = renderCell(callRender(col, undefined, rec));
      expect(screen.getByText('王五')).toBeInTheDocument();
      expect(screen.getByText('数据缺失')).toBeInTheDocument();
      unmount();
    });

    it('total_change: 有数据正负 / 无数据 —', () => {
      const col = setup().attributionColumns[1];
      const pos = { has_data: true, total_change: 5 } as unknown as BatchAttributionStudent;
      const { container: c1, unmount: u1 } = renderCell(callRender(col, undefined, pos));
      expect(c1.textContent).toContain('+5.0');
      expect(c1.querySelector('.text-green-600')).toBeTruthy();
      u1();
      const neg = { has_data: true, total_change: -5 } as unknown as BatchAttributionStudent;
      const { container: c2, unmount: u2 } = renderCell(callRender(col, undefined, neg));
      expect(c2.textContent).toContain('-5.0');
      expect(c2.querySelector('.text-red-600')).toBeTruthy();
      u2();
      const none = { has_data: false } as unknown as BatchAttributionStudent;
      const { unmount: u3 } = renderCell(callRender(col, undefined, none));
      expect(screen.getByText('—')).toBeInTheDocument();
      u3();
    });

    it('factors: 有数据 topFactors / 无数据 数据不足', () => {
      const col = setup().attributionColumns[2];
      const ok = { has_data: true } as unknown as BatchAttributionStudent;
      const { unmount: u1 } = renderCell(callRender(col, undefined, ok));
      expect(screen.queryByText('数据不足')).toBeNull();
      u1();
      const none = { has_data: false } as unknown as BatchAttributionStudent;
      const { unmount: u2 } = renderCell(callRender(col, undefined, none));
      expect(screen.getByText('数据不足')).toBeInTheDocument();
      u2();
    });

    it('confidence: 有数据条 / 无数据 —', () => {
      const col = setup().attributionColumns[3];
      const ok = { has_data: true, confidence: 0.5 } as unknown as BatchAttributionStudent;
      const { container: c1, unmount: u1 } = renderCell(callRender(col, undefined, ok));
      expect(c1.querySelector('.bg-purple-500')).toBeTruthy();
      u1();
      const none = { has_data: false } as unknown as BatchAttributionStudent;
      const { unmount: u2 } = renderCell(callRender(col, undefined, none));
      expect(screen.getByText('—')).toBeInTheDocument();
      u2();
    });

    it('status: 已归因 / 缺数据', () => {
      const col = setup().attributionColumns[4];
      const ok = { has_data: true } as unknown as BatchAttributionStudent;
      const { unmount: u1 } = renderCell(callRender(col, undefined, ok));
      expect(screen.getByText('已归因')).toBeInTheDocument();
      u1();
      const none = { has_data: false } as unknown as BatchAttributionStudent;
      const { unmount: u2 } = renderCell(callRender(col, undefined, none));
      expect(screen.getByText('缺数据')).toBeInTheDocument();
      u2();
    });
  });

  // ── engagementColumns ──
  describe('engagementColumns', () => {
    it('rank: 前三名紫色 / 其他灰色 / 无 —', () => {
      const col = setup().engagementColumns[0];
      const top = { rank: 1 } as unknown as EngagementStudentRank;
      const { container: c1, unmount: u1 } = renderCell(callRender(col, undefined, top));
      expect(c1.textContent).toContain('#1');
      expect(c1.querySelector('.text-purple-600')).toBeTruthy();
      u1();
      const low = { rank: 5 } as unknown as EngagementStudentRank;
      const { container: c2, unmount: u2 } = renderCell(callRender(col, undefined, low));
      expect(c2.textContent).toContain('#5');
      expect(c2.querySelector('.text-gray-500')).toBeTruthy();
      u2();
      const none = {} as unknown as EngagementStudentRank;
      const { unmount: u3 } = renderCell(callRender(col, undefined, none));
      expect(screen.getByText('—')).toBeInTheDocument();
      u3();
    });

    it('name: 含 error 展示', () => {
      const col = setup().engagementColumns[1];
      const rec = { name: '赵六', error: '考勤异常' } as unknown as EngagementStudentRank;
      const { unmount } = renderCell(callRender(col, undefined, rec));
      expect(screen.getByText('赵六')).toBeInTheDocument();
      expect(screen.getByText('考勤异常')).toBeInTheDocument();
      unmount();
    });

    it('engagement_score: 高/中/低 三态 + 无数据 —', () => {
      const col = setup().engagementColumns[2];
      const high = { has_data: true, engagement_score: 80 } as unknown as EngagementStudentRank;
      const { container: c1, unmount: u1 } = renderCell(callRender(col, undefined, high));
      expect(c1.querySelector('.text-green-600')).toBeTruthy();
      u1();
      const mid = { has_data: true, engagement_score: 50 } as unknown as EngagementStudentRank;
      const { container: c2, unmount: u2 } = renderCell(callRender(col, undefined, mid));
      expect(c2.querySelector('.text-yellow-600')).toBeTruthy();
      u2();
      const low = { has_data: true, engagement_score: 30 } as unknown as EngagementStudentRank;
      const { container: c3, unmount: u3 } = renderCell(callRender(col, undefined, low));
      expect(c3.querySelector('.text-red-600')).toBeTruthy();
      u3();
      const none = { has_data: false } as unknown as EngagementStudentRank;
      const { unmount: u4 } = renderCell(callRender(col, undefined, none));
      expect(screen.getByText('—')).toBeInTheDocument();
      u4();
    });

    it('level: high / medium / low', () => {
      const col = setup().engagementColumns[3];
      const { unmount: u1 } = renderCell(
        callRender(col, undefined, { level: 'high' } as unknown as EngagementStudentRank)
      );
      expect(screen.getByText('高')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(col, undefined, { level: 'medium' } as unknown as EngagementStudentRank)
      );
      expect(screen.getByText('中')).toBeInTheDocument();
      u2();
      const { unmount: u3 } = renderCell(
        callRender(col, undefined, { level: 'low' } as unknown as EngagementStudentRank)
      );
      expect(screen.getByText('低')).toBeInTheDocument();
      u3();
    });

    it('attendance/homework/activity rate: 百分比 / 无 —', () => {
      const cols = setup().engagementColumns;
      const withData = {
        components: { attendance_rate: 0.9, homework_rate: 0.8, activity_rate: 0.7, leave_days: 3 },
      } as unknown as EngagementStudentRank;
      const { unmount: u1 } = renderCell(callRender(cols[4], undefined, withData));
      expect(screen.getByText('90%')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(callRender(cols[5], undefined, withData));
      expect(screen.getByText('80%')).toBeInTheDocument();
      u2();
      const { unmount: u3 } = renderCell(callRender(cols[6], undefined, withData));
      expect(screen.getByText('70%')).toBeInTheDocument();
      u3();
      const none = {} as unknown as EngagementStudentRank;
      const { unmount: u4 } = renderCell(callRender(cols[4], undefined, none));
      expect(screen.getByText('—')).toBeInTheDocument();
      u4();
    });

    it('leave_days: 有值 / 缺省 0', () => {
      const col = setup().engagementColumns[7];
      const { unmount: u1 } = renderCell(
        callRender(col, undefined, {
          components: { leave_days: 3 },
        } as unknown as EngagementStudentRank)
      );
      expect(screen.getByText('3')).toBeInTheDocument();
      u1();
      const { unmount: u2 } = renderCell(
        callRender(col, undefined, {} as unknown as EngagementStudentRank)
      );
      expect(screen.getByText('0')).toBeInTheDocument();
      u2();
    });

    it('trend_action: 有数据点击触发 setEngagementTrendUserId / 无数据 disabled', () => {
      const col = setup().engagementColumns[8];
      const ok = { has_data: true, user_id: 'u-1' } as unknown as EngagementStudentRank;
      const { container: c1, unmount: u1 } = renderCell(callRender(col, undefined, ok));
      const btn1 = c1.querySelector('button') as HTMLButtonElement;
      expect(btn1.disabled).toBe(false);
      fireEvent.click(btn1);
      expect(setEngagementTrendUserId).toHaveBeenCalledWith('u-1');
      u1();
      const none = { has_data: false, user_id: 'u-2' } as unknown as EngagementStudentRank;
      const { container: c2, unmount: u2 } = renderCell(callRender(col, undefined, none));
      const btn2 = c2.querySelector('button') as HTMLButtonElement;
      expect(btn2.disabled).toBe(true);
      fireEvent.click(btn2);
      expect(setEngagementTrendUserId).not.toHaveBeenCalledWith('u-2');
      u2();
    });
  });
});
