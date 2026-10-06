/**
 * 布局组件
 * 提供页面布局相关的组件，如页头、侧边栏、页面过渡动画等
 */
export { default as Header } from './Header';
export { default as Sidebar } from './Sidebar';
export { default as PageTransition } from './PageTransition';
export { default as KeyboardShortcutHelp } from './KeyboardShortcutHelp';
// 侧边栏导航静态配置与类型（供测试/其它布局组件复用）
export { MENU_GROUPS, type MenuGroup, type MenuItemData } from './menuConfig';
