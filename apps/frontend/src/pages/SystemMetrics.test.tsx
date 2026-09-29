import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import SystemMetrics from './SystemMetrics';

// ---- 共享可变桩（hoist 至 vi.mock 之前，供工厂闭包引用）----
const hoisted = vi.hoisted(() => ({
  mockFetchJson: vi.fn(),
  capturedUrls: [] as string[],
}));

vi.mock('../components', () => ({
  PermissionButton: ({
    children,
    onClick,
    disabled,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  EmptyState: ({ title, description }: { title?: string; description?: string }) => (
    <div data-testid='empty-state'>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('../hooks', () => ({
  fetchJson: hoisted.mockFetchJson,
}));

// ---- fixtures ----
interface MetricRow {
  id: number;
  metric_name: string;
  metric_value: number;
  unit?: string | null;
  category?: string | null;
  created_at: string;
}

interface MetricsResult {
  items: MetricRow[];
  latest: Record<string, { value: number; unit?: string | null; updated_at?: string | null }>;
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

function makeRows(page: number): MetricRow[] {
  const offset = (page - 1) * 5;
  return [
    {
      id: offset + 1,
      metric_name: 'cpu_percent',
      metric_value: 50,
      unit: '%',
      created_at: '2026-01-01T08:00:00',
    },
    {
      id: offset + 2,
      metric_name: 'memory_percent',
      metric_value: 60,
      unit: '%',
      created_at: '2026-01-01T08:00:00',
    },
    {
      id: offset + 3,
      metric_name: 'disk_percent',
      metric_value: 70,
      unit: '%',
      created_at: '2026-01-01T08:00:00',
    },
    {
      id: offset + 4,
      metric_name: 'net_sent',
      metric_value: 100,
      unit: 'B',
      created_at: '2026-01-01T08:00:00',
    },
    {
      id: offset + 5,
      metric_name: 'net_recv',
      metric_value: 200,
      unit: 'B',
      created_at: '2026-01-01T08:00:00',
    },
  ];
}

function makeLatest() {
  return {
    cpu_percent: { value: 50, unit: '%', updated_at: '2026-01-01T08:00:00' },
    memory_percent: { value: 60, unit: '%', updated_at: '2026-01-01T08:00:00' },
    disk_percent: { value: 70, unit: '%', updated_at: '2026-01-01T08:00:00' },
    net_sent: { value: 100, unit: 'B', updated_at: '2026-01-01T08:00:00' },
    net_recv: { value: 200, unit: 'B', updated_at: '2026-01-01T08:00:00' },
  };
}

function stubSinglePage() {
  hoisted.mockFetchJson.mockImplementation((url: string) => {
    hoisted.capturedUrls.push(url);
    return Promise.resolve({
      items: makeRows(1),
      latest: makeLatest(),
      total: 5,
      page: 1,
      per_page: 500,
      pages: 1,
    } as MetricsResult);
  });
}

function stubPages(pages: number) {
  hoisted.mockFetchJson.mockImplementation((url: string) => {
    hoisted.capturedUrls.push(url);
    const m = url.match(/page=(\d+)/);
    const page = m ? Number(m[1]) : 1;
    return Promise.resolve({
      items: makeRows(page),
      latest: makeLatest(),
      total: pages * 5,
      page,
      per_page: 500,
      pages,
    } as MetricsResult);
  });
}

describe('SystemMetrics 渲染与分支覆盖 B53', () => {
  beforeEach(() => {
    hoisted.capturedUrls.length = 0;
    vi.clearAllMocks();
  });

  it('正常加载（单页）：覆盖 5 卡片值/单位/更新时间 + 系列非空不显示空态', async () => {
    stubSinglePage();

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('系统指标趋势')).toBeInTheDocument());

    // 5 个最新值卡片标签
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('内存')).toBeInTheDocument();
    expect(screen.getByText('磁盘')).toBeInTheDocument();
    expect(screen.getByText('网络发送')).toBeInTheDocument();
    expect(screen.getByText('网络接收')).toBeInTheDocument();

    // 数值与单位渲染（避开与「60 秒」描述冲突的 60）
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();

    // updated_at 分支：5 张卡片均显示「更新于」
    expect(screen.getAllByText(/更新于/).length).toBe(5);

    // 系列非空 → 两个图表区不显示 EmptyState、不显示加载中
    expect(screen.queryByText('暂无采样数据')).toBeNull();
    expect(screen.queryByText('加载中...')).toBeNull();
  });

  it('多页分页循环：覆盖 page===1 与 all.concat 分支及 while 条件', async () => {
    stubPages(2);

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('系统指标趋势')).toBeInTheDocument());

    // 循环拉取了第 2 页
    expect(hoisted.capturedUrls.some((u) => u.includes('page=2'))).toBe(true);
    // 聚合总数 = 2 页 × 5
    expect(screen.getByText(/共 10 条/)).toBeInTheDocument();
  });

  it('加载失败（fetchJson 返回 null）：显示错误条，点击重试后恢复', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      return Promise.resolve(null);
    });

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('系统指标加载失败')).toBeInTheDocument());

    // 重试：恢复成功响应
    stubSinglePage();
    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => expect(screen.getByText('系统指标趋势')).toBeInTheDocument());
    expect(screen.queryByText('系统指标加载失败')).toBeNull();
  });

  it('hours 选择变更触发带 hours=6 参数的重载', async () => {
    stubSinglePage();

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('系统指标趋势')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '6' } });

    await waitFor(() => {
      const last = hoisted.capturedUrls[hoisted.capturedUrls.length - 1];
      expect(last).toContain('hours=6');
    });
  });

  it('刷新按钮触发重载', async () => {
    stubSinglePage();

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('系统指标趋势')).toBeInTheDocument());

    const before = hoisted.capturedUrls.length;
    fireEvent.click(screen.getByText('刷新'));

    await waitFor(() => expect(hoisted.capturedUrls.length).toBeGreaterThan(before));
  });

  it('空数据：5 卡片显示 — 且两个图表区显示 EmptyState', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      return Promise.resolve({
        items: [],
        latest: {},
        total: 0,
        page: 1,
        per_page: 500,
        pages: 1,
      } as MetricsResult);
    });

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText(/共 0 条/)).toBeInTheDocument());

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('暂无采样数据').length).toBe(2);
  });

  it('初始加载中态显示占位，数据到达后消失', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    const p = new Promise<unknown>((res) => {
      resolveFetch = res;
    });
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      return p;
    });

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getAllByText('加载中...').length).toBeGreaterThanOrEqual(1));

    resolveFetch({
      items: [],
      latest: {},
      total: 0,
      page: 1,
      per_page: 500,
      pages: 1,
    } as MetricsResult);
    await waitFor(() => expect(screen.queryByText('加载中...')).toBeNull());
  });

  it('latest 缺省分支：无 unit / 无 updated_at / 缺失 key 显示 —', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      if (url.includes('page')) {
        return Promise.resolve({
          items: [
            {
              id: 1,
              metric_name: 'cpu_percent',
              metric_value: 42,
              created_at: '2026-01-01T08:00:00',
            },
          ],
          latest: {
            cpu_percent: { value: 42 }, // 无 unit，无 updated_at
            // net_recv 缺失
          },
          total: 1,
          page: 1,
          per_page: 500,
          pages: 1,
        } as MetricsResult);
      }
      return Promise.resolve({
        items: [],
        latest: {},
        total: 0,
        page: 1,
        per_page: 500,
        pages: 1,
      } as MetricsResult);
    });

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('CPU')).toBeInTheDocument());

    expect(screen.getByText('42')).toBeInTheDocument();
    // updated_at 缺失 → 不显示「更新于」
    expect(screen.queryByText(/更新于/)).toBeNull();
    // net_recv 等缺失 key → 显示 —
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('响应缺字段时走 || 兜底（items/latest/total/pages）', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      // 缺 items/latest/total/pages，仅保留 page/per_page
      return Promise.resolve({ page: 1, per_page: 500 });
    });

    render(<SystemMetrics />);
    await waitFor(() => expect(screen.getByText('系统指标趋势')).toBeInTheDocument());

    expect(screen.getByText(/共 0 条/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText('暂无采样数据').length).toBe(2);
  });
});
