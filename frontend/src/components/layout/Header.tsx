import logger from '../../utils/logger';
import {
  Bell,
  BellRing,
  Search,
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  Info,
  ArrowRight,
  Sparkles,
  Hash,
  Clock,
  Filter,
  X,
  Command,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, useRef, MouseEventHandler, FocusEventHandler } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore, usePermissionStore } from '../../stores';
import api, { AdminNotification } from '../../services/api';


// 类型定义
interface Admin {
  id?: number;
  username?: string;
  real_name?: string;
  role?: string;
  [key: string]: unknown;
}

interface SearchResult {
  type: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  hotkey: string;
}

function Header() {
  // 使用Zustand替代ThemeContext
  const { theme, toggleTheme } = useThemeStore();
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showNotificationBadge, setShowNotificationBadge] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedAdmin = localStorage.getItem('admin');
    if (savedAdmin) {
      try {
        setAdmin(JSON.parse(savedAdmin));
      } catch {
        setAdmin(null);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const savedAdmin = localStorage.getItem('admin');
    if (!savedAdmin) return;
    try {
      const parsedAdmin = JSON.parse(savedAdmin);
      const result = await api.adminNotifications.getRecent({ admin_id: parsedAdmin.id, limit: 10 });
      setNotifications(result);
    } catch (error) {
      if ((error as { status?: number }).status !== 401) {
        // 轮询失败静默降级（保留旧列表，30s 后自动重试），不打扰用户；仅记录日志
        logger.error('Failed to fetch notifications:', error);
      }
    }
  }, []);

  useEffect(() => {
    const savedAdmin = localStorage.getItem('admin');
    if (!savedAdmin) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkRead = useCallback(async (id: number) => {
    try {
      await api.adminNotifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      // 标记已读失败：红点保持未读（真实状态），不伪装成功；记录日志供排查
      logger.error('Failed to mark notification as read:', error);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const savedAdmin = localStorage.getItem('admin');
      let adminId: number | undefined;
      if (savedAdmin) {
        const parsedAdmin = JSON.parse(savedAdmin);
        adminId = parsedAdmin.id;
      }
      await api.adminNotifications.markAllRead(adminId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  const formatTime = useCallback((dateString: string) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  }, []);

  useEffect(() => {
    if (searchValue.length > 0) {
      setSearchResults([
        {
          type: 'user',
          label: `${searchValue}`,
          sublabel: '搜索学生',
          icon: User,
          path: '/users',
          hotkey: 'U',
        },
        {
          type: 'rule',
          label: `${searchValue}`,
          sublabel: '搜索规则',
          icon: Settings,
          path: '/rules',
          hotkey: 'R',
        },
        {
          type: 'record',
          label: `${searchValue}`,
          sublabel: '搜索记录',
          icon: Clock,
          path: '/analysis',
          hotkey: 'A',
        },
        {
          type: 'device',
          label: `${searchValue}`,
          sublabel: '搜索设备',
          icon: Hash,
          path: '/devices',
          hotkey: 'D',
        },
      ]);
    } else {
      setSearchResults([
        {
          type: 'quick',
          label: '数据概览',
          sublabel: '查看仪表盘',
          icon: Sparkles,
          path: '/dashboard',
          hotkey: '1',
        },
        {
          type: 'quick',
          label: '学生管理',
          sublabel: '管理学生信息',
          icon: User,
          path: '/users',
          hotkey: '2',
        },
        {
          type: 'quick',
          label: '积分规则',
          sublabel: '配置积分规则',
          icon: Settings,
          path: '/rules',
          hotkey: '3',
        },
        {
          type: 'quick',
          label: '设备监控',
          sublabel: '查看设备状态',
          icon: Hash,
          path: '/devices',
          hotkey: '4',
        },
      ]);
    }
  }, [searchValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if (searchFocused && searchValue.length === 0) {
        const shortcuts: Record<string, string> = {
          1: '/dashboard',
          2: '/users',
          3: '/rules',
          4: '/devices',
          u: '/users',
          r: '/rules',
          a: '/analysis',
          d: '/devices',
        };

        const targetPath = shortcuts[e.key.toLowerCase()];
        if (targetPath) {
          navigate(targetPath);
          setSearchValue('');
          setSearchFocused(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchFocused, searchValue, navigate]);

  const handleLogout = useCallback<MouseEventHandler<HTMLButtonElement>>(() => {
    setShowUserMenu(false);
    localStorage.removeItem('admin');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  }, [navigate]);

  const isDark = theme === 'dark';

  const toggleNotifications = useCallback(() => {
    setShowNotifications((prev) => !prev);
    setShowUserMenu(false);
    if (!showNotificationBadge) {
      setTimeout(() => setShowNotificationBadge(true), 100);
    }
  }, [showNotificationBadge]);

  const toggleUserMenu = useCallback(() => {
    setShowUserMenu((prev) => !prev);
    setShowNotifications(false);
  }, []);

  const handleSearchFocus = useCallback<FocusEventHandler<HTMLInputElement>>(() => {
    setSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback<FocusEventHandler<HTMLInputElement>>(() => {
    setTimeout(() => setSearchFocused(false), 200);
  }, []);

  const closeMenus = useCallback(() => {
    setShowNotifications(false);
    setShowUserMenu(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-header-menu]')) {
        closeMenus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenus]);

  const unreadCount = useMemo<number>(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const { isAdmin: isSuperAdmin } = usePermissionStore();
  
  const roleLabel = useMemo<string>(() => {
    if (isSuperAdmin) return '超级管理员';
    if (admin?.role === 'admin') return '管理员';
    return '教师';
  }, [admin, isSuperAdmin]);

  const displayName = useMemo<string>(() => {
    return admin?.real_name || admin?.username || '管理员';
  }, [admin]);

  return (
    <header className='relative bg-gradient-to-r from-white/90 via-white/80 to-white/90 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-slate-800/90 backdrop-blur-xl border-b border-gray-100/80 dark:border-slate-700/60 px-4 md:px-6 py-3 shadow-sm shadow-black/5 dark:shadow-black/20 sticky top-0 z-30'>
      <div className='absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-accent-50/50 dark:from-primary-500/10 dark:to-accent-500/10 opacity-0 transition-opacity duration-300' />

      <div className='relative flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <button className='md:hidden p-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 group touch-active no-tap-highlight'>
            <svg
              className='w-6 h-6 text-gray-600 dark:text-slate-300 group-hover:text-gray-800 dark:group-hover:text-slate-100 transition-colors'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 6h16M4 12h16M4 18h16'
              />
            </svg>
          </button>

          <div
            className={`relative hidden md:block transition-all duration-500 ease-out ${searchFocused ? 'w-[450px]' : 'w-64'}`}
          >
            <div
              className={`absolute inset-0 rounded-2xl transition-all duration-500 ${searchFocused ? 'bg-gradient-to-r from-primary-50 via-blue-50 to-cyan-50 dark:from-primary-500/20 dark:via-blue-500/10 dark:to-cyan-500/10 shadow-xl shadow-primary-500/15 dark:shadow-primary-500/10 ring-2 ring-primary-200 dark:ring-primary-500/30' : 'bg-gray-50 dark:bg-slate-700/50'}`}
            />

            <div
              className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${searchFocused ? 'text-primary-500 scale-110' : 'text-gray-400 dark:text-slate-500'}`}
            >
              <Search
                className={`w-5 h-5 transition-all duration-300 ${searchFocused ? 'animate-bounce-once' : ''}`}
              />
            </div>

            <input
              ref={searchInputRef}
              type='text'
              value={searchValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
              placeholder='搜索学生、规则、设备... (Ctrl+K)'
              className='w-full pl-12 pr-10 py-3 bg-transparent border-2 border-transparent rounded-2xl text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-500/20 dark:focus:ring-primary-500/30 transition-all duration-300'
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />

            {searchValue.length === 0 && (
              <kbd className='absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-100 dark:bg-slate-600 rounded-lg text-xs text-gray-500 dark:text-slate-400 font-mono hover:bg-gray-200 dark:hover:bg-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-all duration-200 flex items-center gap-1'>
                <Command className='w-3 h-3' />
                <span>K</span>
              </kbd>
            )}

            {searchValue.length > 0 && (
              <button
                onClick={() => setSearchValue('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-danger-100 dark:hover:bg-danger-500/20 hover:text-danger-500 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95'
              >
                <X className='w-4 h-4 text-gray-500 dark:text-slate-400' />
              </button>
            )}

            {searchFocused && (
              <div className='absolute top-full left-0 right-0 mt-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50 animate-slide-up shadow-primary-500/5'>
                <div className='px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-primary-50 via-blue-50 to-cyan-50 dark:from-primary-500/10 dark:via-blue-500/5 dark:to-cyan-500/5'>
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-2'>
                      <Sparkles className='w-3.5 h-3.5 text-primary-500' />
                      快速搜索
                    </p>
                    <div className='flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500'>
                      <kbd className='px-1.5 py-0.5 bg-gray-200/80 dark:bg-slate-600 rounded text-gray-500 dark:text-slate-400'>
                        Esc
                      </kbd>
                      <span>关闭</span>
                    </div>
                  </div>
                </div>

                <div className='max-h-80 overflow-y-auto scrollbar-thin'>
                  {searchResults.map((result, index) => {
                    const Icon = result.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          navigate(result.path);
                          setSearchValue('');
                          setSearchFocused(false);
                        }}
                        className='w-full px-4 py-3 flex items-center gap-3 hover:bg-gradient-to-r hover:from-primary-50/70 hover:to-blue-50/70 dark:hover:from-primary-500/10 dark:hover:to-blue-500/10 transition-all duration-200 text-left group animate-fade-in'
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            searchFocused
                              ? 'bg-gradient-to-br from-primary-100 to-blue-100 dark:from-primary-500/20 dark:to-blue-500/15'
                              : 'bg-gray-100 dark:bg-slate-700'
                          } group-hover:scale-115 group-hover:shadow-lg group-hover:shadow-primary-500/20`}
                        >
                          <Icon className='w-5 h-5 text-primary-600' />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors truncate'>
                              {searchValue.length > 0 ? result.sublabel : result.label}
                            </span>
                            {searchValue.length > 0 && (
                              <span className='text-xs text-primary-600 dark:text-primary-400 font-medium bg-primary-50 dark:bg-primary-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0'>
                                {searchValue}
                              </span>
                            )}
                          </div>
                          <p className='text-xs text-gray-400 dark:text-slate-500'>
                            {searchValue.length > 0 ? '点击跳转搜索结果' : result.sublabel}
                          </p>
                        </div>
                        <div className='flex items-center gap-2'>
                          <kbd className='px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs text-gray-500 dark:text-slate-400 font-mono'>
                            {result.hotkey}
                          </kbd>
                          <ArrowRight className='w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-primary-500 group-hover:translate-x-1.5 group-hover:-translate-y-0.5 transition-all duration-200' />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className='px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30'>
                  <div className='flex items-center justify-between text-xs text-gray-400 dark:text-slate-500'>
                    <div className='flex items-center gap-3'>
                      <span className='flex items-center gap-1 text-gray-500 dark:text-slate-400'>
                        <kbd className='px-1.5 py-0.5 bg-gray-200/80 dark:bg-slate-600 rounded text-gray-500 dark:text-slate-400'>
                          Enter
                        </kbd>
                        <span>跳转</span>
                      </span>
                      <span className='flex items-center gap-1 text-gray-500 dark:text-slate-400'>
                        <kbd className='px-1.5 py-0.5 bg-gray-200/80 dark:bg-slate-600 rounded text-gray-500 dark:text-slate-400'>
                          Tab
                        </kbd>
                        <span>切换</span>
                      </span>
                      <span className='flex items-center gap-1 text-gray-500 dark:text-slate-400'>
                        <kbd className='px-1.5 py-0.5 bg-gray-200/80 dark:bg-slate-600 rounded text-gray-500 dark:text-slate-400'>
                          ↑↓
                        </kbd>
                        <span>导航</span>
                      </span>
                    </div>
                    <button className='flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors'>
                      <Filter className='w-3 h-3' />
                      高级搜索
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='flex items-center gap-1.5'>
          <button
            onClick={toggleTheme}
            className='relative p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 group dark:hover:bg-slate-700'
            title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {isDark ? (
              <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 group-hover:scale-110 group-active:scale-95 transition-transform'>
                <Sun className='w-4.5 h-4.5 text-white' />
                <div className='absolute inset-0 bg-gradient-to-br from-yellow-400 via-orange-500 to-amber-600 rounded-lg opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300' />
              </div>
            ) : (
              <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform'>
                <Moon className='w-4.5 h-4.5 text-gray-300' />
                <div className='absolute inset-0 bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 rounded-lg opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300' />
              </div>
            )}
          </button>

          <div className='relative' data-header-menu ref={notificationRef}>
            <button
              onClick={toggleNotifications}
              className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                showNotifications
                  ? 'bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-500/15 dark:to-blue-500/10 text-primary-600 dark:text-primary-400'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}
            >
              <div
                className={`relative transition-all duration-300 ${showNotifications ? 'scale-115' : 'group-hover:scale-110'}`}
              >
                <Bell className='w-5 h-5' />
                {showNotificationBadge && unreadCount > 0 && (
                  <span className='absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-danger-500 via-rose-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg animate-pulse'>
                    <span className='text-xs font-bold text-white'>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </span>
                )}
                {showNotificationBadge && unreadCount > 0 && (
                  <span className='absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-danger-500 via-rose-500 to-pink-600 rounded-full opacity-50 blur-sm animate-ping' />
                )}
              </div>
            </button>

            {showNotifications && (
              <div className='absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50 animate-slide-up'>
                <div className='px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-500/10 dark:via-purple-500/5 dark:to-pink-500/5'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <BellRing className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                      <h3 className='text-base font-semibold text-gray-800 dark:text-slate-200'>
                        通知中心
                      </h3>
                      {unreadCount > 0 && (
                        <span className='px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold rounded-full'>
                          {unreadCount}条新消息
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={handleMarkAllRead}
                        className='text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors'
                      >
                        全部已读
                      </button>
                      <button className='p-1.5 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors'>
                        <Settings className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                      </button>
                    </div>
                  </div>
                </div>

                <div className='max-h-[32rem] overflow-y-auto scrollbar-thin'>
                  {notifications.map((notification) => {
                    const typeColors = {
                      success: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border-l-4 border-green-500',
                      info: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border-l-4 border-blue-500',
                      warning: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-l-4 border-amber-500',
                      error: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-500/10 dark:to-rose-500/10 border-l-4 border-red-500',
                    };

                    const handleClick = () => {
                      if (!notification.is_read) {
                        handleMarkRead(notification.id);
                      }
                    };

                    return (
                      <div
                        key={notification.id}
                        onClick={handleClick}
                        className={`px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all duration-200 cursor-pointer border-b border-gray-50 dark:border-slate-700/50 ${typeColors[notification.type]} ${
                          !notification.is_read ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''
                        }`}
                      >
                        <div className='flex items-start gap-3'>
                          <div className='flex-shrink-0 mt-0.5'>
                            {notification.type === 'success' && (
                              <div className='w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center'>
                                <Check className='w-4 h-4 text-green-600 dark:text-green-400' />
                              </div>
                            )}
                            {notification.type === 'info' && (
                              <div className='w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center'>
                                <Info className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                              </div>
                            )}
                            {notification.type === 'warning' && (
                              <div className='w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center'>
                                <Sparkles className='w-4 h-4 text-amber-600 dark:text-amber-400' />
                              </div>
                            )}
                            {notification.type === 'error' && (
                              <div className='w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center'>
                                <X className='w-4 h-4 text-red-600 dark:text-red-400' />
                              </div>
                            )}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-start justify-between gap-2 mb-1'>
                              <div className='flex items-center gap-2'>
                                <h4 className='text-sm font-semibold text-gray-800 dark:text-slate-200'>
                                  {notification.title}
                                </h4>
                                {!notification.is_read && (
                                  <span className='w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0' />
                                )}
                              </div>
                              <span className='text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap'>
                                {formatTime(notification.created_at)}
                              </span>
                            </div>
                            <p className='text-sm text-gray-600 dark:text-slate-400 mb-2'>
                              {notification.message}
                            </p>
                            <div className='flex items-center gap-2'>
                              {notification.priority === 'high' && (
                                <span className='px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-full'>
                                  高优先级
                                </span>
                              )}
                              {notification.priority === 'medium' && (
                                <span className='px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-full'>
                                  中优先级
                                </span>
                              )}
                              <span className='text-xs text-gray-400 dark:text-slate-500'>
                                {notification.type === 'success' && '成功'}
                                {notification.type === 'info' && '信息'}
                                {notification.type === 'warning' && '警告'}
                                {notification.type === 'error' && '错误'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className='px-5 py-4 border-t border-gray-100 dark:border-slate-700 bg-gradient-to-r from-gray-50 via-blue-50/50 to-purple-50/50 dark:from-slate-700/50 dark:via-blue-500/5 dark:to-purple-500/5'>
                  <button className='w-full py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-500/10 dark:to-blue-500/10 hover:from-primary-100 hover:to-blue-100 dark:hover:from-primary-500/20 dark:hover:to-blue-500/15 rounded-xl transition-all duration-200 flex items-center justify-center gap-2'>
                    查看全部通知
                    <ArrowRight className='w-4 h-4' />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className='relative ml-1' data-header-menu>
            <button
              onClick={toggleUserMenu}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                showUserMenu
                  ? 'bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-500/15 dark:to-blue-500/10 shadow-lg shadow-primary-500/10'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:scale-105 transition-transform'>
                <span className='text-sm font-bold text-white'>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className='hidden sm:block text-left'>
                <p className='text-sm font-semibold text-gray-800 dark:text-slate-200 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors'>
                  {displayName}
                </p>
                <p className='text-xs text-gray-500 dark:text-slate-500'>{roleLabel}</p>
              </div>
              <ChevronDown
                className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showUserMenu && (
              <div className='absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50 animate-slide-up'>
                <div className='px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-primary-50 via-purple-50 to-pink-50 dark:from-primary-500/10 dark:via-purple-500/5 dark:to-pink-500/5'>
                  <div className='flex items-center gap-3'>
                    <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-primary-500/30'>
                      <span className='text-lg font-bold text-white'>
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className='text-sm font-semibold text-gray-800 dark:text-slate-200'>
                        {displayName}
                      </p>
                      <p className='text-xs text-gray-500 dark:text-slate-500'>{admin?.username}</p>
                      <span className='inline-flex mt-1 px-2 py-0.5 bg-gradient-to-r from-primary-500 to-purple-500 text-white text-xs font-bold rounded-full'>
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='px-2 py-3'>
                  <Link
                    to='/settings'
                    className='flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all duration-200 group'
                    onClick={closeMenus}
                  >
                    <Settings className='w-5 h-5 text-gray-500 group-hover:text-primary-500 transition-colors' />
                    <span className='text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors'>
                      系统设置
                    </span>
                  </Link>
                </div>

                <div className='px-2 py-3 border-t border-gray-100 dark:border-slate-700'>
                  <button
                    onClick={handleLogout}
                    className='w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 group'
                  >
                    <LogOut className='w-5 h-5 text-gray-500 group-hover:text-red-500 transition-colors' />
                    <span className='text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors'>
                      退出登录
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;