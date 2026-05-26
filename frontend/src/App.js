import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import UserList from './pages/UserList';
import UserDetail from './pages/UserDetail';
import RuleList from './pages/RuleList';
import RankRuleList from './pages/RankRuleList';
import CategoryList from './pages/CategoryList';
import TimeRuleList from './pages/TimeRuleList';
import DeviceList from './pages/DeviceList';
import Analysis from './pages/Analysis';
import MQTTDebug from './pages/MQTTDebug';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import Profile from './pages/Profile';
import OperationLogs from './pages/OperationLogs';
import Notifications from './pages/Notifications';
import Approvals from './pages/Approvals';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PermissionManagement from './pages/PermissionManagement';
import UserManagement from './pages/UserManagement';

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

// 获取当前用户信息
function getCurrentUser() {
  const admin = localStorage.getItem('admin');
  if (!admin) return null;
  try {
    return JSON.parse(admin);
  } catch {
    return null;
  }
}

// 认证保护组件
function ProtectedRoute({ children, requireRole, allowedRoles }) {
  const location = useLocation();
  const admin = localStorage.getItem('admin');

  if (!admin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = getCurrentRole();
  
  if (requireRole) {
    if (role !== requireRole) {
      if (role === 'dashboard') {
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      if (role === 'dashboard') {
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

// 全屏大屏布局 - 无侧边栏和头部
function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Dashboard />
    </div>
  );
}

// 主应用布局 - 带侧边栏和头部
function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-100 via-blue-50/30 to-indigo-50/30">
          <div className="animate-fade-in">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<UserList />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/rules" element={<RuleList />} />
              <Route path="/rank-rules" element={<RankRuleList />} />
              <Route path="/categories" element={<CategoryList />} />
              <Route path="/time-rules" element={<TimeRuleList />} />
              <Route path="/devices" element={<DeviceList />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/mqtt" element={<MQTTDebug />} />
              <Route path="/operation-logs" element={<OperationLogs />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/permission" element={<PermissionManagement />} />
              <Route path="/user-management" element={<UserManagement />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* 大屏用户专用路由 - 全屏布局 */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } 
        />
        {/* 管理员和教师路由 - 带侧边栏布局 */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <AppLayout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/*" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <AppLayout />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
