import { Bell, Search, Moon, Sun, ChevronDown, User, Settings, LogOut, Check, Info, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Header() {
  const [isDark, setIsDark] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [admin, setAdmin] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedAdmin = localStorage.getItem('admin');
    if (savedAdmin) {
      setAdmin(JSON.parse(savedAdmin));
    }
  }, []);
  
  const handleLogout = () => {
    setShowUserMenu(false);
    localStorage.removeItem('admin');
    navigate('/login');
  };

  const notifications = [
    { id: 1, title: '新学生注册', message: '张三同学已成功注册', time: '2分钟前', type: 'success' },
    { id: 2, title: '积分更新', message: '李四同学积分 +10', time: '5分钟前', type: 'info' },
    { id: 3, title: '权限提醒', message: '王五同学积分达标，已开通手机箱权限', time: '10分钟前', type: 'success' },
    { id: 4, title: '规则更新', message: '新规则「课堂表现」已生效', time: '15分钟前', type: 'info' },
  ];

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 shadow-sm sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="md:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-all">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className={`relative hidden md:block transition-all duration-300 ${searchFocused ? 'w-80' : 'w-64'}`}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索学生、规则..."
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200"
            title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-warning-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger-500 rounded-full shadow-lg animate-pulse" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-elevated border border-gray-100 overflow-hidden z-50 animate-slide-up">
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">通知中心</h3>
                    <span className="text-xs text-gray-500">{notifications.length} 条新通知</span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="px-5 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          notification.type === 'success' ? 'bg-success-100' : 'bg-primary-100'
                        }`}>
                          {notification.type === 'success' ? (
                            <Check className="w-5 h-5 text-success-600" />
                          ) : (
                            <Info className="w-5 h-5 text-primary-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">{notification.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-2">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 bg-gray-50">
                  <button className="w-full text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                    查看全部通知
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-600 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg shadow-primary-500/30">
                <User className="w-5 h-5" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-800">{admin?.real_name || admin?.username || '管理员'}</p>
                <p className="text-xs text-gray-500">{admin?.role === 'admin' ? '超级管理员' : '教师'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-elevated border border-gray-100 overflow-hidden z-50 animate-slide-up">
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">个人资料</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-accent-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">账户设置</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </Link>
                <div className="border-t border-gray-100">
                  <button
                    onClick={handleLogout}
                    className="w-full px-5 py-3.5 text-left hover:bg-danger-50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-danger-600" />
                    </div>
                    <span className="text-sm font-medium text-danger-600">退出登录</span>
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
