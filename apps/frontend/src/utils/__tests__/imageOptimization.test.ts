import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SyntheticEvent } from 'react';
import {
  getOptimizedImageUrl,
  getResponsiveImage,
  generatePlaceholder,
  supportsWebP,
  getImageDimensions,
  handleImageError,
} from '../imageOptimization';

// 控制 Image mock 行为：返回 {width,height} 或触发 onerror
type ImageResult = { width: number; height: number } | 'error';
let imageResult: ImageResult = { width: 10, height: 20 };

class MockImage {
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  set src(v: string) {
    this._src = v;
    const r = imageResult;
    if (r === 'error') {
      this.onerror?.();
    } else {
      this.width = r.width;
      this.height = r.height;
      this.onload?.();
    }
  }
  get src() {
    return this._src;
  }
}

const originalImage = globalThis.Image;

describe('imageOptimization', () => {
  beforeEach(() => {
    // @ts-expect-error - 测试用覆盖
    globalThis.Image = MockImage;
    imageResult = { width: 10, height: 20 };
  });
  afterEach(() => {
    globalThis.Image = originalImage;
    vi.unstubAllGlobals();
  });

  describe('getOptimizedImageUrl', () => {
    it('空字符串原样返回', () => {
      expect(getOptimizedImageUrl('')).toBe('');
    });
    it('已是 webp 原样返回', () => {
      expect(getOptimizedImageUrl('/a.webp')).toBe('/a.webp');
    });
    it('jpg/jpeg/png/gif 转为 webp（保留点）', () => {
      expect(getOptimizedImageUrl('/a.jpg')).toBe('/a.webp');
      expect(getOptimizedImageUrl('/a.jpeg')).toBe('/a.webp');
      expect(getOptimizedImageUrl('/a.png')).toBe('/a.webp');
      expect(getOptimizedImageUrl('/a.gif')).toBe('/a.webp');
    });
    it('其它扩展名原样返回', () => {
      expect(getOptimizedImageUrl('/a.bmp')).toBe('/a.bmp');
      expect(getOptimizedImageUrl('/a')).toBe('/a');
    });
  });

  describe('getResponsiveImage', () => {
    it('默认断点生成 srcSet 与 sizes', () => {
      const cfg = getResponsiveImage('/a.jpg');
      expect(cfg.src).toBe('/a.webp');
      expect(cfg.srcSet).toContain('480w');
      expect(cfg.srcSet).toContain('1280w');
      expect(cfg.srcSet).toContain('/a.webp 480w'); // sm 无后缀
      expect(cfg.srcSet).toContain('/a.webp-md 768w');
      expect(cfg.sizes).toContain('(max-width: 480px) 480px');
    });
    it('自定义断点覆盖默认', () => {
      const cfg = getResponsiveImage('/a.png', { sm: 320, lg: 1024 });
      expect(cfg.srcSet).toContain('/a.webp 320w');
      expect(cfg.srcSet).toContain('/a.webp-lg 1024w');
    });
  });

  describe('generatePlaceholder', () => {
    it('默认值', () => {
      const url = generatePlaceholder();
      expect(url).toContain('data:image/svg+xml');
      expect(url).toContain('100x100');
      expect(url).toContain('#f3f4f6');
    });
    it('自定义参数', () => {
      const url = generatePlaceholder(200, 100, '#000000');
      expect(url).toContain('200x100');
      expect(url).toContain('#000000');
    });
  });

  describe('supportsWebP', () => {
    it('window 未定义时返回 false', async () => {
      vi.stubGlobal('window', undefined);
      await expect(supportsWebP()).resolves.toBe(false);
    });
    it('Image onload → true', async () => {
      imageResult = { width: 1, height: 1 };
      await expect(supportsWebP()).resolves.toBe(true);
    });
    it('Image onerror → false', async () => {
      imageResult = 'error';
      await expect(supportsWebP()).resolves.toBe(false);
    });
  });

  describe('getImageDimensions', () => {
    it('onload 解析宽高', async () => {
      imageResult = { width: 640, height: 480 };
      const dims = await getImageDimensions('/img.png');
      expect(dims).toEqual({ width: 640, height: 480 });
    });
    it('onerror 拒绝', async () => {
      imageResult = 'error';
      await expect(getImageDimensions('/img.png')).rejects.toThrow(/Failed to load image/);
    });
  });

  describe('handleImageError', () => {
    class FakeImgEl {
      width: number;
      height: number;
      private _src: string;
      constructor(w: number, h: number, initial: string) {
        this.width = w;
        this.height = h;
        this._src = initial;
      }
      get src() {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
      }
    }
    it('将 src 回退为占位符（首次）', () => {
      const target = new FakeImgEl(120, 80, '/broken.png');
      handleImageError({ currentTarget: target } as unknown as SyntheticEvent<HTMLImageElement>);
      expect(target.src).toContain('data:image/svg+xml');
    });
    it('已是占位符则不重复设置', () => {
      const fallback = generatePlaceholder(100, 100, '#e5e7eb');
      const target = new FakeImgEl(100, 100, fallback);
      // setter 若被调用则抛错，验证未重复设置
      let called = false;
      Object.defineProperty(target, 'src', {
        configurable: true,
        get: () => fallback,
        set: () => {
          called = true;
        },
      });
      handleImageError({ currentTarget: target } as unknown as SyntheticEvent<HTMLImageElement>);
      expect(called).toBe(false);
    });
  });
});
