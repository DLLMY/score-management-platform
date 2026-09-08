/**
 * SystemMetrics 组件测试（T11 静默失败页改造 · 错误分支覆盖）
 *
 * 重点：
 *  - fetch 失败时页面不再静默 return null，而是渲染错误态 UI
 *  - 断言「系统指标加载失败，请稍后重试」错误提示出现（role=alert）
 */
/// <reference types="jest" />
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { SystemMetrics } from '../../pages/SystemMetrics';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

vi.mock('../../services/api', () => ({
  getAuthHeaders: () => ({}),
}));

describe('SystemMetrics 错误分支', () => {
  beforeEach(() => {
    mockLocalStorage();
    // 模拟接口失败：fetch 抛错 → fetchJson 进入 catch 返回 null → loadError=true
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
  });

  test('接口失败时渲染错误态而非静默空白', async () => {
    renderWithProviders(<SystemMetrics />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent || '').toContain('系统指标加载失败');
    });
  });
});
