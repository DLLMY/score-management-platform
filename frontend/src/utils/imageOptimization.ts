/**
 * 图片优化工具函数
 * 支持WebP格式、响应式图片、图片懒加载等优化
 */

/**
 * 获取优化后的图片URL
 * @param src 原始图片路径
 * @returns 优化后的图片URL
 */
export const getOptimizedImageUrl = (src: string): string => {
  if (!src) return src;

  // 如果已经是WebP格式，直接返回
  if (src.toLowerCase().endsWith('.webp')) {
    return src;
  }

  // 尝试转换为WebP格式
  const ext = src.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    // 移除原扩展名并添加WebP
    const basePath = src.substring(0, src.length - ext.length);
    return `${basePath}webp`;
  }

  return src;
};

/**
 * 生成响应式图片配置
 * @param src 原始图片路径
 * @param breakpoints 断点配置
 * @returns 响应式图片配置对象
 */
export interface ResponsiveImageConfig {
  src: string;
  srcSet: string;
  sizes: string;
}

export const getResponsiveImage = (
  src: string,
  breakpoints: { [key: string]: number } = {
    sm: 480,
    md: 768,
    lg: 1024,
    xl: 1280,
  }
): ResponsiveImageConfig => {
  const srcSetParts: string[] = [];

  Object.entries(breakpoints).forEach(([key, width]) => {
    const sizeSuffix = key === 'sm' ? '' : `-${key}`;
    const url = getOptimizedImageUrl(src);
    srcSetParts.push(`${url}${sizeSuffix} ${width}w`);
  });

  return {
    src: getOptimizedImageUrl(src),
    srcSet: srcSetParts.join(', '),
    sizes: '(max-width: 480px) 480px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, 1280px',
  };
};

/**
 * 图片占位符生成器
 * @param width 宽度
 * @param height 高度
 * @param backgroundColor 背景颜色
 * @returns SVG占位符URL
 */
export const generatePlaceholder = (
  width: number = 100,
  height: number = 100,
  backgroundColor: string = '#f3f4f6'
): string => {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'%3E%3Crect fill='${backgroundColor}' width='${width}' height='${height}'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='12' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${width}x${height}%3C/text%3E%3C/svg%3E`;
};

/**
 * 检查浏览器是否支持WebP格式
 * @returns Promise<boolean>
 */
export const supportsWebP = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src =
      'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==';
  });
};

/**
 * 获取图片尺寸
 * @param src 图片URL
 * @returns 包含width和height的Promise
 */
export const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      img.src = '';
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
};

/**
 * 图片加载错误处理
 * @param e 错误事件
 */
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>): void => {
  const target = e.currentTarget;
  const fallbackSrc = generatePlaceholder(target.width || 100, target.height || 100, '#e5e7eb');

  if (target.src !== fallbackSrc) {
    target.src = fallbackSrc;
  }
};
