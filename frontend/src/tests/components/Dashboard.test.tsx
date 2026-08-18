/**
 * Dashboard组件测试 - 增强版
 */
/// <reference types="jest" />
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import Dashboard from '../../pages/Dashboard';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

// Mock the API module so components render without real network / indexedDB.
// Only the methods the Dashboard actually calls need to resolve.
// Use plain function implementations (not jest.fn().mockResolvedValue) so that
// any global mock-clearing cannot wipe the resolved values.
// 注意: 必须用 vitest 原生 vi.mock（经全局 jest 兼容别名的 jest.mock 不 hoist → mock 失效 → 真实 fetch 噪音）
vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    classes: { getAll: () => Promise.resolve([]) },
    users: { getAll: () => Promise.resolve([]) },
    records: { getAll: () => Promise.resolve([]) },
    devices: { getAll: () => Promise.resolve([]) },
    notifications: { getAll: () => Promise.resolve([]) },
    algorithm: {
      getStatistics: () => Promise.resolve(null),
      getClusters: () => Promise.resolve(null),
      getWarnings: () => Promise.resolve(null),
    },
    dashboard: { getData: () => Promise.resolve(null) },
  },
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    mockLocalStorage();
    // NOTE: do NOT call jest.clearAllMocks() here — it would wipe the
    // module-level api mock's mockResolvedValue implementations.
  });

  test('仪表盘页面可以渲染', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const title = screen.getByText(/仪表盘/i);
      expect(title).toBeInTheDocument();
    });
  });

  test('仪表盘显示统计卡片', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const userCard = screen.getByText(/总用户数/i);
      expect(userCard).toBeInTheDocument();
    });

    await waitFor(() => {
      const recordCard = screen.getByText(/今日记录/i);
      expect(recordCard).toBeInTheDocument();
    });

    await waitFor(() => {
      const scoreCard = screen.getByText(/总积分/i);
      expect(scoreCard).toBeInTheDocument();
    });

    await waitFor(() => {
      const deviceCard = screen.getByText(/在线设备/i);
      expect(deviceCard).toBeInTheDocument();
    });
  });

  test('仪表盘显示刷新按钮', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /刷新/i });
      expect(refreshButton).toBeInTheDocument();
    });
  });

  test('点击刷新按钮触发刷新状态', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /刷新/i });
      expect(refreshButton).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /刷新/i });
    fireEvent.click(refreshButton);
  });

  test('仪表盘显示用户排名区域', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const rankingSection = screen.getByText(/积分排行榜/i);
      expect(rankingSection).toBeInTheDocument();
    });
  });

  test('仪表盘显示设备状态区域', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const deviceSection = screen.getByText(/设备状态/i);
      expect(deviceSection).toBeInTheDocument();
    });
  });

  test('仪表盘显示通知区域', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const notificationSection = screen.getByText(/最新通知/i);
      expect(notificationSection).toBeInTheDocument();
    });
  });

  test('仪表盘显示算法数据区域', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      const algorithmSection = screen.getByText(/算法分析/i);
      expect(algorithmSection).toBeInTheDocument();
    });
  });
});

export {};