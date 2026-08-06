/**
 * 移动端专用组件
 * 针对移动设备优化的UI组件
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { Menu, X, ChevronDown, Search, Bell, User, Settings, LucideIcon } from 'lucide-react';

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: MenuItem[];
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: MenuItem[];
  currentPath: string;
}

interface MobileHeaderProps {
  title: string;
  onMenuClick: () => void;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  notificationCount?: number;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface MobileBottomNavProps {
  items: NavItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

interface MobileButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

interface MobileInputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface MobileSelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface ModalAction {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'default';
  preventClose?: boolean;
}

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ModalAction[];
}

interface MobileListItemProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
  onClick?: () => void;
  showArrow?: boolean;
}

interface ActionOption {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  primary?: boolean;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  options: ActionOption[];
}

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface MobileEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

interface MobileTagProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

interface MobileScoreBadgeProps {
  score: number;
  className?: string;
}

/**
 * 移动端侧边栏组件
 */
export const MobileSidebar: React.FC<MobileSidebarProps> = ({ isOpen, onClose, items, currentPath }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleItem = (item: MenuItem): void => {
    if (item.children) {
      setExpandedItems(prev =>
        prev.includes(item.path)
          ? prev.filter(p => p !== item.path)
          : [...prev, item.path]
      );
    }
  };

  const renderMenuItems = (items: MenuItem[]): ReactNode => {
    return items.map(item => {
      const isActive = currentPath === item.path;
      const isExpanded = expandedItems.includes(item.path);

      return (
        <div key={item.path}>
          <button
            onClick={() => {
              toggleItem(item);
              if (!item.children) {
                onClose();
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <item.icon size={20} />
            <span className="flex-1 font-medium text-sm">{item.label}</span>
            {item.children && (
              <ChevronDown
                size={16}
                className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            )}
          </button>
          {item.children && isExpanded && (
            <div className="ml-8 border-l border-gray-100">
              {renderMenuItems(item.children)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Menu size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-800">积分管理</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 菜单列表 */}
        <nav className="py-2 overflow-y-auto h-[calc(100%-80px)]">
          {renderMenuItems(items)}
        </nav>

        {/* 用户信息 */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={20} className="text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">管理员</p>
              <p className="text-xs text-gray-500">admin@example.com</p>
            </div>
            <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <Settings size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * 移动端头部组件
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({ title, onMenuClick, showSearch, onSearch, notificationCount }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  useEffect(() => {
    if (isSearching && searchQuery.trim()) {
      const debounce = setTimeout(() => {
        onSearch?.(searchQuery);
      }, 300);
      return () => clearTimeout(debounce);
    }
    return undefined;
  }, [searchQuery, isSearching, onSearch]);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={22} className="text-gray-600" />
        </button>

        {isSearching ? (
          <div className="flex-1 flex items-center gap-2 mx-2">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="flex-1 text-sm bg-gray-50 px-3 py-2 rounded-lg outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        ) : (
          <h1 className="flex-1 text-center font-semibold text-gray-800 text-sm">
            {title}
          </h1>
        )}

        <div className="flex items-center gap-1">
          {showSearch && !isSearching && (
            <button
              onClick={() => setIsSearching(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Search size={22} className="text-gray-600" />
            </button>
          )}
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell size={22} className="text-gray-600" />
            {notificationCount && notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

/**
 * 移动端底部导航组件
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items, currentPath, onNavigate }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {items.map(item => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? 'text-blue-500' : 'text-gray-400'
              }`}
            >
              <item.icon size={22} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * 移动端卡片组件
 */
export const MobileCard: React.FC<MobileCardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * 移动端按钮组件
 */
export const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
}) => {
  const variants: Record<string, string> = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

/**
 * 移动端输入框组件
 */
export const MobileInput: React.FC<MobileInputProps> = ({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-colors ${
          error ? 'border-red-300 focus:border-red-400' : 'focus:border-blue-400'
        }`}
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

/**
 * 移动端选择框组件
 */
export const MobileSelect: React.FC<MobileSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none transition-colors focus:border-blue-400 appearance-none"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
    </div>
  );
};

/**
 * 移动端模态框组件
 */
export const MobileModal: React.FC<MobileModalProps> = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 bottom-4 bg-white rounded-2xl shadow-xl z-50 overflow-hidden animate-slide-up">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
          {children}
        </div>

        {/* 操作按钮 */}
        {actions && (
          <div className="flex gap-2 px-4 py-4 border-t border-gray-100">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick?.();
                  if (!action.preventClose) onClose();
                }}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  action.variant === 'primary'
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : action.variant === 'danger'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

/**
 * 移动端列表项组件
 */
export const MobileListItem: React.FC<MobileListItemProps> = ({
  icon: Icon,
  title,
  subtitle,
  rightContent,
  onClick,
  showArrow = true,
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {Icon && (
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-gray-600" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightContent}
        {showArrow && (
          <ChevronDown size={18} className="text-gray-400 rotate-[-90deg]" />
        )}
      </div>
    </button>
  );
};

/**
 * 移动端加载状态组件
 */
interface MobileLoadingProps {
  text?: string;
}

export const MobileLoading: React.FC<MobileLoadingProps> = ({ text = '加载中...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-sm text-gray-500">{text}</span>
    </div>
  );
};

/**
 * 移动端空状态组件
 */
export const MobileEmptyState: React.FC<MobileEmptyStateProps> = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon size={32} className="text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 text-center mb-4">{description}</p>
      {action && (
        <MobileButton onClick={action.onClick}>{action.label}</MobileButton>
      )}
    </div>
  );
};

/**
 * 移动端操作菜单组件
 */
export const MobileActionSheet: React.FC<MobileActionSheetProps> = ({ isOpen, onClose, title, options }) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 bottom-4 bg-white rounded-2xl shadow-xl z-50 overflow-hidden">
        {title && (
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-500 text-center">{title}</p>
          </div>
        )}
        <div className="py-2">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                option.onClick?.();
                onClose();
              }}
              className={`w-full px-4 py-3 text-left transition-colors ${
                option.danger
                  ? 'text-red-500'
                  : option.primary
                  ? 'text-blue-500 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * 移动端标签组件
 */
export const MobileTag: React.FC<MobileTagProps> = ({ children, variant = 'default', className = '' }) => {
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-600',
    primary: 'bg-blue-100 text-blue-600',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger: 'bg-red-100 text-red-600',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

/**
 * 移动端评分组件
 */
export const MobileScoreBadge: React.FC<MobileScoreBadgeProps> = ({ score, className = '' }) => {
  let variant = 'default';
  if (score >= 500) variant = 'success';
  else if (score >= 300) variant = 'primary';
  else if (score >= 100) variant = 'warning';
  else variant = 'danger';

  const variantStyles: Record<string, string> = {
    success: 'bg-green-100 text-green-600',
    primary: 'bg-blue-100 text-blue-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger: 'bg-red-100 text-red-600',
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${variantStyles[variant]} ${className}`}>
      <span>{score}</span>
      <span className="text-[10px]">积分</span>
    </div>
  );
};

/**
 * 移动端安全区域组件
 */
interface SafeAreaViewProps {
  children: ReactNode;
}

export const SafeAreaView: React.FC<SafeAreaViewProps> = ({ children }) => {
  return (
    <div className="safe-area-inset-top safe-area-inset-bottom">
      {children}
    </div>
  );
};