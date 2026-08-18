/**
 * ScoreEntry组件测试 - 增强版
 */
/// <reference types="jest" />
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ScoreEntry from '../../pages/ScoreEntry';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';
import { usePermissionStore } from '../../stores';

// 通用 api mock：任何嵌套方法返回空数组（渲染组件不再真实 fetch → 消除 fetch failed 噪音）
vi.mock('../../services/api', () => {
  const empty = () => Promise.resolve([]);
  const proxify = () => new Proxy({}, { get: () => empty });
  return { __esModule: true, default: new Proxy({}, { get: () => proxify() }) };
});

describe('ScoreEntry Component', () => {
  beforeEach(() => {
    const store = mockLocalStorage();
    store['admin'] = JSON.stringify({ id: 1, username: 'test', role: 'admin' });
    store['access_token'] = 'test-token';
    jest.clearAllMocks();
    
    usePermissionStore.getState().setPermissions(['score.view', 'score.edit', 'score.entry'], ['admin']);
  });

  test('成绩录入页面可以渲染', async () => {
    renderWithProviders(<ScoreEntry />);
    
    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });
  });

  test('成绩录入表单显示关键字段', async () => {
    renderWithProviders(<ScoreEntry />);
    
    await waitFor(() => {
      const selectElements = screen.getAllByRole('combobox');
      expect(selectElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('成绩录入显示操作按钮', async () => {
    renderWithProviders(<ScoreEntry />);
    
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(5);
    });
  });
});

export {};
