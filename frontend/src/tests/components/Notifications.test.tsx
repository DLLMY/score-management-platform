/**
 * Notifications（通知中心，核心业务页）组件测试
 * 使用通用代理 mock 覆盖任意 api.* 调用，保证渲染期不依赖真实网络。
 */
/// <reference types="jest" />
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { Api } from '../../services/api';
import Notifications from '../../pages/Notifications';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

vi.mock('../../services/api', () => {
  const makeProxy = (): Api =>
    new Proxy(function () {} as unknown as Api, {
      get: (_t: unknown, prop: PropertyKey) =>
        prop === 'then' ? undefined : (makeProxy() as unknown as Api),
      apply: () => Promise.resolve([]),
    }) as unknown as Api;
  return { __esModule: true, default: makeProxy() };
});

describe('Notifications Component', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  test('通知中心页面可以渲染', async () => {
    renderWithProviders(<Notifications />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /通知中心/i })).toBeInTheDocument();
    });
  });

  test('空态下显示暂无通知引导', async () => {
    renderWithProviders(<Notifications />);
    await waitFor(() => {
      expect(screen.getByText(/暂无通知/i)).toBeInTheDocument();
    });
  });
});

export {};
