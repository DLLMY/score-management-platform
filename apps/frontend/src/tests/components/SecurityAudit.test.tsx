/**
 * SecurityAudit 组件测试（T11 静默失败页改造 · 错误分支覆盖）
 *
 * 重点：
 *  - fetch 失败时页面渲染错误态 UI（role=alert）而非静默空白
 *  - 断言「安全审计日志加载失败，请稍后重试」错误提示出现
 */
/// <reference types="jest" />
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { SecurityAuditPage } from '../../pages/SecurityAudit';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

vi.mock('../../services/api', () => ({
  getAuthHeaders: () => ({}),
}));

describe('SecurityAudit 错误分支', () => {
  beforeEach(() => {
    mockLocalStorage();
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
  });

  test('接口失败时渲染错误态而非静默空白', async () => {
    renderWithProviders(<SecurityAuditPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent || '').toContain('安全审计日志加载失败');
    });
  });
});
