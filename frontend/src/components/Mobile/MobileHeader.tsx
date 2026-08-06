import { useState, FormEvent, ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, User, X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useDeviceDetection';

interface MobileHeaderProps {
  onMenuToggle: () => void;
  notificationCount?: number;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
}

/**
 * 移动端头部组件
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({ onMenuToggle, notificationCount = 0 }) => {
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();

  // 获取页面标题
  const getPageTitle = (): string => {
    const pathMap: Record<string, string> = {
      '/dashboard': '数据仪表盘',
      '/users': '用户管理',
      '/devices': '设备管理',
      '/records': '积分记录',
      '/rules': '积分规则',
      '/analysis': '数据分析',
      '/notifications': '通知中心',
      '/settings': '系统设置',
      
      '/diagnostics': '系统诊断',
    };
    return pathMap[location.pathname] || '积分管理系统';
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/users?search=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value);
  };

  return (
    <header className="mobile-header bg-white dark:bg-slate-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        {/* 左侧：菜单按钮和标题 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="打开菜单"
          >
            <Menu size={24} className="text-gray-700 dark:text-gray-200" />
          </button>
          
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">
            {getPageTitle()}
          </h1>
        </div>

        {/* 右侧：搜索和通知 */}
        <div className="flex items-center gap-2">
          {/* 搜索按钮 */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="搜索"
          >
            <Search size={20} className="text-gray-700 dark:text-gray-200" />
          </button>

          {/* 通知按钮 */}
          <button
            onClick={() => navigate('/notifications')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors relative"
            aria-label="通知"
          >
            <Bell size={20} className="text-gray-700 dark:text-gray-200" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* 用户菜单 */}
          <button
            onClick={() => navigate('/profile')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="用户菜单"
          >
            <User size={20} className="text-gray-700 dark:text-gray-200" />
          </button>
        </div>
      </div>

      {/* 搜索栏（展开状态） */}
      {searchOpen && (
        <div className="absolute inset-x-0 top-0 bg-white dark:bg-slate-800 shadow-lg z-50 p-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="搜索用户、卡号..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <X size={20} className="text-gray-500" />
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              搜索
            </button>
          </form>
        </div>
      )}
    </header>
  );
};

/**
 * 移动端底部导航组件
 */
interface MobileBottomNavProps {
  currentPath: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPath }) => {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  const navItems: NavItem[] = [
    { path: '/dashboard', label: '首页', icon: '🏠' },
    { path: '/users', label: '用户', icon: '👥' },
    { path: '/devices', label: '设备', icon: '📱' },
    { path: '/records', label: '记录', icon: '📋' },
    { path: '/settings', label: '我的', icon: '⚙️' },
  ];

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 shadow-lg border-t border-gray-200 dark:border-slate-700 z-40">
      <div className="flex justify-around items-center">
        {navItems.map((item: NavItem) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center py-2 px-4 min-w-[64px] transition-colors ${
              currentPath === item.path
                ? 'text-blue-500'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

/**
 * 移动端快速操作按钮
 */
interface MobileQuickActionsProps {
  onAction: (actionId: string) => void;
}

export const MobileQuickActions: React.FC<MobileQuickActionsProps> = ({ onAction }) => {
  const { isMobile } = useIsMobile();

  if (!isMobile) return null;

  const actions: QuickAction[] = [
    { id: 'add-user', label: '添加用户', icon: '👤+' },
    { id: 'add-score', label: '添加积分', icon: '➕' },
    { id: 'control-device', label: '设备控制', icon: '🔓' },
  ];

  return (
    <div className="mobile-quick-actions fixed right-4 bottom-20 z-30">
      <div className="flex flex-col gap-2">
        {actions.map((action: QuickAction) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className="w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-lg"
            title={action.label}
          >
            {action.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MobileHeader;