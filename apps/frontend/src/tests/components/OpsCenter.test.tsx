/**
 * OpsCenter 组件测试（T11 静默失败页改造 · 错误分支覆盖）
 *
 * 重点：
 *  - 多个运维接口任一失败时页面渲染「部分运维数据加载失败」提示而非静默空白
 *  - 断言 role=alert 错误提示出现（partialError）
 */
/// <reference types="jest" />
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { OpsCenter } from '../../pages/OpsCenter';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

vi.mock('../../services/api', () => ({
  getAuthHeaders: () => ({}),
}));

describe('OpsCenter 错误分支', () => {
  beforeEach(() => {
    mockLocalStorage();
    // 所有运维接口（health/performance/mqtt/stats/logs）均失败 → partialError=true
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
  });

  test('部分接口失败时渲染错误态而非静默空白', async () => {
    renderWithProviders(<OpsCenter />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent || '').toContain('部分运维数据加载失败');
    });
  });
});
