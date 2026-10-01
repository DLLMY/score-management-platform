import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ErrorBoundaryClass, { ErrorBoundaryFallback, ErrorBoundaryWrapper } from '../ErrorBoundary';

const Boom = ({ message = 'kaboom' }: { message?: string }) => {
  throw new Error(message);
};

describe('ErrorBoundaryClass', () => {
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

  it('renders children when no error', () => {
    render(
      <ErrorBoundaryClass>
        <div>hello</div>
      </ErrorBoundaryClass>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('catches child render error and shows fallback with message', async () => {
    render(
      <ErrorBoundaryClass>
        <Boom message='boom-msg' />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('页面出错了')).toBeInTheDocument());
    expect(screen.getByText('boom-msg')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', async () => {
    render(
      <ErrorBoundaryClass fallback={<div>custom-fallback</div>}>
        <Boom />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('custom-fallback')).toBeInTheDocument());
  });

  it('calls onError and logs to backend via sendBeacon', async () => {
    const onError = vi.fn();
    render(
      <ErrorBoundaryClass onError={onError}>
        <Boom message='logged' />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(onError).toHaveBeenCalled());
    await waitFor(() => expect(navigator.sendBeacon).toHaveBeenCalled());
  });

  it('retry button triggers reload without throwing', async () => {
    render(
      <ErrorBoundaryClass>
        <Boom />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('刷新页面')).toBeInTheDocument());
    // jsdom 的 window.location.reload 为 no-op，点击不应抛错（handleRetry 分支被覆盖）
    expect(() => fireEvent.click(screen.getByText('刷新页面'))).not.toThrow();
  });

  it('home button sets location hash', async () => {
    render(
      <ErrorBoundaryClass>
        <Boom />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('返回首页')).toBeInTheDocument());
    fireEvent.click(screen.getByText('返回首页'));
    expect(window.location.hash).toBe('#/');
  });

  it('sendBeacon 缺失时回退到 fetch 上报', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    const onError = vi.fn();
    render(
      <ErrorBoundaryClass onError={onError}>
        <Boom message='fetch-fallback' />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(onError).toHaveBeenCalled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('fetch 上报失败时静默吞掉异常（不掩盖原始错误）', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
    const fetchMock = vi.fn().mockRejectedValue(new Error('net down'));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    render(
      <ErrorBoundaryClass>
        <Boom message='fetch-err' />
      </ErrorBoundaryClass>
    );
    await waitFor(() => expect(screen.getByText('页面出错了')).toBeInTheDocument());
  });
});

describe('ErrorBoundaryFallback', () => {
  it('renders message and calls onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorBoundaryFallback error={new Error('fallback-msg')} onRetry={onRetry} />);
    expect(screen.getByText('fallback-msg')).toBeInTheDocument();
    fireEvent.click(screen.getByText('刷新页面'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('ErrorBoundaryWrapper', () => {
  it('catches window error event', async () => {
    render(
      <ErrorBoundaryWrapper>
        <div>wrapped</div>
      </ErrorBoundaryWrapper>
    );
    expect(screen.getByText('wrapped')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('error'));
    });
    await waitFor(() => expect(screen.getByText('页面加载失败')).toBeInTheDocument());
  });

  it('catches unhandledrejection event', async () => {
    render(
      <ErrorBoundaryWrapper>
        <div>wrapped2</div>
      </ErrorBoundaryWrapper>
    );
    act(() => {
      window.dispatchEvent(new Event('unhandledrejection'));
    });
    await waitFor(() => expect(screen.getByText('页面加载失败')).toBeInTheDocument());
  });
});
