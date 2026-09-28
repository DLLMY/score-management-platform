import React, { useState, useEffect, useRef } from 'react';
import {
  getOptimizedImageUrl,
  generatePlaceholder,
  handleImageError,
  getResponsiveImage,
} from '../../utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  responsive?: boolean;
  fallbackColor?: string;
  onLoad?: () => void;
}

/**
 * 优化的图片组件
 * - 支持懒加载
 * - 支持WebP格式
 * - 支持响应式图片
 * - 带有占位符和错误处理
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  lazy = true,
  responsive = false,
  fallbackColor = '#f3f4f6',
  onLoad,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 懒加载逻辑：观察「始终挂载」的容器，进入视口即加载。
  // 关键修复：旧实现把 observer 绑到 imageSrc 就绪后才挂载的真实 <img>（imgRef），
  // 而 imageSrc 又依赖 observer 回调置值，形成先有鸡还是先有蛋的死锁——
  // imgRef.current 在真实 img 挂载前为 null，守卫 `!imgRef.current` 提前 return，
  // 观察者永不创建，isInView 恒 false，懒加载图片永远不加载。
  // 改为观察外层容器（始终渲染），打破死锁。
  useEffect(() => {
    if (!lazy) return;
    const el = containerRef.current;
    if (!el) return;

    // 环境 guard: 无 IntersectionObserver → 直接加载
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [lazy]);

  // 设置图片源
  useEffect(() => {
    if (isInView && src) {
      if (responsive) {
        const config = getResponsiveImage(src);
        setImageSrc(config.src);
      } else {
        setImageSrc(getOptimizedImageUrl(src));
      }
    }
  }, [isInView, src, responsive]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const placeholderSrc = generatePlaceholder(width || 100, height || 100, fallbackColor);

  const responsiveConfig = responsive && imageSrc ? getResponsiveImage(imageSrc) : null;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {/* 占位符 */}
      {!isLoaded && (
        <img
          src={placeholderSrc}
          alt={alt}
          className='w-full h-full object-cover'
          style={{ width, height }}
        />
      )}

      {/* 实际图片 */}
      {imageSrc && (
        <img
          src={imageSrc}
          srcSet={responsiveConfig?.srcSet}
          sizes={responsiveConfig?.sizes}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ width, height }}
          onLoad={handleLoad}
          onError={handleImageError}
          loading={lazy ? 'lazy' : 'eager'}
        />
      )}

      {/* 加载动画 */}
      {!isLoaded && imageSrc && (
        <div className='absolute inset-0 flex items-center justify-center bg-gray-100'>
          <div className='w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin'></div>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
