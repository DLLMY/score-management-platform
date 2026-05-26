import { Link, useLocation } from 'react-router-dom';
import { Users, BookOpen, Tags, BarChart3, GraduationCap, Settings, HelpCircle, LogOut, ChevronRight, Trophy, Wifi, Clock, Box, Clock as ClockIcon, Bell, ClipboardCheck, Home, Shield, Lock } from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: '数据概览', icon: Home },
  { path: '/users', label: '学生管理', icon: Users },
  { path: '/rules', label: '积分规则', icon: BookOpen },
  { path: '/rank-rules', label: '排名规则', icon: Trophy },
  { path: '/categories', label: '分类管理', icon: Tags },
  { path: '/time-rules', label: '时间规则', icon: Clock },
  { path: '/devices', label: '设备管理', icon: Box },
  { path: '/analysis', label: '数据分析', icon: BarChart3 },
  { path: '/mqtt', label: 'MQTT调试', icon: Wifi },
  { path: '/operation-logs', label: '操作日志', icon: ClockIcon },
  { path: '/notifications', label: '通知管理', icon: Bell },
  { path: '/approvals', label: '审批管理', icon: ClipboardCheck },
  { path: '/settings', label: '系统设置', icon: Settings },
];

// 获取当前用户角色
function getCurrentRole() {
  const admin = localStorage.getItem('admin');
  if (!admin) return null;
  try {
    return JSON.parse(admin).role;
  } catch {
    return null;
  }
}

function Sidebar() {
  const location = useLocation();
  const role = getCurrentRole();
  const isAdmin = role === 'admin';

  // 用户管理菜单项
  const userManagementMenuItem = { path: '/user-management', label: '用户管理', icon: Users };
  // 权限管理菜单项
  const permissionMenuItem = { path: '/permission', label: '权限管理', icon: Shield };

  return (
    <aside className="w-64 bg-gradient-sidebar text-white flex flex-col shadow-xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 to-transparent pointer-events-none" />
      
      <div className="p-6 border-b border-slate-700/50 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              积分管理平台
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Student Score System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 relative z-10 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
              to={item.path}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                isActive || (item.path === '/dashboard' && location.pathname === '/')
                  ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-lg shadow-primary-600/30'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'bg-white/20' : 'bg-slate-700/50'
                  }`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-medium flex-1 text-left text-sm">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Link>
              </li>
            );
          })}
          
          {/* 仅对管理员显示的系统管理菜单 */}
          {isAdmin && (
            <>
              <li className="pt-4 pb-2">
                <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Lock className="w-3 h-3" />
                  <span>系统管理</span>
                </div>
              </li>
              <li>
                <Link
                  to={userManagementMenuItem.path}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    location.pathname === userManagementMenuItem.path
                      ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-lg shadow-primary-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    location.pathname === userManagementMenuItem.path ? 'bg-white/20' : 'bg-slate-700/50'
                  }`}>
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-medium flex-1 text-left text-sm">{userManagementMenuItem.label}</span>
                  {location.pathname === userManagementMenuItem.path && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Link>
              </li>
              <li>
                <Link
                  to={permissionMenuItem.path}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    location.pathname === permissionMenuItem.path
                      ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-lg shadow-primary-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    location.pathname === permissionMenuItem.path ? 'bg-white/20' : 'bg-slate-700/50'
                  }`}>
                    <Shield className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-medium flex-1 text-left text-sm">{permissionMenuItem.label}</span>
                  {location.pathname === permissionMenuItem.path && (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>

      <div className="px-4 py-3 border-t border-slate-700/50 space-y-1.5 relative z-10">
        <Link
          to="/help"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
            <HelpCircle className="w-4.5 h-4.5" />
          </div>
          <span className="font-medium text-sm">帮助中心</span>
        </Link>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-danger-400 hover:bg-danger-500/20 hover:text-danger-300 transition-all duration-200">
          <div className="w-8 h-8 rounded-lg bg-danger-500/20 flex items-center justify-center">
            <LogOut className="w-4.5 h-4.5" />
          </div>
          <span className="font-medium text-sm">退出登录</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
