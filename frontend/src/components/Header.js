import { Bell, Search, Moon, Sun, ChevronDown, User, Settings, LogOut, Check, Info, ChevronRight, X, Zap, ArrowRight, Sparkles, Hash, Clock, Filter, Star, Command, BellRing } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Header() {
  const [isDark, setIsDark] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [admin, setAdmin] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [notificationAnimations, setNotificationAnimations] = useState({});
  const [showNotificationBadge, setShowNotificationBadge] = useState(true);
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const notificationRef = useRef(null);

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

  useEffect(() => {
    if (searchValue.length > 0) {
      setSearchResults([
        { type: 'user', label: `${searchValue}`, sublabel: '搜索学生', icon: User, path: '/users', hotkey: 'U' },
        { type: 'rule', label: `${searchValue}`, sublabel: '搜索规则', icon: Settings, path: '/rules', hotkey: 'R' },
        { type: 'record', label: `${searchValue}`, sublabel: '搜索记录', icon: Clock, path: '/analysis', hotkey: 'A' },
        { type: 'device', label: `${searchValue}`, sublabel: '搜索设备', icon: Hash, path: '/devices', hotkey: 'D' },
      ]);
    } else {
      setSearchResults([
        { type: 'quick', label: '数据概览', sublabel: '查看仪表盘', icon: Sparkles, path: '/dashboard', hotkey: '1' },
        { type: 'quick', label: '学生管理', sublabel: '管理学生信息', icon: User, path: '/users', hotkey: '2' },
        { type: 'quick', label: '积分规则', sublabel: '配置积分规则', icon: Settings, path: '/rules', hotkey: '3' },
        { type: 'quick', label: '设备监控', sublabel: '查看设备状态', icon: Hash, path: '/devices', hotkey: '4' },
      ]);
    }
  }, [searchValue]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if (searchFocused && searchValue.length === 0) {
        const shortcuts = {
          '1': '/dashboard',
          '2': '/users',
          '3': '/rules',
          '4': '/devices',
          'u': '/users',
          'r': '/rules',
          'a': '/analysis',
          'd': '/devices',
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
  
  const handleLogout = useCallback(() => {
    setShowUserMenu(false);
    localStorage.removeItem('admin');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  }, [navigate]);

  const toggleDarkMode = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
    setShowUserMenu(false);
    if (!showNotificationBadge) {
      setTimeout(() => setShowNotificationBadge(true), 100);
    }
  }, [showNotificationBadge]);

  const toggleUserMenu = useCallback(() => {
    setShowUserMenu(prev => !prev);
    setShowNotifications(false);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => setSearchFocused(false), 200);
  }, []);

  const closeMenus = useCallback(() => {
    setShowNotifications(false);
    setShowUserMenu(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-header-menu]')) {
        closeMenus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenus]);

  const notifications = useMemo(() => [
    { id: 1, title: '新学生注册', message: '张三同学已成功注册', time: '2分钟前', type: 'success', read: false, priority: 'high' },
    { id: 2, title: '积分更新', message: '李四同学积分 +10', time: '5分钟前', type: 'info', read: false, priority: 'medium' },
    { id: 3, title: '权限提醒', message: '王五同学积分达标，已开通手机箱权限', time: '10分钟前', type: 'success', read: false, priority: 'high' },
    { id: 4, title: '规则更新', message: '新规则「课堂表现」已生效', time: '15分钟前', type: 'info', read: true, priority: 'low' },
    { id: 5, title: '设备告警', message: '设备phonebox_003离线超过1小时', time: '30分钟前', type: 'error', read: false, priority: 'high' },
    { id: 6, title: '审批通知', message: '赵六同学的加分申请待审核', time: '1小时前', type: 'warning', read: false, priority: 'medium' },
  ], []);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const roleLabel = useMemo(() => {
    return admin?.role === 'admin' ? '超级管理员' : '教师';
  }, [admin]);

  const displayName = useMemo(() => {
    return admin?.real_name || admin?.username || '管理员';
  }, [admin]);

  return (
    <header className="relative bg-gradient-to-r from-white/90 via-white/80 to-white/90 backdrop-blur-xl border-b border-gray-100/80 px-4 md:px-6 py-3 shadow-sm shadow-black/5 sticky top-0 z-40">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-accent-50/50 opacity-0 transition-opacity duration-300" />
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 group">
            <svg className="w-6 h-6 text-gray-600 group-hover:text-gray-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className={`relative hidden md:block transition-all duration-500 ease-out ${searchFocused ? 'w-[450px]' : 'w-64'}`}>
            <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ${searchFocused ? 'bg-gradient-to-r from-primary-50 via-blue-50 to-cyan-50 shadow-xl shadow-primary-500/15 ring-2 ring-primary-200' : 'bg-gray-50'}`} />
            
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${searchFocused ? 'text-primary-500 scale-110' : 'text-gray-400'}`}>
              <Search className={`w-5 h-5 transition-all duration-300 ${searchFocused ? 'animate-bounce-once' : ''}`} />
            </div>
            
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="搜索学生、规则、设备... (Ctrl+K)"
              className="w-full pl-12 pr-10 py-3 bg-transparent border-2 border-transparent rounded-2xl text-sm focus:outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-500/20 transition-all duration-300"
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            
            {searchValue.length === 0 && (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-500 font-mono hover:bg-gray-200 hover:text-gray-700 transition-all duration-200 flex items-center gap-1">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            )}
            
            {searchValue.length > 0 && (
              <button
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-200 hover:bg-danger-100 hover:text-danger-500 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
            
            {searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2.5 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-slide-up shadow-primary-500/5">
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50 via-blue-50 to-cyan-50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                      快速搜索
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <kbd className="px-1.5 py-0.5 bg-gray-200/80 rounded text-gray-500">Esc</kbd>
                      <span>关闭</span>
                    </div>
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        navigate(result.path);
                        setSearchValue('');
                        setSearchFocused(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gradient-to-r hover:from-primary-50/70 hover:to-blue-50/70 transition-all duration-200 text-left group animate-fade-in"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        searchFocused ? 'bg-gradient-to-br from-primary-100 to-blue-100' : 'bg-gray-100'
                      } group-hover:scale-115 group-hover:shadow-lg group-hover:shadow-primary-500/20`}>
                        <result.icon className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 group-hover:text-primary-700 transition-colors truncate">
                            {searchValue.length > 0 ? result.sublabel : result.label}
                          </span>
                          {searchValue.length > 0 && (
                            <span className="text-xs text-primary-600 font-medium bg-primary-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {searchValue}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{searchValue.length > 0 ? '点击跳转搜索结果' : result.sublabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-mono">
                          {result.hotkey}
                        </kbd>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-gray-500">
                        <kbd className="px-1.5 py-0.5 bg-gray-200/80 rounded text-gray-500">Enter</kbd>
                        <span>跳转</span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <kbd className="px-1.5 py-0.5 bg-gray-200/80 rounded text-gray-500">Tab</kbd>
                        <span>切换</span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <kbd className="px-1.5 py-0.5 bg-gray-200/80 rounded text-gray-500">↑↓</kbd>
                        <span>导航</span>
                      </span>
                    </div>
                    <button className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium transition-colors">
                      <Filter className="w-3 h-3" />
                      高级搜索
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={toggleDarkMode}
            className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
            title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {isDark ? (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/30 group-hover:scale-110 group-active:scale-95 transition-transform">
                <Sun className="w-4.5 h-4.5 text-white" />
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-orange-500 to-amber-600 rounded-lg opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform">
                <Moon className="w-4.5 h-4.5 text-gray-300" />
                <div className="absolute inset-0 bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 rounded-lg opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300" />
              </div>
            )}
          </button>

          <div className="relative" data-header-menu ref={notificationRef}>
            <button
              onClick={toggleNotifications}
              className={`relative p-2.5 rounded-xl transition-all duration-200 ${
                showNotifications ? 'bg-gradient-to-r from-primary-50 to-blue-50 text-primary-600' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <div className={`relative transition-all duration-300 ${showNotifications ? 'scale-115' : 'group-hover:scale-110'}`}>
                <Bell className="w-5 h-5" />
                {showNotificationBadge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-danger-500 via-rose-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                    <span className="text-xs font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  </span>
                )}
                {showNotificationBadge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-danger-500 via-rose-500 to-pink-600 rounded-full opacity-50 blur-sm animate-ping" />
                )}
              </div>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-slide-up">
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <BellRing className="w-4 h-4 text-white" />
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-600 rounded-lg opacity-50 blur-xl" />
                      </div>
                      <h3 className="font-semibold text-gray-800">通知中心</h3>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-danger-500 to-rose-500 text-white rounded-full text-xs font-medium shadow-md">
                          {unreadCount} 未读
                        </span>
                      )}
                    </div>
                    <button
                      onClick={toggleNotifications}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  {unreadCount > 0 && (
                    <button className="mt-2.5 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5 hover:gap-2 transition-all duration-200 group">
                      <Check className="w-3 h-3 group-hover:scale-110 transition-transform" />
                      全部标为已读
                    </button>
                  )}
                </div>
                
                <div className="max-h-96 overflow-y-auto scrollbar-thin">
                  {notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      className={`px-5 py-4 border-b border-gray-50 transition-all duration-200 cursor-pointer group ${
                        notification.read ? 'hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-gray-100/50' : 'bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5'
                      }`}
                      style={{ animationDelay: `${index * 40}ms` }}
                      onMouseEnter={() => {
                        setNotificationAnimations(prev => ({ ...prev, [notification.id]: true }));
                      }}
                      onMouseLeave={() => {
                        setNotificationAnimations(prev => ({ ...prev, [notification.id]: false }));
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          notification.type === 'success' ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' :
                          notification.type === 'error' ? 'bg-gradient-to-br from-danger-500/20 to-rose-500/20' :
                          notification.type === 'warning' ? 'bg-gradient-to-br from-warning-500/20 to-amber-500/20' :
                          'bg-gradient-to-br from-primary-500/20 to-blue-500/20'
                        } ${notificationAnimations[notification.id] ? 'scale-115 shadow-lg' : ''}`}>
                          {notification.type === 'success' ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : notification.type === 'error' ? (
                            <X className="w-5 h-5 text-danger-600" />
                          ) : notification.type === 'warning' ? (
                            <Star className="w-5 h-5 text-warning-600" />
                          ) : (
                            <Info className="w-5 h-5 text-primary-600" />
                          )}
                          
                          {notification.priority === 'high' && !notification.read && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-danger-500 rounded-full animate-pulse" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`font-semibold transition-colors duration-200 ${notification.read ? 'text-gray-600' : 'text-gray-800'}`}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              {notification.time.includes('分钟') ? <Zap className="w-3 h-3 text-primary-400" /> : <Clock className="w-3 h-3" />}
                              {notification.time}
                            </p>
                            {notification.priority === 'high' && (
                              <span className="text-xs px-1.5 py-0.5 bg-danger-100 text-danger-600 rounded-full font-medium">
                                紧急
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-gray-100/50">
                  <button className="w-full text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors flex items-center justify-center gap-2 hover:gap-3 transition-all duration-200 group">
                    查看全部通知
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" data-header-menu>
            <button
              onClick={toggleUserMenu}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all duration-200 ${
                showUserMenu ? 'bg-gradient-to-r from-primary-50 to-blue-50' : 'hover:bg-gray-100'
              }`}
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600 opacity-50 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-800">{displayName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="relative">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    <span className="absolute inset-0 w-1.5 h-1.5 bg-green-500 rounded-full animate-ping opacity-75" />
                  </span>
                  {roleLabel}
                </p>
              </div>
              
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showUserMenu ? 'rotate-180 text-primary-500' : 'text-gray-400'}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-elevated border border-gray-100 overflow-hidden z-50 animate-bounce-in-down">
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-600" />
                      <User className="relative w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{displayName}</p>
                      <p className="text-xs text-gray-500">{roleLabel}</p>
                    </div>
                  </div>
                </div>
                
                <div className="py-2">
                  <Link
                    to="/profile"
                    onClick={toggleUserMenu}
                    className="w-full px-5 py-3 text-left hover:bg-gradient-to-r hover:from-primary-50/50 hover:to-blue-50/50 transition-all duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-100 to-blue-100 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform">
                      <User className="w-4.5 h-4.5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800 group-hover:text-primary-700 transition-colors">个人资料</span>
                      <p className="text-xs text-gray-400">查看和编辑个人信息</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all duration-200" />
                  </Link>
                  
                  <Link
                    to="/settings"
                    onClick={toggleUserMenu}
                    className="w-full px-5 py-3 text-left hover:bg-gradient-to-r hover:from-accent-50/50 hover:to-purple-50/50 transition-all duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-100 to-purple-100 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform">
                      <Settings className="w-4.5 h-4.5 text-accent-600" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800 group-hover:text-accent-700 transition-colors">账户设置</span>
                      <p className="text-xs text-gray-400">管理账户安全和偏好</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-accent-500 group-hover:translate-x-1 transition-all duration-200" />
                  </Link>
                </div>
                
                <div className="border-t border-gray-100">
                  <button
                    onClick={handleLogout}
                    className="w-full px-5 py-3 text-left hover:bg-gradient-to-r hover:from-danger-50/50 hover:to-red-50/50 transition-all duration-200 flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-danger-100 to-red-100 flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-transform">
                      <LogOut className="w-4.5 h-4.5 text-danger-600" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-danger-600">退出登录</span>
                      <p className="text-xs text-gray-400">安全退出当前账户</p>
                    </div>
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
