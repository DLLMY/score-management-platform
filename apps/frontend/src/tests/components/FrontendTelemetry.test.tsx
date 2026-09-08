/**
 * FrontendTelemetry 组件测试（T11 静默失败页改造 · 错误分支覆盖）
 *
 * 重点：
 *  - 性能指标 / 前端错误两类接口失败时，DataTable 渲染错误态而非静默空白
 *  - 断言「指标加载失败，请刷新重试」错误提示出现（perfError）
 */
/// <reference types="jest" />
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { FrontendTelemetry } from '../../pages/FrontendTelemetry';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

vi.mock('../../services/api', () => ({
  getAuthHeaders: () => ({}),
}));

describe('FrontendTelemetry 错误分支', () => {
  beforeEach(() => {
    mockLocalStorage();
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
  });

  test('性能指标接口失败时渲染错误态而非静默空白', async () => {
    renderWithProviders(<FrontendTelemetry />);
    await waitFor(() => {
      expect(document.body.textContent || '').toContain('指标加载失败');
    });
  });

  test('前端错误接口失败时渲染错误态（错误日志加载失败）', async () => {
    renderWithProviders(<FrontendTelemetry />);
    await waitFor(() => {
      expect(document.body.textContent || '').toContain('错误日志加载失败');
    });
  });
});
