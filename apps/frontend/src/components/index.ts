/**
 * 组件统一导出入口（应用层唯一入口）
 *
 * 双层 barrel 结构：
 * - 本文件 = 应用层统一入口，消费者一律 `from '../components'`
 * - `./<子目录>/index` = 各功能目录的出口，仅由本文件聚合，不直接对外
 *
 * 覆盖子目录：ui / data-display / feedback / form / layout / image / lazy / special / workbench
 *
 * 例外：charts 依赖 recharts（体积大），若并入本 barrel 会把该重依赖
 *       带进每一个 components 消费者的模块图，故保持独立子入口：
 *       `import { ScoreChart } from '../components/charts'`。
 */

// ui：基础 UI 组件
export {
  AdvancedSearch,
  Badge,
  BatchActionBar,
  Button,
  Card,
  ConfirmProvider,
  DateRangeField,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  CardSkeleton,
  FormSkeleton,
  TableSkeleton,
  CategoryCardSkeleton,
  DashboardSkeleton,
  StatCard,
  StatusBadge,
  StatusTag,
  STATUS_TAG_CLASS,
  STATUS_TONE_MAP,
  Switch,
  Textarea,
  useConfirm,
} from './ui';
export type {
  AdvancedSearchProps,
  BatchAction,
  ConfirmOptions,
  ConfirmType,
  FilterField,
  StatusBadgeEntry,
  StatusTone,
} from './ui';

// data-display：数据展示组件
export {
  AdvancedSearchFilter,
  AnimatedList,
  AnimatedScore,
  DataTable,
  SearchFilter,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonList,
  SkeletonText,
  UserTableRow,
  VirtualList,
} from './data-display';
export type {
  ColumnType,
  DataTableEmptyProps,
  DataTableProps,
  FilterOption,
  SavedSearch,
  SearchCondition,
  SearchFilterProps,
  SelectFilterOption,
  SortOrder,
} from './data-display';

// feedback：反馈组件
export {
  EmptyState,
  ErrorState,
  LoadingSpinner,
  SearchEmptyState,
  Toast,
  ToastContainer,
} from './feedback';

// form：表单组件
export { ClassSelect, StudentSelect, SubjectSelect, ToggleSwitch } from './form';
export type { EntityOption } from './form';

// layout：布局组件
export { Header, KeyboardShortcutHelp, PageTransition, Sidebar } from './layout';

// image：图片优化组件
export { LazyImage, OptimizedImage } from './image';

// lazy：懒加载组件
export { ConditionalLazy, FeatureLazy, createLazyComponent } from './lazy';

// special：特殊组件
export {
  ClassStatusBadge,
  DevTools,
  ErrorBoundary,
  ErrorBoundaryFallback,
  ErrorBoundaryWrapper,
  GlobalErrorBoundary,
  GlobalLoading,
  ImportExportPanel,
  NetworkStatusIndicator,
} from './special';
export type { ClassStatusBadgeProps } from './special';

// workbench：班主任工作台组件
export { CurrentClassLabel, WorkbenchBreadcrumb } from './workbench';

// 权限守卫组件
export { PermissionButton, PermissionGuard, PermissionView } from './PermissionGuard';

// 预加载组件
export { default as PreloadProvider } from './PreloadProvider';

// 性能优化组件
export {
  deepMemo,
  filterProps,
  RenderOnChange,
  selectiveMemo,
  shallowMemo,
} from './MemoComponents';
