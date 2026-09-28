/**
 * OptimizedImage 补测（B34 选源 + B35 源码修复后补分支）。
 * 纯展示 + 懒加载组件，零网络依赖（imageOptimization 工具为纯函数，无 canvas）。
 *
 * B35 修复前：懒加载存在死锁——imgRef 绑在 imageSrc 就绪后才挂载的真实 img 上，
 * 而 imageSrc 又由 IntersectionObserver 回调置值，守卫 `!lazy || !imgRef.current` 在
 * imgRef.current 为 null 时提前返回 → 观察者永不创建 → isInView 恒 false → 真实 img 永不渲染。
 * 修复后：observer 改为观察始终挂载的包裹 div（containerRef），死锁打破，
 * 故本文件现覆盖「进入视口触发加载」与「无 IntersectionObserver 环境守卫」两个可达分支。
 */
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptimizedImage } from '../OptimizedImage';

const realImg = (container: HTMLElement) =>
  container.querySelector('img[loading]') as HTMLImageElement | null;
const placeholderImg = (container: HTMLElement) =>
  container.querySelector('img:not([loading])') as HTMLImageElement | null;

// 可控 IntersectionObserver：observe 时立即回调 isIntersecting=true（模拟进入视口）
class FiringIntersectionObserver {
  constructor(private readonly cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.cb(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe('OptimizedImage · eager 加载路径', () => {
  it('lazy=false(eager) → 立即渲染真实图片并在 load 后回调 onLoad', () => {
    const onLoad = vi.fn();
    const { container } = render(
      <OptimizedImage src='test.png' alt='t' lazy={false} onLoad={onLoad} />
    );
    const img = realImg(container);
    expect(img).toBeTruthy();
    expect(img?.getAttribute('loading')).toBe('eager');
    fireEvent.load(img as HTMLImageElement);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(placeholderImg(container)).toBeNull();
  });

  it('未传 onLoad → load 后不抛错（可选回调分支）', () => {
    const { container } = render(<OptimizedImage src='x.png' alt='x' lazy={false} />);
    const img = realImg(container);
    expect(() => fireEvent.load(img as HTMLImageElement)).not.toThrow();
    expect(placeholderImg(container)).toBeNull();
  });

  it('responsive=true → 真实图片携带 srcSet 与 sizes', () => {
    const { container } = render(<OptimizedImage src='c.png' alt='c' lazy={false} responsive />);
    const img = realImg(container);
    expect(img).toBeTruthy();
    expect(img?.getAttribute('srcset')).toBeTruthy();
    expect(img?.getAttribute('sizes')).toContain('480px');
  });
});

describe('OptimizedImage · lazy 进入视口触发加载', () => {
  const origIO = globalThis.IntersectionObserver;

  beforeAll(() => {
    globalThis.IntersectionObserver =
      FiringIntersectionObserver as unknown as typeof IntersectionObserver;
  });
  afterAll(() => {
    globalThis.IntersectionObserver = origIO;
  });

  it('lazy=true + IO 触发 isIntersecting → 渲染真实图片并 load 后回调 onLoad', async () => {
    const onLoad = vi.fn();
    const { container } = render(<OptimizedImage src='a.png' alt='a' lazy onLoad={onLoad} />);
    await waitFor(() => expect(realImg(container)).toBeTruthy());
    const img = realImg(container) as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
    fireEvent.load(img);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(placeholderImg(container)).toBeNull();
  });

  it('lazy=true + 默认 stub（observe 空操作）→ 真实图片初始不渲染（守卫未触发分支）', () => {
    // 回退到 test-setup 的默认 no-op stub：observe 不触发回调
    globalThis.IntersectionObserver = origIO;
    const { container } = render(<OptimizedImage src='a.png' alt='a' lazy />);
    expect(realImg(container)).toBeNull();
    expect(placeholderImg(container)).toBeTruthy();
    // 还原可控 mock 供同 describe 后续用例
    globalThis.IntersectionObserver =
      FiringIntersectionObserver as unknown as typeof IntersectionObserver;
  });
});

describe('OptimizedImage · 环境守卫（无 IntersectionObserver）', () => {
  const origIO = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = origIO;
  });

  it('lazy=true + IntersectionObserver 未定义 → 守卫直接置 isInView=true 渲染真实图片', () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
    const { container } = render(<OptimizedImage src='a.png' alt='a' lazy />);
    expect(realImg(container)).toBeTruthy();
  });
});

describe('OptimizedImage · 占位符与错误回退', () => {
  it('占位符按 width/height 生成且使用自定义 fallbackColor', () => {
    const { container } = render(
      <OptimizedImage
        src='p.png'
        alt='p'
        lazy={false}
        width={200}
        height={150}
        fallbackColor='#ff0000'
      />
    );
    const ph = placeholderImg(container);
    expect(ph).toBeTruthy();
    expect(ph?.getAttribute('src')).toContain('200x150');
    expect(ph?.getAttribute('src')).toContain('ff0000');
  });

  it('未传 width/height → 占位符用默认 100x100 与默认底色', () => {
    const { container } = render(<OptimizedImage src='q.png' alt='q' lazy={false} />);
    const ph = placeholderImg(container);
    expect(ph?.getAttribute('src')).toContain('100x100');
    expect(ph?.getAttribute('src')).toContain('f3f4f6');
  });

  it('onError → 替换为错误占位图（fallback #e5e7eb）', () => {
    const { container } = render(<OptimizedImage src='e.png' alt='e' lazy={false} />);
    const img = realImg(container);
    fireEvent.error(img as HTMLImageElement);
    expect(img?.getAttribute('src')).toContain('e5e7eb');
  });
});
