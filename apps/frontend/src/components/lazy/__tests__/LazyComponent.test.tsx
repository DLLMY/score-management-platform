import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createLazyComponent } from '../LazyComponent';

const RealComp = () => <div>lazy-real</div>;

const throwingImport = (): Promise<{ default: () => ReactElement }> =>
  Promise.reject(new Error('load failed'));

const hangingImport = (): Promise<{ default: () => ReactElement }> => new Promise(() => {});

describe('createLazyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('返回可调用组件且 displayName 含 Lazy', () => {
    const Lazy = createLazyComponent(() => Promise.resolve({ default: RealComp }));
    expect(typeof Lazy).toBe('function');
    expect((Lazy as { displayName?: string }).displayName ?? '').toContain('Lazy');
  });

  it('preload=true 时立即调用 importFn', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: RealComp }));
    createLazyComponent(importFn, { preload: true });
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('渲染成功时显示懒加载内容', async () => {
    const Lazy = createLazyComponent(() => Promise.resolve({ default: RealComp }));
    render(<Lazy />);
    await waitFor(() => expect(screen.getByText('lazy-real')).toBeTruthy());
  });

  it('支持自定义 loading 元素', async () => {
    const Lazy = createLazyComponent(hangingImport, {
      loading: <div>custom-loading</div>,
    });
    render(<Lazy />);
    expect(screen.getByText('custom-loading')).toBeTruthy();
  });

  it('加载失败错误边界显示默认 fallback', async () => {
    const Lazy = createLazyComponent(throwingImport);
    render(<Lazy />);
    await waitFor(() => expect(screen.getByText('组件加载失败')).toBeTruthy());
  });

  it('加载失败错误边界显示自定义 error 元素', async () => {
    const Lazy = createLazyComponent(throwingImport, {
      error: <div>custom-error</div>,
    });
    render(<Lazy />);
    await waitFor(() => expect(screen.getByText('custom-error')).toBeTruthy());
  });
});
