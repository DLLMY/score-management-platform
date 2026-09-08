/**
 * AttendanceManage（考勤管理，核心业务页）组件测试
 * 使用通用代理 mock 覆盖任意 api.* 调用，保证渲染期不依赖真实网络。
 */
/// <reference types="jest" />
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { Api } from '../../services/api';
import AttendanceManage from '../../pages/AttendanceManage';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

vi.mock('../../services/api', () => {
  // 通用代理：任意属性访问返回可调用代理；任意调用返回 Promise<[]>，对渲染期安全。
  const makeProxy = (): Api =>
    new Proxy(function () {} as unknown as Api, {
      get: (_t: unknown, prop: PropertyKey) =>
        prop === 'then' ? undefined : (makeProxy() as unknown as Api),
      apply: () => Promise.resolve([]),
    }) as unknown as Api;
  return { __esModule: true, default: makeProxy() };
});

describe('AttendanceManage Component', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  test('考勤管理页面可以渲染', async () => {
    renderWithProviders(<AttendanceManage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /考勤管理/i })).toBeInTheDocument();
    });
  });

  test('页面显示考勤统计与快速记录入口', async () => {
    renderWithProviders(<AttendanceManage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /快速记录/i })).toBeInTheDocument();
    });
  });
});

export {};
