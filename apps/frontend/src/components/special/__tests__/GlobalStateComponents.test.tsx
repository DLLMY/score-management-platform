import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GlobalStateProvider, {
  GlobalLoading,
  GlobalErrorBoundary,
  NetworkStatusIndicator,
  useLoading,
  useGlobalError,
  useNetworkStatus,
} from '../GlobalStateComponents';

function Harness() {
  const { state: loading, show, hide } = useLoading();
  const { state: error, clear } = useGlobalError();
  const network = useNetworkStatus();
  return (
    <div>
      <button data-testid='show' onClick={() => show('请稍候')}>
        show
      </button>
      <button data-testid='hide' onClick={hide}>
        hide
      </button>
      <button data-testid='clear' onClick={clear}>
        clear
      </button>
      <span data-testid='loading'>{String(loading.isLoading)}</span>
      <span data-testid='loading-msg'>{loading.message}</span>
      <span data-testid='error'>{String(error.hasError)}</span>
      <span data-testid='net-online'>{String(network.isOnline)}</span>
      <span data-testid='net-reconnecting'>{String(network.isReconnecting)}</span>
      <GlobalLoading />
      <GlobalErrorBoundary />
      <NetworkStatusIndicator />
    </div>
  );
}

function setup() {
  return render(
    <GlobalStateProvider>
      <Harness />
    </GlobalStateProvider>
  );
}

describe('GlobalStateComponents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Provider 渲染 children 且初始网络在线、无加载/错误指示', () => {
    const { container } = setup();
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('net-online').textContent).toBe('true');
    expect(screen.getByTestId('net-reconnecting').textContent).toBe('false');
    // 在线 + 非重连 → NetworkStatusIndicator 返回 null
    expect(container.querySelector('[class*="bottom-4"]')).toBeNull();
    // 未加载 → GlobalLoading 返回 null
    expect(container.querySelector('[class*="animate-spin"]')).toBeNull();
  });

  it('showLoading 显示加载遮罩与自定义 message，hideLoading 复位', () => {
    const { container } = setup();
    fireEvent.click(screen.getByTestId('show'));
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('loading-msg').textContent).toBe('请稍候');
    expect(container.querySelector('[class*="animate-spin"]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('hide'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(container.querySelector('[class*="animate-spin"]')).toBeNull();
  });

  it('window offline 事件 → NetworkStatusIndicator 显示「网络已断开」', () => {
    const { container } = setup();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('net-online').textContent).toBe('false');
    const indicator = container.querySelector('[class*="bottom-4"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toContain('网络已断开');
    expect(indicator?.querySelector('.bg-red-500')).not.toBeNull();
  });

  it('window load 事件 → NetworkStatusIndicator 显示「正在重连...」', () => {
    const { container } = setup();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    expect(screen.getByTestId('net-reconnecting').textContent).toBe('true');
    const indicator = container.querySelector('[class*="bottom-4"]');
    expect(indicator?.textContent).toContain('正在重连...');
    // 离线→load：isOnline 仍为 false，圆点保持 bg-red-500（颜色由 isOnline 决定）
    expect(indicator?.querySelector('.bg-red-500')).not.toBeNull();
  });

  it('window online 事件 → 网络状态复位为在线', () => {
    const { container } = setup();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(container.querySelector('[class*="bottom-4"]')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('net-online').textContent).toBe('true');
    expect(container.querySelector('[class*="bottom-4"]')).toBeNull();
  });

  it('error 初始 hasError=false → GlobalErrorBoundary 返回 null', () => {
    const { container } = setup();
    expect(screen.getByTestId('error').textContent).toBe('false');
    expect(container.querySelector('[class*="max-w-md"]')).toBeNull();
  });
});
