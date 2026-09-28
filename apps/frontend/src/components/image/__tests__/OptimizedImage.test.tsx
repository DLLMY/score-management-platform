/**
 * OptimizedImage 补测（B34）。
 * 纯展示 + 懒加载组件，零网络依赖（imageOptimization 工具为纯函数，无 canvas）。
 * 覆盖可达分支：eager/lazy 守卫、responsive srcSet/sizes、onLoad 可选回调、
 * 占位符尺寸兜底（width||100/height||100）与 fallbackColor、图片 onError 回退。
 *
 * 注：懒加载（lazy=true）存在实现死锁——imgRef 绑定在 imageSrc 就绪后才挂载的真实 img 上，
 * 而 IntersectionObserver 守卫 `!lazy || !imgRef.current` 在 imgRef.current 为 null 时提前返回，
 * 导致观察者永不创建、isInView 恒为 false、真实 img 永不渲染。该分支（进入视口触发 / IO 未定义守卫）
 * 当前不可达，属源缺陷，不在本补测批次修复范围，故仅测可达守卫分支。
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptimizedImage } from '../OptimizedImage';

const realImg = (container: HTMLElement) =>
  container.querySelector('img[loading]') as HTMLImageElement | null;
const placeholderImg = (container: HTMLElement) =>
  container.querySelector('img:not([loading])') as HTMLImageElement | null;

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
    // 加载后占位符消失
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

describe('OptimizedImage · lazy 加载守卫', () => {
  it('lazy=true → 初始真实图片未渲染（观察者守卫 !imgRef.current 提前返回）', () => {
    const { container } = render(<OptimizedImage src='a.png' alt='a' lazy />);
    // 当前实现：真实 img（携带 imgRef）在 imageSrc 就绪前不挂载，
    // 故观察者守卫在 imgRef.current 为 null 时提前返回。
    expect(realImg(container)).toBeNull();
    // 占位符仍渲染
    expect(placeholderImg(container)).toBeTruthy();
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
