import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LazyImage from '../LazyImage';

// 保存原始实现，测试后还原，避免污染同 worker 其它测试
const originalIO = globalThis.IntersectionObserver;
const originalImage = globalThis.Image;

// IntersectionObserver：observe 时立即触发 intersecting=true → 触发懒加载
class FiringIO {
  cb: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
  constructor(cb: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
    this.cb = cb;
  }
  observe(el: Element) {
    this.cb([{ isIntersecting: true, target: el }]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

let webpSupported = true;
class MockImage {
  width = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  set src(v: string) {
    this._src = v;
    if (webpSupported) {
      this.width = 1;
      this.onload?.();
    } else {
      this.onerror?.();
    }
  }
  get src() {
    return this._src;
  }
}

describe('LazyImage', () => {
  beforeEach(() => {
    // @ts-expect-error - 测试用覆盖
    globalThis.IntersectionObserver = FiringIO;
    // @ts-expect-error - 测试用覆盖
    globalThis.Image = MockImage;
    webpSupported = true;
  });
  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
    globalThis.Image = originalImage;
  });

  it('仅 src：进入视口后渲染 img，onLoad 触发淡入', async () => {
    const onLoad = vi.fn();
    render(<LazyImage src='/a.png' alt='pic' onLoad={onLoad} />);
    const img = (await screen.findByAltText('pic')) as HTMLImageElement;
    expect(img.src).toContain('/a.png');
    fireEvent.load(img);
    expect(onLoad).toHaveBeenCalled();
  });

  it('加载失败：onError 触发并显示错误占位', async () => {
    const onError = vi.fn();
    render(<LazyImage src='/bad.png' alt='bad' onError={onError} />);
    const img = await screen.findByAltText('bad');
    fireEvent.error(img);
    expect(onError).toHaveBeenCalled();
    expect(screen.getByText('图片加载失败')).toBeInTheDocument();
  });

  it('webpSrc + srcSet 且支持 WebP：渲染 webp source 与响应式 source，img 用 webpSrc', async () => {
    const srcSet = [
      { src: '/a-480.jpg', type: 'image/jpeg', media: '(max-width:480px)' },
      { src: '/a-768.jpg', type: 'image/jpeg', media: '(max-width:768px)' },
    ];
    render(<LazyImage src='/a.jpg' alt='wp' webpSrc='/a.webp' srcSet={srcSet} sizes='100vw' />);
    const img = (await screen.findByAltText('wp')) as HTMLImageElement;
    await waitFor(() => expect(img.getAttribute('src')).toContain('/a.webp'));
    const sources = document.querySelectorAll('source');
    expect(sources.length).toBe(3); // 1 webp + 2 响应式
    expect(sources[0].getAttribute('type')).toBe('image/webp');
  });

  it('webpSrc 但环境不支持 WebP：回退到原始 src，不渲染 webp source', async () => {
    webpSupported = false;
    render(<LazyImage src='/a.jpg' alt='nofallback' webpSrc='/a.webp' />);
    const img = (await screen.findByAltText('nofallback')) as HTMLImageElement;
    await waitFor(() => expect(img.getAttribute('src')).toContain('/a.jpg'));
    const webpSource = Array.from(document.querySelectorAll('source')).find(
      (s) => s.getAttribute('type') === 'image/webp'
    );
    expect(webpSource).toBeUndefined();
  });

  it('尺寸/宽高/aspectRatio 应用到外层容器', () => {
    const { container } = render(
      <LazyImage src='/x.png' alt='dim' width={120} height={60} aspectRatio='2/1' />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('120px');
    expect(div.style.height).toBe('60px');
    expect(div.style.aspectRatio).toBe('2/1');
  });
});
