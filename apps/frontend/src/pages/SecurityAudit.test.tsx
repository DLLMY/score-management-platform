import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import SecurityAuditPage from './SecurityAudit';

// ---- 共享可变桩（hoist 至 vi.mock 之前，供工厂闭包引用）----
const hoisted = vi.hoisted(() => ({
  mockFetchJson: vi.fn(),
  capturedUrls: [] as string[],
}));

interface MockRow {
  id?: number | string;
  [key: string]: unknown;
}
interface MockColumn {
  key: string;
  dataIndex?: string;
  render?: (value: unknown, record: MockRow, index: number) => unknown;
}

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
  StatusBadge: ({ status }: { status?: string }) => (
    <span data-testid='status-badge'>{String(status)}</span>
  ),
  DataTable: ({
    columns,
    dataSource,
    loading,
    onPageChange,
  }: {
    columns: MockColumn[];
    dataSource: MockRow[];
    loading?: boolean;
    onPageChange?: (page: number, pageSize: number) => void;
  }) => (
    <div data-testid='data-table'>
      {loading && <div>表格加载中</div>}
      <table>
        <tbody>
          {dataSource.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render
                    ? (col.render(row[col.dataIndex as string], row, idx) as ReactNode)
                    : String(row[col.dataIndex as string] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        data-testid='next-page'
        onClick={() => {
          if (onPageChange) onPageChange(2, 20);
        }}
      >
        下一页
      </button>
    </div>
  ),
}));

vi.mock('../hooks', () => ({
  fetchJson: hoisted.mockFetchJson,
}));

// ---- fixtures ----
interface AuditLogFixture {
  id: number;
  event_type: string;
  severity?: string;
  user_id?: number | null;
  user_type?: string;
  ip_address?: string | null;
  request_path?: string | null;
  request_method?: string;
  event_details?: string | null;
  created_at: string;
}

function makeLog(over: Partial<AuditLogFixture> = {}): AuditLogFixture {
  return {
    id: 1,
    event_type: 'login',
    severity: 'info',
    user_id: 1,
    user_type: 'teacher',
    ip_address: '1.2.3.4',
    request_path: '/api/x',
    request_method: 'POST',
    event_details: 'detail-text',
    created_at: '2026-01-01T08:00:00Z',
    ...over,
  };
}

const statsFull = {
  total: 100,
  last_24h: 10,
  last_7d: 50,
  by_severity: { info: 5, debug: 1, warning: 2, error: 3, critical: 1 },
  by_type: { login: 10 },
  top_ips: [{ ip: '1.2.3.4', count: 3 }],
};

function stubSuccess(logs: AuditLogFixture[]) {
  hoisted.mockFetchJson.mockImplementation((url: string) => {
    hoisted.capturedUrls.push(url);
    if (url.includes('audit-stats')) return Promise.resolve(statsFull);
    return Promise.resolve({
      logs,
      total: logs.length,
      page: 1,
      per_page: 20,
      pages: 1,
    });
  });
}

describe('SecurityAudit 渲染与分支覆盖 B52', () => {
  beforeEach(() => {
    hoisted.capturedUrls.length = 0;
    vi.clearAllMocks();
  });

  it('正常加载日志与统计：覆盖统计卡片与各列渲染', async () => {
    stubSuccess([
      makeLog({ id: 1, severity: 'info' }),
      makeLog({ id: 2, severity: 'error' }),
      makeLog({ id: 3, severity: 'warning' }),
      makeLog({ id: 4, severity: 'critical' }),
      makeLog({ id: 5, severity: 'debug' }),
    ]);

    render(<SecurityAuditPage />);

    await waitFor(() => expect(screen.getByText('累计事件')).toBeInTheDocument());

    // 统计卡片数值（含 warning+error+critical 求和 2+3+1=6）
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();

    // 列渲染：event_type / severity 徽标 / 详情
    expect(screen.getAllByText('login').length).toBeGreaterThan(0);
    const badges = screen.getAllByTestId('status-badge').map((n) => n.textContent);
    expect(badges).toEqual(
      expect.arrayContaining(['info', 'error', 'warning', 'critical', 'debug'])
    );
    expect(screen.getAllByText('detail-text')).toHaveLength(5);
  });

  it('日志加载失败显示错误条，点击重试后恢复', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      return Promise.resolve(null);
    });

    render(<SecurityAuditPage />);

    await waitFor(() => expect(screen.getByText('安全审计日志加载失败')).toBeInTheDocument());

    // 重试：恢复成功响应
    stubSuccess([makeLog({ id: 1 })]);
    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => expect(screen.getByText('累计事件')).toBeInTheDocument());
    expect(screen.queryByText('安全审计日志加载失败')).toBeNull();
  });

  it('过滤条件（事件类型/级别/起止日期）写入请求参数并重载', async () => {
    stubSuccess([makeLog({ id: 1 })]);

    const { container } = render(<SecurityAuditPage />);
    await waitFor(() => expect(screen.getByText('累计事件')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('事件类型（如 login / access_denied）'), {
      target: { value: 'login' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'warning' } });
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-31' } });

    // 点击刷新触发带过滤参数的重载
    fireEvent.click(screen.getByText('刷新'));

    await waitFor(() => {
      const last = hoisted.capturedUrls[hoisted.capturedUrls.length - 1];
      expect(last).toContain('event_type=login');
      expect(last).toContain('severity=warning');
      expect(last).toContain('start_date=2026-01-01');
      expect(last).toContain('end_date=2026-01-31');
    });
  });

  it('分页 onPageChange 触发带 page=2 的重载', async () => {
    stubSuccess([makeLog({ id: 1 }), makeLog({ id: 2 })]);

    render(<SecurityAuditPage />);
    await waitFor(() => expect(screen.getByTestId('data-table')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('next-page'));

    await waitFor(() => {
      const last = hoisted.capturedUrls[hoisted.capturedUrls.length - 1];
      expect(last).toContain('page=2');
      expect(last).toContain('per_page=20');
    });
  });

  it('统计缺字段时显示占位符（?? "—" 与 by_severity undefined 求和 0）', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      if (url.includes('audit-stats')) return Promise.resolve({});
      return Promise.resolve({
        logs: [makeLog({ id: 1 })],
        total: 1,
        page: 1,
        per_page: 20,
        pages: 1,
      });
    });

    render(<SecurityAuditPage />);
    await waitFor(() => expect(screen.getByText('累计事件')).toBeInTheDocument());

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('列渲染 null 分支：user_id/ip/path/detail 为 -，severity 未知走 fallback', async () => {
    stubSuccess([
      makeLog({
        id: 1,
        severity: 'unknownX',
        user_id: null,
        ip_address: null,
        request_path: null,
        event_details: null,
      }),
      makeLog({ id: 2, severity: undefined }),
    ]);

    render(<SecurityAuditPage />);
    await waitFor(() => expect(screen.getByTestId('data-table')).toBeInTheDocument());

    const badges = screen.getAllByTestId('status-badge').map((n) => n.textContent);
    expect(badges).toContain('unknownX'); // severity || 'info' → 已知值分支
    expect(badges).toContain('info'); // severity 缺省 → fallback 分支

    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(4);
  });

  it('日志列表为空（data.logs 为 null）不崩溃', async () => {
    hoisted.mockFetchJson.mockImplementation((url: string) => {
      hoisted.capturedUrls.push(url);
      if (url.includes('audit-stats')) return Promise.resolve(statsFull);
      return Promise.resolve({ logs: null, total: 0, page: 1, per_page: 20, pages: 1 });
    });

    render(<SecurityAuditPage />);
    await waitFor(() => expect(screen.getByTestId('data-table')).toBeInTheDocument());
    expect(screen.getByText('累计事件')).toBeInTheDocument();
  });
});
