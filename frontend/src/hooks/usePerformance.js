import { useEffect, useRef, useState, useCallback } from 'react';

const isDev = process.env.REACT_APP_ENABLE_DEV_TOOLS === 'true';

export const usePerformance = (name) => {
  const startRef = useRef(null);
  const endRef = useRef(null);
  const [duration, setDuration] = useState(null);

  const start = useCallback(() => {
    if (!isDev) return;
    startRef.current = performance.now();
  }, [name]);

  const end = useCallback(() => {
    if (!isDev || !startRef.current) return;
    endRef.current = performance.now();
    const time = endRef.current - startRef.current;
    setDuration(time);
    if (time > 100) {
    }
    return time;
  }, [name]);

  return { start, end, duration };
};

export const useRenderCount = (name) => {
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current++;
  });

  return countRef.current;
};

export const useMemoryUsage = () => {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!isDev || !performance.memory) return;

    const update = () => {
      const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
      setUsage({
        used: (usedJSHeapSize / 1024 / 1024).toFixed(2),
        total: (totalJSHeapSize / 1024 / 1024).toFixed(2),
        percentage: ((usedJSHeapSize / totalJSHeapSize) * 100).toFixed(1),
      });
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  return usage;
};

export const useNavigationPerf = () => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!isDev) return;

    const measure = () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        const ttfb = navigation.responseStart - navigation.requestStart;
        const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.startTime;
        const loadTime = navigation.loadEventEnd - navigation.startTime;

        setMetrics({ ttfb, domContentLoaded, loadTime });
      }
    };

    window.addEventListener('load', measure);
    return () => window.removeEventListener('load', measure);
  }, []);

  return metrics;
};
