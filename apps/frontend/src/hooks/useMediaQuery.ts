import { useState, useEffect } from 'react';

/**
 * 响应式媒体查询 Hook（SSR 安全）。
 *
 * 与 utils/mobileUtils.ts 中一次性读取 window.innerWidth 的 getDeviceType /
 * getScreenSize 不同，本 Hook 监听 matchMedia 的 change 事件，在视口跨越断点
 * 时自动触发组件重渲染，适合需要在 JS 层做条件渲染 / 条件逻辑的场景。
 *
 * @param query 标准 CSS 媒体查询字符串，例如 '(max-width: 767px)'
 * @returns 当前视口是否匹配该查询
 */
export function useMediaQuery(query: string): boolean {
  const getMatch = (): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia(query);

    const handler = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // 每次 query 变化或挂载时，先与当前真实状态对齐，避免首帧/SSR 不一致
    setMatches(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }

    // 旧浏览器兜底
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}

export default useMediaQuery;
