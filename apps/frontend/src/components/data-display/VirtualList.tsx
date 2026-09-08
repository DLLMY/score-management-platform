import { useState, useRef, useCallback, useEffect, useMemo, UIEvent, ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor?: (item: T, index?: number) => string | number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
  autoHeight?: boolean;
}

function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  // 回退 key 必须稳定：用绝对索引（items 内稳定位置），禁止 Math.random()——
  // 随机 key 会让 React 每次渲染重建节点，破坏虚拟列表的复用与滚动位置。
  keyExtractor = (item: T, index?: number) => {
    const itemWithId = item as unknown as { id: string | number };
    if (itemWithId.id !== undefined) {
      return itemWithId.id;
    }
    return `vl-idx-${index ?? 0}`;
  },
  containerHeight = 600,
  overscan = 2,
  className = '',
  autoHeight = false,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculatedHeight = useMemo<number>(() => {
    const totalHeight = items.length * itemHeight;
    return autoHeight ? Math.min(totalHeight, containerHeight) : containerHeight;
  }, [items.length, itemHeight, containerHeight, autoHeight]);

  const visibleCount = useMemo<number>(
    () => Math.ceil(calculatedHeight / itemHeight),
    [calculatedHeight, itemHeight]
  );

  const startIndex = useMemo<number>(
    () => Math.max(0, Math.floor(scrollTop / itemHeight) - overscan),
    [scrollTop, itemHeight, overscan]
  );

  const endIndex = useMemo<number>(
    () => Math.min(startIndex + visibleCount + overscan * 2, items.length),
    [startIndex, visibleCount, overscan, items.length]
  );

  const paddingTop = useMemo<number>(() => startIndex * itemHeight, [startIndex, itemHeight]);

  const paddingBottom = useMemo<number>(
    () => Math.max(0, (items.length - endIndex) * itemHeight),
    [items.length, endIndex, itemHeight]
  );

  const handleScroll = useCallback<(e: UIEvent<HTMLDivElement>) => void>((e) => {
    requestAnimationFrame(() => {
      if (e.currentTarget) {
        setScrollTop(e.currentTarget.scrollTop);
      }
    });
  }, []);

  const visibleItems = useMemo<T[]>(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  useEffect(() => {
    setScrollTop(0);
  }, [items.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const handleResize = (): void => {
        container.style.height = `${calculatedHeight}px`;
      };

      // 环境 guard: 无 ResizeObserver → 跳过自动高度同步（仍可滚动）
      if (typeof ResizeObserver === 'undefined') {
        return undefined;
      }
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      return () => resizeObserver.disconnect();
    }
    return undefined;
  }, [calculatedHeight]);

  if (autoHeight) {
    return (
      <div
        className={`scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 ${className}`}
      >
        {items.map((item, index) => (
          <div key={keyExtractor(item, index)}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: calculatedHeight,
        overflowY: 'auto',
        position: 'relative',
        width: '100%',
      }}
      className={`scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 ${className}`}
    >
      <div
        style={{
          height: paddingTop + paddingBottom + visibleItems.length * itemHeight,
          position: 'relative',
        }}
      >
        {visibleItems.map((item, localIndex) => (
          <div
            key={keyExtractor(item, startIndex + localIndex)}
            style={{
              position: 'absolute',
              top: paddingTop + localIndex * itemHeight,
              left: 0,
              right: 0,
            }}
          >
            {renderItem(item, startIndex + localIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualList;
