import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import { ToastProvider, useToast } from './context/ToastContext';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcut';

// 懒加载页面组件
const UserList = lazy(() => import('./pages/UserList'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const RuleList = lazy(() => import('./pages/RuleList'));
const RankRuleList = lazy(() => import('./pages/RankRuleList'));
const CategoryList = lazy(() => import('./pages/CategoryList'));
const TimeRuleList = lazy(() => import('./pages/TimeRuleList'));
const DeviceList = lazy(() => import('./pages/DeviceList'));
const Analysis = lazy(() => import('./pages/Analysis'));
const MQTTDebug = lazy(() => import('./pages/MQTTDebug'));
const Settings = lazy(() => import('./pages/Settings'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Profile = lazy(() => import('./pages/Profile'));
const OperationLogs = lazy(() => import('./pages/OperationLogs'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PermissionManagement = lazy(() => import('./pages/PermissionManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

// 加载中组件
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 border-3 border-slate-700 rounded-full animate-spin border-t-blue-500" />
          <div className="absolute inset-0 w-12 h-12 border-3 border-transparent rounded-full animate-spin border-b-purple-500" />
        </div>
        <p className="text-slate-400 text-sm">加载中...</p>
      </div>
    </div>
  );
}

function ToastContainerWrapper() {
  const { toasts, removeToast } = useToast();
  return <ToastContainer toasts={toasts} onRemove={removeToast} />;
}

function GlobalToastProvider({ children }) {
  return (
    <ToastProvider>
      {children}
      <ToastContainerWrapper />
    </ToastProvider>
  );
}



// 认证保护组件
function ProtectedRoute({ children, requireRole, allowedRoles }) {
  const location = useLocation();
  
  const getRole = () => {
    const admin = localStorage.getItem('admin');
    if (!admin) return null;
    try {
      return JSON.parse(admin).role;
    } catch {
      return null;
    }
  };

  if (!localStorage.getItem('admin')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = getRole();

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
      <Suspense fallback={<LoadingFallback />}>
        <PageTransition>
          <Dashboard />
        </PageTransition>
      </Suspense>
    </div>
  );
}

// 主应用布局 - 带侧边栏和头部
function AppLayout() {
  useGlobalKeyboardShortcuts();

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-100 via-blue-50/30 to-indigo-50/30">
          <Suspense fallback={<LoadingFallback />}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <GlobalToastProvider>
      <ErrorBoundary>
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
              element={<AppLayout />} 
            >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UserList />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="rules" element={<RuleList />} />
            <Route path="rank-rules" element={<RankRuleList />} />
            <Route path="categories" element={<CategoryList />} />
            <Route path="time-rules" element={<TimeRuleList />} />
            <Route path="devices" element={<DeviceList />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="mqtt" element={<MQTTDebug />} />
            <Route path="operation-logs" element={<OperationLogs />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<HelpCenter />} />
            <Route path="profile" element={<Profile />} />
            <Route path="permission" element={<PermissionManagement />} />
            <Route path="user-management" element={<UserManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </GlobalToastProvider>
  );
}

export default App;