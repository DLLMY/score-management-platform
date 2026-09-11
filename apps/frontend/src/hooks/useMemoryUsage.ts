import { useState, useEffect } from 'react';

/**
 * useMemoryUsage - 浏览器 JS 堆内存使用 Hook（DevTools 专用）
 *
 * 仅监控浏览器内存使用情况；enabled=false（如生产/DevTools 关闭）时不注册定时器，零开销。
 * 说明：DevTools 组件在 config.devTools.enabled 门控之前即调用本 hook（hooks 规则），
 *       因此必须由调用方把 enabled 传进来，避免禁用时每秒 setState 空转（曾致
 *       "setInterval handler took 99ms" Violation）。
 */
export const useMemoryUsage = (enabled = true) => {
  const [memoryUsage, setMemoryUsage] = useState({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
  });

  interface PerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }

  useEffect(() => {
    if (!enabled) return;
    const updateMemoryUsage = () => {
      if (performance && 'memory' in performance) {
        const memory = performance.memory as PerformanceMemory;
        setMemoryUsage({
          usedJSHeapSize: memory.usedJSHeapSize || 0,
          totalJSHeapSize: memory.totalJSHeapSize || 0,
          jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
        });
      }
    };

    updateMemoryUsage();
    // 2s 一次：兼顾实时性，避免每秒 setState 触发面板重渲染造成长任务
    const interval = setInterval(updateMemoryUsage, 2000);

    return () => clearInterval(interval);
  }, [enabled]);

  return memoryUsage;
};
