import { useState, useEffect, useRef } from 'react';

function AnimatedList({ items, renderItem, keyExtractor, onItemAppear }) {
  const [visibleItems, setVisibleItems] = useState([]);
  const previousKeys = useRef(new Set());

  useEffect(() => {
    const newKeys = new Set(items.map(keyExtractor));
    const addedKeys = [];
    const removedKeys = [];
    
    newKeys.forEach(key => {
      if (!previousKeys.current.has(key)) {
        addedKeys.push(key);
      }
    });
    
    previousKeys.current.forEach(key => {
      if (!newKeys.has(key)) {
        removedKeys.push(key);
      }
    });
    
    previousKeys.current = newKeys;
    
    setVisibleItems(items.map(item => ({
      ...item,
      _animationKey: keyExtractor(item),
      _isNew: addedKeys.includes(keyExtractor(item)),
      _isLeaving: removedKeys.includes(keyExtractor(item))
    })));
    
    if (onItemAppear && addedKeys.length > 0) {
      setTimeout(() => {
        addedKeys.forEach(key => onItemAppear(key));
      }, 100);
    }
  }, [items, keyExtractor, onItemAppear]);

  return (
    <div className="space-y-1">
      {visibleItems.map((item, index) => (
        <div
          key={item._animationKey}
          className={`${
            item._isNew ? 'animate-slide-up' : 
            item._isLeaving ? 'animate-slide-down opacity-0' : 
            ''
          }`}
          style={{ animationDelay: item._isNew ? `${index * 50}ms` : '0ms' }}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

export default AnimatedList;
