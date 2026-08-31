/**
 * 组件统一导出入口
 * 组件已按功能分类到不同子目录：
 * - ui: 基础UI组件
 * - feedback: 反馈组件
 * - data-display: 数据展示组件
 * - layout: 布局组件
 * - special: 特殊组件
 * - charts: 图表组件
 * - Mobile: 移动端组件
 * - image: 图片优化组件
 * - lazy: 懒加载组件
 */

// UI基础组件
export { default as Badge } from './ui/Badge';
export { default as Button } from './ui/Button';
export { default as Card } from './ui/Card';
export { default as Input } from './ui/Input';
export { default as Modal } from './ui/Modal';
export { default as Select } from './ui/Select';
export { default as Switch } from './ui/Switch';
export { default as Textarea } from './ui/Textarea';
export { default as StatusTag, STATUS_TAG_CLASS, STATUS_TONE_MAP } from './ui/StatusTag';
export type { StatusTone } from './ui/StatusTag';
export { default as StatCard } from './ui/StatCard';
export { default as CurrentClassLabel } from './workbench/CurrentClassLabel';
export { default as StatusBadge } from './ui/StatusBadge';
export type { StatusBadgeEntry } from './ui/StatusBadge';
export { default as DateRangeField } from './ui/DateRangeField';
export {
  default as Skeleton,
  CardSkeleton,
  TableSkeleton,
  FormSkeleton,
  CategoryCardSkeleton,
  DashboardSkeleton,
} from './ui/Skeleton';
export { default as Pagination } from './ui/Pagination';
export { default as BatchActionBar } from './ui/BatchActionBar';
export { default as AdvancedSearch } from './ui/AdvancedSearch';
export { default as EmptyState } from './feedback/EmptyState';
export { default as DataTable } from './data-display/DataTable';
export type { ColumnType, DataTableProps, DataTableEmptyProps, SortOrder } from './data-display/DataTable';
export { ConfirmProvider, useConfirm } from './ui/ConfirmDialog';
export type { ConfirmOptions, ConfirmType } from './ui/ConfirmDialog';

// 反馈组件
export { default as LoadingSpinner } from './feedback/LoadingSpinner';
export { default as SearchEmptyState } from './feedback/EmptyState';
export { default as ErrorState } from './feedback/EmptyState';
export { default as Toast } from './feedback/Toast';
export { default as ToastContainer } from './feedback/ToastContainer';

// 数据展示组件
export { default as AnimatedList } from './data-display/AnimatedList';
export { default as AnimatedScore } from './data-display/AnimatedScore';
export { default as VirtualList } from './data-display/VirtualList';
export { default as SearchFilter } from './data-display/SearchFilter';
export { default as AdvancedSearchFilter } from './data-display/AdvancedSearchFilter';
export { default as UserTableRow } from './data-display/UserTableRow';
export { SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonList } from './data-display/Skeleton';
export type { SearchCondition, SavedSearch } from './data-display/AdvancedSearchFilter';

// 布局组件
export { Header, Sidebar, PageTransition, KeyboardShortcutHelp } from './layout';

// 特殊组件
export { default as ImportExportPanel } from './special/ImportExportPanel';
export {
  default as ErrorBoundary,
  ErrorBoundaryFallback,
  ErrorBoundaryWrapper,
} from './special/ErrorBoundary';
export { default as DevTools } from './special/DevTools';
export { default as ClassStatusBadge } from './special/ClassStatusBadge';
export type { ClassStatusBadgeProps } from './special/ClassStatusBadge';
export {
  GlobalLoading,
  GlobalErrorBoundary,
  NetworkStatusIndicator,
} from './special/GlobalStateComponents';

// 图片优化组件
export { OptimizedImage, LazyImage } from './image';

// 懒加载组件
export { createLazyComponent, ConditionalLazy, FeatureLazy } from './lazy';

// 预加载组件
export { default as PreloadProvider } from './PreloadProvider';

// 权限守卫组件
export { PermissionGuard, PermissionButton, PermissionView } from './PermissionGuard';

// 性能优化组件
export {
  deepMemo,
  shallowMemo,
  selectiveMemo,
  filterProps,
  RenderOnChange,
} from './MemoComponents';
