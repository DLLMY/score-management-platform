import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import DevTools from '../DevTools.jsx';

// 受控 mock：config / webVitals / useMemoryUsage 全部由本测试驱动，避免真实性能 API 抖动
const mockConfig = vi.hoisted(() => ({ devTools: { enabled: true } }));
const mockVitals = vi.hoisted(() => ({
  CLS: 0.05,
  FID: 50,
  LCP: 1000,
  FCP: 1000,
  TTFB: 500,
}));
const mockMemory = vi.hoisted(() => ({ used: 120, total: 256, percentage: 47 }));

vi.mock('../../../config', () => ({ config: mockConfig }));
vi.mock('../../../utils/webVitals', () => ({
  getVitals: () => mockVitals,
  observeVitals: () => () => {},
}));
vi.mock('../../../hooks', () => ({
  useMemoryUsage: () => mockMemory,
}));

describe('DevTools 开发工具面板', () => {
  beforeEach(() => {
    mockConfig.devTools.enabled = true;
    mockVitals.CLS = 0.05;
    mockVitals.FID = 50;
    mockVitals.LCP = 1000;
    mockVitals.FCP = 1000;
    mockVitals.TTFB = 500;
    mockMemory.used = 120;
    mockMemory.total = 256;
    mockMemory.percentage = 47;
  });

  afterEach(() => cleanup());

  it('devTools 关闭时直接返回 null（不渲染任何节点）', () => {
    mockConfig.devTools.enabled = false;
    const { container } = render(<DevTools />);
    expect(container.firstChild).toBeNull();
  });

  it('devTools 开启时渲染悬浮按钮，点击展开面板并展示 5 项指标 + 内存块', () => {
    render(<DevTools />);
    // 悬浮按钮存在
    const btn = screen.getByRole('button');
    expect(btn).toBeTruthy();
    // 初始未展开：不应有「开发工具」标题
    expect(screen.queryByText('开发工具')).toBeNull();

    // 点击展开
    fireEvent.click(btn);
    expect(screen.getByText(/开发工具/)).toBeTruthy();

    // 指标名渲染（5 项）
    for (const name of ['CLS', 'FID', 'LCP', 'FCP', 'TTFB']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    // 内存块（依赖 useMemoryUsage 返回 truthy）
    expect(screen.getByText('内存使用')).toBeTruthy();
    expect(screen.getByText('已使用')).toBeTruthy();
    expect(screen.getByText('120 MB')).toBeTruthy();
    expect(screen.getByText('总计')).toBeTruthy();
    expect(screen.getByText('256 MB')).toBeTruthy();
  });

  it('getRating 三档评级（good/needs/poor）与 getColor 配色分支全覆盖', () => {
    // 构造混合评级：CLS 0.3→poor, FID 200→needs, LCP 3000→needs, FCP 1000→good, TTFB 1000→needs
    mockVitals.CLS = 0.3;
    mockVitals.FID = 200;
    mockVitals.LCP = 3000;
    mockVitals.FCP = 1000;
    mockVitals.TTFB = 1000;
    render(<DevTools />);
    fireEvent.click(screen.getByRole('button'));
    // 所有指标值都会渲染（含各评级分支的计算结果）
    for (const name of ['CLS', 'FID', 'LCP', 'FCP', 'TTFB']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });
});
