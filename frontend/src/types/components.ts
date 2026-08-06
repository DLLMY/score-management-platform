/**
 * 组件类型定义
 * 集中管理所有UI组件的Props类型
 */

import { LucideIcon } from 'lucide-react';
import { ReactNode, MouseEventHandler, SelectHTMLAttributes, TextareaHTMLAttributes, InputHTMLAttributes, ButtonHTMLAttributes } from 'react';

// ==================== 基础UI组件 ====================

// Button组件
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonRounded = 'none' | 'sm' | 'md' | 'lg' | 'full';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: ButtonRounded;
  isLoading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
}

// Input组件
export type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'time' | 'month' | 'week' | 'file' | 'color';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  type?: InputType;
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: boolean;
  errorMessage?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}

// Select组件
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
}

// Textarea组件
export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: boolean;
  errorMessage?: string;
  rows?: number;
}

// Modal组件
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: MouseEventHandler<HTMLButtonElement>;
  title: string;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
}

// Switch组件
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Badge组件
export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

// Card组件
export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

// LoadingSpinner组件
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  color?: string;
  fullScreen?: boolean;
}

// EmptyState组件
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Tooltip组件
export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// ==================== 业务组件 ====================

// MenuItem组件
export interface MenuItemData {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface MenuItemProps {
  item: MenuItemData;
  isActive: boolean;
  depth?: number;
  isCollapsed: boolean;
}

// MenuGroup组件
export interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: MenuItemData[];
  requiresAdmin?: boolean;
}

export interface GroupHeaderProps {
  group: MenuGroup;
  hasActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
}

// Pagination组件
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

// Table组件
export interface TableColumn<T = unknown> {
  key: string;
  title: string;
  render?: (value: unknown, record: T, index: number) => ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T = unknown> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
}

// SearchInput组件
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSearch?: (value: string) => void;
}

// FilterDropdown组件
export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDropdownProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

// ==================== 状态相关 ====================

// Toast通知
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// 确认对话框
export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

// ==================== 辅助类型 ====================

// 图标组件类型
export type IconComponent = React.ComponentType<{ className?: string; size?: number }>;

// 加载状态
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// 分页参数
export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== 工具类型 ====================

// 简化的API响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 简单的ID类型
export type ID = string | number;

// 可选的值
export type Maybe<T> = T | null | undefined;

// 颜色类型
export type Color = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'default';

// 尺寸类型
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// 变体类型
export type Variant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
