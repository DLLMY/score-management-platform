import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import ErrorBoundaryClass, { ErrorBoundaryFallback, ErrorBoundaryWrapper } from '../ErrorBoundary';

// 隔离单文件运行时显式清理 DOM（test-setup 未注册 RTL 全局 cleanup）
afterEach(cleanup);

// 覆盖开发环境专属分支（isDevelopment=true）：
// componentDidCatch 内 logger.error / render 内组件堆栈区块 + 底部开发提示
vi.mock('../../config/env', () => ({ isDevelopment: true }));

const Boom = ({ message = 'kaboom' }: { message?: string }) => {
  throw new Error(message);
};

describe('ErrorBoundaryClass · 开发环境分支', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => true),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('开发环境渲染组件堆栈区块与开发提示（isDevelopment 真分支）', async () => {
    render(
      <ErrorBoundaryClass>
        <Boom message='dev-msg' />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('页面出错了')).toBeInTheDocument());
    // {isDevelopment && errorInfo && (...)} 真分支：组件堆栈区块
    expect(screen.getByText('组件堆栈:')).toBeInTheDocument();
    // 底部 {isDevelopment && (...)} 真分支：开发提示
    expect(screen.getByText(/开发环境 - 详细错误信息已在控制台输出/)).toBeInTheDocument();
    // error?.message 真分支（非空 message 渲染）
    expect(screen.getByText('dev-msg')).toBeInTheDocument();
  });

  it('error.message 为空时回退到「未知错误」（|| 右分支）', async () => {
    render(
      <ErrorBoundaryClass>
        <Boom message='' />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('未知错误')).toBeInTheDocument());
  });
});

describe('ErrorBoundaryFallback · 边界分支', () => {
  it('error 为空时回退到「请刷新页面重试」（|| 右分支）', () => {
    render(<ErrorBoundaryFallback />);
    expect(screen.getByText('请刷新页面重试')).toBeInTheDocument();
  });

  it('onRetry 未提供时点击刷新不抛错（默认 window.location.reload）', () => {
    render(<ErrorBoundaryFallback error={new Error('x')} />);
    expect(() => fireEvent.click(screen.getByText('刷新页面'))).not.toThrow();
  });
});

describe('ErrorBoundaryWrapper · onError 与 fallback 分支', () => {
  it('传入 onError 时错误事件触发回调（onError?. 真分支）', async () => {
    const onError = vi.fn();
    render(
      <ErrorBoundaryWrapper onError={onError}>
        <div>wrapped</div>
      </ErrorBoundaryWrapper>
    );
    window.dispatchEvent(new Event('error'));
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it('传入 fallback 时错误后渲染 fallback 而非默认 UI（if(fallback) 真分支）', async () => {
    render(
      <ErrorBoundaryWrapper fallback={<div>wrapper-fallback</div>}>
        <div>wrapped</div>
      </ErrorBoundaryWrapper>
    );
    window.dispatchEvent(new Event('error'));
    await waitFor(() => expect(screen.getByText('wrapper-fallback')).toBeInTheDocument());
  });
});
