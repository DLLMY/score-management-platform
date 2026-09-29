import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EngagementTab } from './EngagementTab';
import type { AlgorithmAnalysisDeps } from './types';

// 子组件桩替身
vi.mock('./EngagementTrendChart', () => ({
  EngagementTrendChart: vi.fn(() => <div data-testid='trend-chart' />),
}));

vi.mock('../../components', () => ({
  DataTable: ({
    dataSource,
    onRowClick,
  }: {
    dataSource?: Array<{ user_id: number; name: string; has_data: boolean }>;
    onRowClick?: (row: unknown) => void;
  }) => (
    <div data-testid='datatable'>
      {(dataSource || []).map((row, i) => (
        <button key={i} data-testid={`row-${i}`} onClick={() => onRowClick?.(row)}>
          {row.name}
        </button>
      ))}
    </div>
  ),
}));

function makeDeps(overrides: Record<string, unknown> = {}): AlgorithmAnalysisDeps {
  const base = {
    engagementRank: null,
    classes: [{ id: 1, name: '一班' }],
    selectedClass: '',
    setSelectedClass: vi.fn(),
    setEngagementTrendUserId: vi.fn(),
    setEngagementTrend: vi.fn(),
    engagementRankDays: 30,
    setEngagementRankDays: vi.fn(),
    loadEngagementRank: vi.fn(),
    handleExport: vi.fn(),
    exporting: null,
    engagementRankError: null,
    engagementRankLoading: false,
    engagementTrend: null,
    engagementTrendUserId: null,
    engagementTrendWeeks: 6,
    setEngagementTrendWeeks: vi.fn(),
    engagementTrendLoading: false,
    engagementColumns: [],
  };
  return { ...base, ...overrides } as unknown as AlgorithmAnalysisDeps;
}

function renderTab(deps: AlgorithmAnalysisDeps) {
  return render(<EngagementTab deps={deps} />);
}

describe('EngagementTab 渲染与分支覆盖 B50', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染控制区与班级下拉选项', () => {
    renderTab(makeDeps());
    expect(screen.getByText('选择班级:')).toBeInTheDocument();
    expect(screen.getByText('统计天数:')).toBeInTheDocument();
    expect(screen.getByText('生成全班参与度排名')).toBeInTheDocument();
    expect(screen.getByText('导出 Excel')).toBeInTheDocument();
    expect(screen.getByText('一班')).toBeInTheDocument();
  });

  it('selectedClass 为空时提示选择班级', () => {
    renderTab(makeDeps({ selectedClass: '' }));
    expect(screen.getByText(/请先在上方/)).toBeInTheDocument();
  });

  it('selectedClass 非空时渲染清除按钮并点击重置', () => {
    const deps = makeDeps({ selectedClass: '一班' });
    renderTab(deps);
    const clear = screen.getByText('清除');
    fireEvent.click(clear);
    expect(deps.setSelectedClass).toHaveBeenCalledWith('');
    expect(deps.setEngagementTrendUserId).toHaveBeenCalledWith(null);
    expect(deps.setEngagementTrend).toHaveBeenCalledWith(null);
  });

  it('班级下拉变更派发 setSelectedClass 并清空趋势', () => {
    const deps = makeDeps({ selectedClass: '一班' });
    renderTab(deps);
    fireEvent.change(screen.getByLabelText('选择班级:'), { target: { value: '一班' } });
    expect(deps.setSelectedClass).toHaveBeenCalledWith('一班');
    expect(deps.setEngagementTrendUserId).toHaveBeenCalledWith(null);
    expect(deps.setEngagementTrend).toHaveBeenCalledWith(null);
  });

  it('统计天数输入变更派发（空值回退 30）', () => {
    const deps = makeDeps();
    renderTab(deps);
    const input = screen.getByLabelText('统计天数:') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '45' } });
    expect(deps.setEngagementRankDays).toHaveBeenCalledWith(45);
    fireEvent.change(input, { target: { value: '' } });
    expect(deps.setEngagementRankDays).toHaveBeenCalledWith(30);
  });

  it('生成按钮按 selectedClass/loading 可用性触发', () => {
    const ok = makeDeps({ selectedClass: '一班' });
    const r1 = renderTab(ok);
    const btn = screen.getByRole('button', { name: /生成全班参与度排名/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(ok.loadEngagementRank).toHaveBeenCalledTimes(1);
    r1.unmount();

    const empty = makeDeps({ selectedClass: '' });
    const r2 = renderTab(empty);
    const disabledBtn = screen.getByRole('button', {
      name: /生成全班参与度排名/,
    }) as HTMLButtonElement;
    expect(disabledBtn.disabled).toBe(true);
    r2.unmount();

    const loading = makeDeps({ selectedClass: '一班', engagementRankLoading: true });
    renderTab(loading);
    const loadBtn = screen.getByRole('button', {
      name: /计算中/,
    }) as HTMLButtonElement;
    expect(loadBtn.disabled).toBe(true);
  });

  it('导出按钮派发 handleExport；导出中显示"导出中..."且禁用', () => {
    const ok = makeDeps({ selectedClass: '一班' });
    const r1 = renderTab(ok);
    const btn = screen.getByRole('button', { name: /导出 Excel/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(ok.handleExport).toHaveBeenCalledWith('engagement', 30);
    r1.unmount();

    const exp = makeDeps({ selectedClass: '一班', exporting: 'engagement' });
    const r2 = renderTab(exp);
    const expBtn = screen.getByRole('button', { name: /导出中/ }) as HTMLButtonElement;
    expect(expBtn.disabled).toBe(true);
    r2.unmount();

    const noClass = makeDeps({ selectedClass: '' });
    renderTab(noClass);
    const dis = screen.getByRole('button', { name: /导出 Excel/ }) as HTMLButtonElement;
    expect(dis.disabled).toBe(true);
  });

  it('engagementRankError 渲染错误条', () => {
    renderTab(makeDeps({ engagementRankError: 'boom' }));
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('汇总卡片渲染 total/with_data/high/failed', () => {
    const rank = {
      students: [
        { user_id: 1, name: 'A', has_data: true, level: 'high' },
        { user_id: 2, name: 'B', has_data: false, level: 'low' },
      ],
      total: 2,
      with_data: 1,
      failed: 0,
    };
    renderTab(makeDeps({ selectedClass: '一班', engagementRank: rank }));
    expect(screen.getByText('班级人数')).toBeInTheDocument();
    expect(screen.getByText('有效参与度')).toBeInTheDocument();
    expect(screen.getByText('高参与度')).toBeInTheDocument();
    expect(screen.getByText('异常隔离')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('排名表行点击：has_data 行触发 setEngagementTrendUserId，否则不触发', () => {
    const rank = {
      students: [
        { user_id: 1, name: 'A', has_data: true, level: 'high' },
        { user_id: 2, name: 'B', has_data: false, level: 'low' },
      ],
      total: 2,
      with_data: 1,
      failed: 0,
    };
    const deps = makeDeps({ selectedClass: '一班', engagementRank: rank });
    renderTab(deps);
    fireEvent.click(screen.getByTestId('row-0')); // A has_data
    fireEvent.click(screen.getByTestId('row-1')); // B no data
    expect(deps.setEngagementTrendUserId).toHaveBeenCalledTimes(1);
    expect(deps.setEngagementTrendUserId).toHaveBeenCalledWith(1);
  });

  it('个人趋势区：trendStudent 命中显示姓名标题，周数下拉变更派发', () => {
    const rank = {
      students: [{ user_id: 1, name: 'A', has_data: true, level: 'high' }],
      total: 1,
      with_data: 1,
      failed: 0,
    };
    const deps = makeDeps({
      selectedClass: '一班',
      engagementRank: rank,
      engagementTrendUserId: 1,
      engagementTrend: { weeks: 6, points: [] },
    });
    renderTab(deps);
    expect(screen.getByText('A 的参与度周趋势')).toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
    const weeks = screen.getByDisplayValue('6周') as HTMLSelectElement;
    fireEvent.change(weeks, { target: { value: '12' } });
    expect(deps.setEngagementTrendWeeks).toHaveBeenCalledWith(12);
  });

  it('个人趋势区：trendStudent 未命中显示兜底标题', () => {
    const rank = {
      students: [{ user_id: 1, name: 'A', has_data: true, level: 'high' }],
      total: 1,
      with_data: 1,
      failed: 0,
    };
    renderTab(
      makeDeps({
        selectedClass: '一班',
        engagementRank: rank,
        engagementTrendUserId: 99,
        engagementTrend: { weeks: 6, points: [] },
      })
    );
    expect(screen.getByText('参与度周趋势')).toBeInTheDocument();
  });

  it('个人趋势区加载态显示加载提示', () => {
    const rank = {
      students: [{ user_id: 1, name: 'A', has_data: true, level: 'high' }],
      total: 1,
      with_data: 1,
      failed: 0,
    };
    renderTab(
      makeDeps({
        selectedClass: '一班',
        engagementRank: rank,
        engagementTrendUserId: 1,
        engagementTrend: { weeks: 6, points: [] },
        engagementTrendLoading: true,
      })
    );
    expect(screen.getByText('加载周趋势...')).toBeInTheDocument();
  });
});
