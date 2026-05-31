import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Tags,
  BarChart3,
  GraduationCap,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  ChevronDown,
  Trophy,
  Wifi,
  Clock,
  Box,
  Bell,
  ClipboardCheck,
  Home,
  Shield,
  UserCheck,
  FileKey,
  Activity,
  Sliders,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Sparkles,
  Zap,
  History,
  Command,
  Upload,
} from 'lucide-react';

function getCurrentRole() {
  const admin = localStorage.getItem('admin');
  if (!admin) return null;
  try {
    return JSON.parse(admin).role;
  } catch {
    return null;
  }
}

const MenuItem = memo(({ item, isActive, depth = 0, index = 0, isCollapsed = false }) => {
  const Icon = item.icon;

  return (
    <li
      key={item.path}
      className={`${isCollapsed ? 'ml-0' : `ml-${depth * 2}`} animate-slide-right`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Link
        to={item.path}
        className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-1 py-2' : 'gap-2.5 pl-6 pr-3 py-2'} rounded-xl transition-all duration-250 group ${
          isActive
            ? isCollapsed
              ? 'bg-primary-500/15 dark:bg-primary-500/20'
              : 'bg-primary-50/80 dark:bg-primary-500/15 text-gray-800 dark:text-slate-200'
            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-slate-300'
        }`}
      >
        <div
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full transition-all duration-250 ${
            isActive && !isCollapsed ? 'bg-primary-500 opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={`relative flex items-center justify-center transition-all duration-250 ${
            isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-md'
          } ${
            isActive
              ? isCollapsed
                ? 'bg-gradient-to-br from-primary-500/80 to-accent-500/80 shadow-md shadow-primary-500/25'
                : 'bg-primary-100/80 dark:bg-primary-500/20'
              : isCollapsed
                ? 'bg-gray-100/60 dark:bg-slate-700/50 group-hover:bg-gray-200/60 dark:group-hover:bg-slate-600/50'
                : 'bg-gray-100/40 dark:bg-slate-700/40 group-hover:bg-gray-200/40 dark:group-hover:bg-slate-600/40'
          }`}
        >
          <Icon
            className={`transition-all duration-250 ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${
              isActive
                ? 'text-white'
                : 'text-gray-500 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-slate-300'
            }`}
          />
        </div>

        <span
          className={`relative font-medium flex-1 text-left text-sm transition-all duration-250 ${isCollapsed ? 'hidden' : ''}`}
        >
          {item.label}
        </span>

        {isActive && !isCollapsed && (
          <div className='relative w-5 h-5 flex items-center justify-center rounded-md bg-primary-100/80 dark:bg-primary-500/20'>
            <ChevronRightIcon className='w-3.5 h-3.5 text-primary-600' />
          </div>
        )}
      </Link>
    </li>
  );
});

const GroupHeader = memo(({ group, hasActive, isExpanded, onToggle, isCollapsed }) => {
  const GroupIcon = group.icon;

  return (
    <button
      onClick={onToggle}
      className={`relative w-full flex items-center justify-center ${isCollapsed ? 'px-1 py-2.5' : 'gap-3 px-3 py-3'} rounded-2xl transition-all duration-300 group overflow-hidden ${
        hasActive || isExpanded
          ? 'text-gray-800 dark:text-slate-200'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
      }`}
    >
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
          hasActive
            ? isCollapsed
              ? 'bg-gradient-to-br from-primary-500/20 to-accent-500/10'
              : 'bg-gradient-to-r from-primary-500/10 via-blue-500/5 to-transparent'
            : isExpanded
              ? 'bg-gray-100/60 dark:bg-slate-700/50'
              : 'bg-gray-50/50 dark:bg-slate-800/50 group-hover:bg-gray-100/60 dark:group-hover:bg-slate-700/50'
        }`}
      />

      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full transition-all duration-300 z-10 ${
          hasActive && !isCollapsed
            ? 'bg-gradient-to-b from-primary-500 to-accent-500 opacity-100'
            : 'opacity-0'
        }`}
      />

      <div
        className={`relative flex items-center justify-center transition-all duration-300 z-10 ${
          isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-9 h-9 rounded-xl'
        } ${
          hasActive
            ? isCollapsed
              ? 'bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/35 scale-110'
              : 'bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/30 scale-110'
            : isCollapsed
              ? 'bg-gray-100/80 dark:bg-slate-700/60 group-hover:bg-gray-200/80 dark:group-hover:bg-slate-600/60 group-hover:scale-110'
              : 'bg-gray-100/70 dark:bg-slate-700/50 group-hover:bg-gray-200/70 dark:group-hover:bg-slate-600/50 group-hover:scale-110'
        }`}
      >
        <GroupIcon
          className={`transition-all duration-300 ${isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} ${hasActive ? 'text-white' : 'text-gray-600 dark:text-slate-300'}`}
        />
        {hasActive && <div className='absolute inset-0 bg-white/20 rounded-xl animate-pulse' />}
      </div>

      <span
        className={`relative font-semibold flex-1 text-left text-sm z-10 transition-all duration-300 tracking-wide ${isCollapsed ? 'hidden' : ''}`}
      >
        {group.label}
      </span>

      <div
        className={`relative w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-300 z-10 ${isCollapsed ? 'hidden' : ''} ${
          hasActive
            ? 'bg-primary-100/80 dark:bg-primary-500/20 text-primary-600'
            : 'bg-gray-100/50 dark:bg-slate-700/50 group-hover:bg-gray-200/50 dark:group-hover:bg-slate-600/50 text-gray-500 dark:text-slate-400'
        }`}
      >
        {isExpanded ? (
          <ChevronDown className='w-4.5 h-4.5 transition-transform duration-300' />
        ) : (
          <ChevronRight className='w-4.5 h-4.5 transition-transform duration-300' />
        )}
      </div>
    </button>
  );
});

function Sidebar() {
  const location = useLocation();
  const role = useMemo(() => getCurrentRole(), []);
  const isAdmin = useMemo(() => role === 'admin', [role]);
  const [expandedGroups, setExpandedGroups] = useState({
    main: true,
    scoreRules: false,
    systemMonitor: false,
    notifications: false,
    systemAdmin: false,
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const [recentVisits, setRecentVisits] = useState(() => {
    const saved = localStorage.getItem('recentVisits');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      } else if (!isAnimating) {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAnimating]);

  useEffect(() => {
    const allItems = menuGroups
      .flatMap((g) => g.items)
      .concat([{ path: '/help', label: '帮助中心', icon: HelpCircle }]);
    const currentItem = allItems.find(
      (item) =>
        item.path === location.pathname || (location.pathname === '/' && item.path === '/dashboard')
    );

    if (currentItem) {
      setRecentVisits((prev) => {
        const filtered = prev.filter((item) => item.path !== currentItem.path);
        const updated = [{ path: currentItem.path, label: currentItem.label }, ...filtered].slice(
          0,
          5
        );
        localStorage.setItem('recentVisits', JSON.stringify(updated));
        return updated;
      });
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        window.location.href = '/dashboard';
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        window.location.href = '/users';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleGroup = useCallback((groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  }, []);

  const clearRecentVisits = () => {
    setRecentVisits([]);
    localStorage.removeItem('recentVisits');
  };

  const isItemActive = useCallback(
    (path) => {
      return location.pathname === path || (path === '/dashboard' && location.pathname === '/');
    },
    [location.pathname]
  );

  const hasActiveItem = useCallback(
    (items) => {
      return items.some((item) => isItemActive(item.path));
    },
    [isItemActive]
  );

  const menuGroups = useMemo(
    () => [
      {
        id: 'main',
        label: '首页',
        icon: Home,
        items: [
          { path: '/dashboard', label: '数据概览', icon: Activity },
          { path: '/users', label: '学生管理', icon: Users },
          { path: '/analysis', label: '数据分析', icon: BarChart3 },
          { path: '/operation-logs', label: '操作日志', icon: History },
        ],
      },
      {
        id: 'scoreRules',
        label: '积分规则',
        icon: BookOpen,
        items: [
          { path: '/rules', label: '积分规则', icon: FileKey },
          { path: '/rank-rules', label: '排名规则', icon: Trophy },
          { path: '/categories', label: '分类管理', icon: Tags },
          { path: '/time-rules', label: '时间规则', icon: Clock },
        ],
      },
      {
        id: 'systemMonitor',
        label: '设备与监控',
        icon: Box,
        items: [
          { path: '/devices', label: '设备管理', icon: Box },
          { path: '/firmware', label: '固件管理', icon: Upload },
          { path: '/mqtt', label: 'MQTT调试', icon: Wifi },
        ],
      },
      {
        id: 'notifications',
        label: '通知与审批',
        icon: Bell,
        items: [
          { path: '/notifications', label: '通知管理', icon: Bell },
          { path: '/approvals', label: '审批管理', icon: ClipboardCheck },
        ],
      },
      {
        id: 'systemAdmin',
        label: '系统管理',
        icon: Settings,
        requiresAdmin: true,
        items: [
          { path: '/settings', label: '系统设置', icon: Sliders },
          { path: '/user-management', label: '用户管理', icon: UserCheck },
          { path: '/permission', label: '权限管理', icon: Shield },
        ],
      },
    ],
    []
  );

  const filteredMenuGroups = useMemo(() => {
    return menuGroups.filter((group) => !group.requiresAdmin || isAdmin);
  }, [menuGroups, isAdmin]);

  return (
    <aside
      className={`
      relative bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200
      flex flex-col shadow-lg border-r border-gray-200/50 dark:border-slate-700/50 transition-all duration-500 ease-out
      ${isCollapsed ? 'w-16' : 'w-64'}
      ${isAnimating ? 'opacity-0 translate-x-[-20px]' : 'opacity-100 translate-x-0'}
    `}
    >
      <div
        className={`p-3 border-b border-gray-200/50 dark:border-slate-700/50 relative z-10 ${isCollapsed ? 'bg-gradient-to-b from-primary-50/50 to-white dark:from-primary-500/10 dark:to-slate-800' : 'bg-gray-50/50 dark:bg-slate-700/30'} ${isCollapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between'}`}
      >
        <div
          className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}
        >
          <div className='relative w-10 h-10 rounded-xl overflow-hidden group'>
            <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500' />
            <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500 opacity-50 group-hover:opacity-100 transition-opacity duration-300 blur-xl' />
            <div className='relative w-full h-full flex items-center justify-center'>
              <GraduationCap className='w-6 h-6 text-white' />
            </div>
            <Sparkles className='absolute -top-1 -right-1 w-4 h-4 text-yellow-400 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-125' />
          </div>
          <div>
            <h1 className='text-base font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 dark:from-slate-200 dark:via-slate-300 dark:to-slate-400 bg-clip-text text-transparent'>
              积分管理平台
            </h1>
            <p className='text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1'>
              <Zap className='w-2 h-2 text-yellow-500' />
              Student Score System
            </p>
          </div>
        </div>

        <div
          className={`relative w-12 h-12 rounded-2xl overflow-hidden transition-all duration-300 ${!isCollapsed ? 'hidden' : 'flex items-center justify-center shadow-lg shadow-primary-500/20'}`}
        >
          <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500' />
          <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500 opacity-30 blur-xl' />
          <GraduationCap className='relative w-6 h-6 text-white' />
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${isCollapsed ? 'bg-white/80 dark:bg-slate-700/80 shadow-md shadow-black/5 text-gray-600 dark:text-slate-300 hover:shadow-lg' : 'bg-gray-200/50 dark:bg-slate-700/50 hover:bg-gray-300/50 dark:hover:bg-slate-600/50 text-gray-600 dark:text-slate-300'}`}
          title={`${isCollapsed ? '展开侧边栏' : '收起侧边栏'} (Ctrl+B)`}
        >
          {isCollapsed ? (
            <ChevronRightIcon className='w-5 h-5' />
          ) : (
            <ChevronLeft className='w-5 h-5' />
          )}
        </button>
      </div>

      <nav className='flex-1 px-3 py-3 relative z-10 overflow-y-auto overflow-x-hidden scrollbar-thin'>
        <ul className='space-y-1'>
          {recentVisits.length > 0 && !isCollapsed && (
            <li className='relative mb-2 animate-fade-in'>
              <div className='flex items-center justify-between px-3 py-2 mb-1'>
                <div className='flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider'>
                  <History className='w-3.5 h-3.5' />
                  最近访问
                </div>
                <button
                  onClick={clearRecentVisits}
                  className='text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors'
                >
                  清除
                </button>
              </div>
              <ul className='space-y-1'>
                {recentVisits.map((item, index) => {
                  const allItems = menuGroups
                    .flatMap((g) => g.items)
                    .concat([{ path: '/help', label: '帮助中心', icon: HelpCircle }]);
                  const matchedItem = allItems.find((i) => i.path === item.path);
                  const Icon = matchedItem?.icon || HelpCircle;
                  const isActive = isItemActive(item.path);
                  return (
                    <li
                      key={item.path}
                      style={{ animationDelay: `${index * 30}ms` }}
                      className='animate-slide-right'
                    >
                      <Link
                        to={item.path}
                        onMouseEnter={() => setHoveredItem(item.path)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`relative w-full flex items-center gap-2 pl-3 pr-3 py-2 rounded-xl transition-all duration-200 group ${
                          isActive
                            ? 'bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-500/10 dark:to-accent-500/5 text-gray-800 dark:text-slate-200'
                            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100/50 dark:hover:bg-slate-700/40 hover:text-gray-700 dark:hover:text-slate-300'
                        }`}
                      >
                        <div
                          className={`relative flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-sm'
                              : 'bg-gray-100/50 dark:bg-slate-700/40 text-gray-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className='w-3.5 h-3.5' />
                        </div>
                        <span className='relative font-medium text-sm flex-1 text-left'>
                          {item.label}
                        </span>
                        {isActive && (
                          <div className='absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-gradient-to-b from-primary-500 to-accent-500' />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className='h-px bg-gradient-to-r from-transparent via-gray-200/60 dark:via-slate-700/60 to-transparent my-2' />
            </li>
          )}

          {filteredMenuGroups.map((group, groupIndex) => {
            const hasActive = hasActiveItem(group.items);
            const isExpanded = expandedGroups[group.id];

            return (
              <li
                key={group.id}
                className='relative animate-fade-in'
                style={{ animationDelay: `${groupIndex * 80}ms` }}
              >
                <GroupHeader
                  group={group}
                  hasActive={hasActive}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(group.id)}
                  isCollapsed={isCollapsed}
                />

                <ul
                  className={`overflow-hidden transition-all duration-350 ease-in-out ${
                    isExpanded && !isCollapsed
                      ? 'max-h-[500px] opacity-100 mt-1'
                      : 'max-h-0 opacity-0 mt-0'
                  }`}
                >
                  {group.items.map((item, index) => (
                    <div
                      key={item.path}
                      onMouseEnter={() => setHoveredItem(item.path)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <MenuItem
                        item={item}
                        isActive={isItemActive(item.path)}
                        index={index}
                        isCollapsed={isCollapsed}
                      />
                    </div>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className='px-3 py-3 border-t border-gray-200/50 dark:border-slate-700/50 space-y-1 relative z-10 bg-gray-50/30 dark:bg-slate-700/30'>
        <Link
          to='/help'
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/60 hover:text-gray-800 dark:hover:text-slate-200 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
          onMouseEnter={() => setHoveredItem('/help')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className='relative w-8 h-8 rounded-lg bg-gray-100/50 dark:bg-slate-700/50 flex items-center justify-center group-hover:bg-gray-200/50 dark:group-hover:bg-slate-600/50 transition-all duration-300 group-hover:scale-110'>
            <HelpCircle className='w-4.5 h-4.5' />
          </div>
          {!isCollapsed && <span className='font-medium text-sm'>帮助中心</span>}
        </Link>

        <button
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50/80 dark:hover:bg-red-500/10 hover:text-red-600 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
          onMouseEnter={() => setHoveredItem('logout')}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => {
            localStorage.removeItem('admin');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }}
        >
          <div className='relative w-8 h-8 rounded-lg bg-danger-500/20 flex items-center justify-center group-hover:bg-danger-500/30 transition-all duration-300 group-hover:scale-110'>
            <LogOut className='w-4.5 h-4.5' />
          </div>
          {!isCollapsed && <span className='font-medium text-sm'>退出登录</span>}
        </button>
      </div>

      {isCollapsed && hoveredItem && (
        <div className='fixed left-16 top-1/2 -translate-y-1/2 px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl shadow-elevated z-50 animate-bounce-in'>
          <div className='absolute inset-0 bg-gradient-to-r from-primary-500/5 to-accent-500/5 rounded-2xl' />
          <div className='relative flex items-center gap-2'>
            <span className='text-sm text-white whitespace-nowrap font-medium'>
              {menuGroups.flatMap((g) => g.items).find((i) => i.path === hoveredItem)?.label ||
              hoveredItem === '/help'
                ? '帮助中心'
                : hoveredItem === 'logout'
                  ? '退出登录'
                  : ''}
            </span>
            <div className='flex items-center gap-1 text-xs text-slate-400'>
              <Command className='w-3 h-3' />
              <span>点击</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
