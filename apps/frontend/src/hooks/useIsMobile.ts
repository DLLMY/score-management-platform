import { useMediaQuery } from './useMediaQuery';

/**
 * 是否处于移动端视口（<768px）。
 *
 * 断点刻意与 components/layout/Sidebar.tsx 的抽屉化断点（<768px 折叠为抽屉）
 * 保持一致，保证布局层与逻辑层的「移动端」判断同源。
 *
 * 纯布局自适应优先用 Tailwind 断点类（如 md: / lg:）；本 Hook 用于必须在 JS 层
 * 做条件渲染或条件分支的场景（例如移动端隐藏某块 DOM、切换交互形态）。
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export default useIsMobile;
