import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

function VirtualList({ 
  items, 
  itemHeight, 
  renderItem, 
  keyExtractor, 
  containerHeight = 600,
  overscan = 2,
  className = ''
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  
  const visibleCount = useMemo(() => 
    Math.ceil(containerHeight / itemHeight), 
    [containerHeight, itemHeight]
  );
  
  const startIndex = useMemo(() => 
    Math.max(0, Math.floor(scrollTop / itemHeight) - overscan), 
    [scrollTop, itemHeight, overscan]
  );
  
  const endIndex = useMemo(() => 
    Math.min(startIndex + visibleCount + overscan * 2, items.length), 
    [startIndex, visibleCount, overscan, items.length]
  );
  
  const paddingTop = useMemo(() => 
    startIndex * itemHeight, 
    [startIndex, itemHeight]
  );
  
  const paddingBottom = useMemo(() => 
    Math.max(0, (items.length - endIndex) * itemHeight), 
    [items.length, endIndex, itemHeight]
  );
  
  const handleScroll = useCallback((e) => {
    requestAnimationFrame(() => {
      setScrollTop(e.target.scrollTop);
    });
  }, []);
  
  const visibleItems = useMemo(() => 
    items.slice(startIndex, endIndex), 
    [items, startIndex, endIndex]
  );
  
  useEffect(() => {
    setScrollTop(0);
  }, [items.length]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const handleResize = () => {
        container.style.height = `${containerHeight}px`;
      };
      
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      
      return () => resizeObserver.disconnect();
    }
  }, [containerHeight]);
  
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
        width: '100%'
      }}
      className={`scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 ${className}`}
    >
      <div 
        style={{ 
          height: paddingTop + paddingBottom + visibleItems.length * itemHeight,
          position: 'relative'
        }}
      >
        {visibleItems.map((item, index) => (
          <div
            key={keyExtractor(item)}
            style={{
              position: 'absolute',
              top: paddingTop + index * itemHeight,
              left: 0,
              right: 0
            }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualList;