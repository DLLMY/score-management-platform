import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnomalyTab } from '../AnomalyTab';
import type { AlgorithmAnalysisDeps } from '../types';
import type { BatchAnomalyData, AnomalyResult } from '../../../types';

const baseDeps: {
  anomalyData: BatchAnomalyData | null;
  searchKeyword: string;
} = {
  anomalyData: null,
  searchKeyword: '',
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as AlgorithmAnalysisDeps;
  return render(<AnomalyTab deps={deps} />);
}

const anomalyHigh: AnomalyResult = {
  name: '张三',
  anomaly_type: 'overall',
  severity: 'high',
  description: '综合指标显著偏离',
  score_change: 5,
  detected_at: '2026-09-20',
};
const anomalyLowNoChange: AnomalyResult = {
  name: '李四',
  anomaly_type: 'x',
  severity: 'low',
  description: '',
  score_change: 0,
  detected_at: '',
};

const dataFull: BatchAnomalyData = {
  summary: {
    total_anomalies: 2,
    high_severity_count: 1,
    medium_severity_count: 0,
    low_severity_count: 1,
  },
  anomalies: [anomalyHigh, anomalyLowNoChange],
};

describe('AnomalyTab', () => {
  it('anomalyData=null：暂无数据', () => {
    renderWith();
    expect(screen.getByText('暂无异常检测数据')).toBeInTheDocument();
  });

  it('summary 缺省：兜底四个计数全 0', () => {
    renderWith({ anomalyData: { summary: undefined as never, anomalies: [] } });
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('未检测到异常')).toBeInTheDocument();
  });

  it('anomalies 非数组：按空数组处理', () => {
    renderWith({
      anomalyData: {
        summary: {
          total_anomalies: 0,
          high_severity_count: 0,
          medium_severity_count: 0,
          low_severity_count: 0,
        },
        anomalies: 'bad' as never,
      },
    });
    expect(screen.getByText('未检测到异常')).toBeInTheDocument();
  });

  it('anomalies 非空：渲染统计 + 列表', () => {
    const { container } = renderWith({ anomalyData: dataFull });
    expect(screen.getByText('异常总数')).toBeInTheDocument();
    expect(screen.getAllByText('高严重度').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('中严重度').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('低严重度').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(container.textContent).toContain('积分变化: +5');
    expect(container.textContent).toContain('检测时间: 2026-09-20');
  });

  it('severity 三档标签：high/medium/low', () => {
    renderWith({
      anomalyData: {
        summary: {
          total_anomalies: 3,
          high_severity_count: 1,
          medium_severity_count: 1,
          low_severity_count: 1,
        },
        anomalies: [
          {
            name: 'a',
            anomaly_type: 't',
            severity: 'high',
            description: 'd',
            score_change: 1,
            detected_at: '',
          },
          {
            name: 'b',
            anomaly_type: 't',
            severity: 'medium',
            description: 'd',
            score_change: 1,
            detected_at: '',
          },
          {
            name: 'c',
            anomaly_type: 't',
            severity: 'low',
            description: 'd',
            score_change: 1,
            detected_at: '',
          },
        ],
      },
    });
    expect(screen.getAllByText('高严重度').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('中严重度').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('低严重度').length).toBeGreaterThanOrEqual(1);
  });

  it('字段缺省：name→未知学生 / type→异常 / desc→空 / detected→空', () => {
    renderWith({
      anomalyData: {
        summary: {
          total_anomalies: 1,
          high_severity_count: 0,
          medium_severity_count: 0,
          low_severity_count: 1,
        },
        anomalies: [
          {
            name: undefined as never,
            anomaly_type: undefined as never,
            severity: 'low',
            description: undefined as never,
            score_change: 0,
            detected_at: undefined as never,
          },
        ],
      },
    });
    expect(screen.getByText('未知学生')).toBeInTheDocument();
    expect(screen.getByText('异常')).toBeInTheDocument();
    expect(screen.getByText('检测时间:')).toBeInTheDocument();
  });

  it('score_change 负数/正数：符号渲染', () => {
    const { container } = renderWith({
      anomalyData: {
        summary: {
          total_anomalies: 2,
          high_severity_count: 0,
          medium_severity_count: 0,
          low_severity_count: 2,
        },
        anomalies: [
          {
            name: 'a',
            anomaly_type: 't',
            severity: 'low',
            description: 'd',
            score_change: -3,
            detected_at: '',
          },
          {
            name: 'b',
            anomaly_type: 't',
            severity: 'low',
            description: 'd',
            score_change: 4,
            detected_at: '',
          },
        ],
      },
    });
    expect(container.textContent).toContain('积分变化: -3');
    expect(container.textContent).toContain('积分变化: +4');
  });

  it('score_change 非数字/NaN：兜底 0', () => {
    const { container } = renderWith({
      anomalyData: {
        summary: {
          total_anomalies: 2,
          high_severity_count: 0,
          medium_severity_count: 0,
          low_severity_count: 2,
        },
        anomalies: [
          {
            name: 'a',
            anomaly_type: 't',
            severity: 'low',
            description: 'd',
            score_change: NaN as never,
            detected_at: '',
          },
          {
            name: 'b',
            anomaly_type: 't',
            severity: 'low',
            description: 'd',
            score_change: undefined as never,
            detected_at: '',
          },
        ],
      },
    });
    expect(container.textContent).toContain('积分变化: 0');
  });

  it('severity 未知值：SEVERITY_COLORS 兜底空类 + 默认低严重度标签', () => {
    renderWith({
      anomalyData: {
        summary: {
          total_anomalies: 1,
          high_severity_count: 0,
          medium_severity_count: 0,
          low_severity_count: 1,
        },
        anomalies: [
          {
            name: 'x',
            anomaly_type: 't',
            severity: 'critical' as never,
            description: 'd',
            score_change: 1,
            detected_at: '',
          },
        ],
      },
    });
    expect(screen.getAllByText('低严重度').length).toBeGreaterThanOrEqual(1);
    // 兜底空类：badge 自身（span）不应带色值 class（stat card 颜色与此无关）
    const badge = screen.getByText('低严重度', { selector: 'span' });
    expect(badge.className).not.toContain('text-red-600');
    expect(badge.className).not.toContain('text-yellow-600');
    expect(badge.className).not.toContain('text-green-600');
    expect(badge.className).not.toContain('bg-red-500');
  });

  it('searchKeyword 命中：过滤；未命中：未找到匹配的记录', () => {
    const { rerender } = renderWith({ anomalyData: dataFull, searchKeyword: '张三' });
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.queryByText('李四')).toBeNull();
    rerender(
      <AnomalyTab
        deps={
          {
            ...baseDeps,
            anomalyData: dataFull,
            searchKeyword: '不存在',
          } as unknown as AlgorithmAnalysisDeps
        }
      />
    );
    expect(screen.getByText('未找到匹配的记录')).toBeInTheDocument();
  });
});
