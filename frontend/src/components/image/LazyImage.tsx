import React, { useState, useEffect, useRef, memo } from 'react';

interface ResponsiveImage {
  src: string;
  srcSet?: string;
  type?: string;
  media?: string;
}

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholderColor?: string;
  threshold?: number;
  rootMargin?: string;
  onLoad?: () => void;
  onError?: () => void;
  // 增强功能
  srcSet?: ResponsiveImage[];
  webpSrc?: string;
  sizes?: string;
  aspectRatio?: string;
}

/**
 * 检测浏览器是否支持 WebP 格式
 */
const checkWebPSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAEAAQAcJaQAA3AA/v3AgAA=';
  });
};

/**
 * 懒加载图片组件 - 增强版
 *
 * 新增功能：
 * - WebP 格式自动检测与切换
 * - 响应式图片 srcSet 支持
 * - 渐进式加载体验
 * - 更好的占位符效果
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  placeholderColor = '#f3f4f6',
  threshold = 0.1,
  rootMargin = '100px',
  onLoad,
  onError,
  srcSet,
  webpSrc,
  sizes,
  aspectRatio,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isWebPSupported, setIsWebPSupported] = useState<boolean | null>(null);

  const imgRef = useRef<HTMLDivElement>(null);

  // 检测 WebP 支持
  useEffect(() => {
    if (webpSrc) {
      checkWebPSupport().then(setIsWebPSupported);
    }
  }, [webpSrc]);

  // Intersection Observer 实现懒加载
  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    // 环境 guard: 无 IntersectionObserver（旧浏览器/测试环境）→ 直接加载，不阻塞图片
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const handleImageLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleImageError = () => {
    setHasError(true);
    onError?.();
  };

  // 确定要加载的图片源
  const getImageSrc = (): string => {
    if (webpSrc && isWebPSupported) {
      return webpSrc;
    }
    return src;
  };

  // 构建 srcSet
  const getSrcSet = (): string | undefined => {
    if (srcSet) {
      return srcSet
        .map((img) => `${img.src} ${img.type || ''}`)
        .filter(Boolean)
        .join(', ');
    }
    return undefined;
  };

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        width,
        height,
        aspectRatio,
        backgroundColor: placeholderColor,
      }}
    >
      {/* 渐变占位符动画 */}
      {!isLoaded && !hasError && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer'
            style={{
              backgroundSize: '200% 100%',
            }}
          />
          <svg
            className='w-8 h-8 text-gray-300 relative z-10'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
            />
          </svg>
        </div>
      )}

      {/* 错误状态 */}
      {hasError && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800'>
          <svg
            className='w-12 h-12 mb-2 text-gray-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <span className='text-sm text-gray-400'>图片加载失败</span>
        </div>
      )}

      {/* 实际图片 */}
      {shouldLoad && !hasError && (
        <picture>
          {/* WebP 格式 */}
          {webpSrc && isWebPSupported && <source srcSet={webpSrc} type='image/webp' />}

          {/* 响应式图片源 */}
          {srcSet?.map((img, index) => (
            <source key={index} srcSet={img.src} type={img.type} media={img.media} />
          ))}

          <img
            src={getImageSrc()}
            srcSet={srcSet ? getSrcSet() : undefined}
            sizes={sizes}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ width, height }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading='lazy'
            decoding='async'
          />
        </picture>
      )}

      {/* 加载完成后的淡入效果 */}
      {isLoaded && (
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-shimmer {
            animation: shimmer 1.5s ease-in-out;
          }
        `}</style>
      )}
    </div>
  );
};

export default memo(LazyImage);
