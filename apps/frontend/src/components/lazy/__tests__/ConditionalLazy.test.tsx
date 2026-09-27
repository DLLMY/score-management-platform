import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConditionalLazy, FeatureLazy } from '../ConditionalLazy';

const MockChild = () => <div>child-content</div>;

describe('ConditionalLazy', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('condition=false 渲染 fallback', () => {
    render(
      <ConditionalLazy condition={false} fallback={<span>fallback</span>}>
        <MockChild />
      </ConditionalLazy>
    );
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(screen.queryByText('child-content')).toBeNull();
  });

  it('condition=true 后异步渲染 children', async () => {
    render(
      <ConditionalLazy condition={true} fallback={<span>fallback</span>}>
        <MockChild />
      </ConditionalLazy>
    );
    await waitFor(() => expect(screen.getByText('child-content')).toBeTruthy());
  });

  it('condition 由 false 切到 true 后渲染 children', async () => {
    const { rerender } = render(
      <ConditionalLazy condition={false} fallback={<span>fallback</span>}>
        <MockChild />
      </ConditionalLazy>
    );
    expect(screen.getByText('fallback')).toBeTruthy();
    rerender(
      <ConditionalLazy condition={true} fallback={<span>fallback</span>}>
        <MockChild />
      </ConditionalLazy>
    );
    await waitFor(() => expect(screen.getByText('child-content')).toBeTruthy());
  });
});

describe('FeatureLazy', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('功能标志未启用时渲染 FallbackComponent', () => {
    const Fallback = () => <div>feature-off</div>;
    const Lazy = FeatureLazy('myFeature', vi.fn(), Fallback);
    render(<Lazy />);
    expect(screen.getByText('feature-off')).toBeTruthy();
  });

  it('功能标志启用时渲染懒加载组件', async () => {
    const RealComp = () => <div>real-feature</div>;
    const importFn = vi.fn(() => Promise.resolve({ default: RealComp }));
    localStorage.setItem('feature_myFeature', 'true');
    const Fallback = () => <div>feature-off</div>;
    const Lazy = FeatureLazy('myFeature', importFn, Fallback);
    render(<Lazy />);
    await waitFor(() => expect(screen.getByText('real-feature')).toBeTruthy());
    expect(importFn).toHaveBeenCalled();
  });
});
