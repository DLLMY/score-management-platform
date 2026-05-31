import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import DevTools from './components/DevTools';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcut';

const RouteLoading = () => (
  <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900'>
    <div className='text-center'>
      <div className='w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4'></div>
      <p className='text-gray-500 dark:text-slate-400'>加载中...</p>
    </div>
  </div>
);

const RouteError = ({ error }) => (
  <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4'>
    <div className='text-center max-w-md'>
      <div className='text-red-400 text-6xl mb-4'>⚠️</div>
      <h2 className='text-xl font-bold text-gray-800 dark:text-white mb-2'>页面加载失败</h2>
      <p className='text-gray-500 dark:text-slate-400 mb-4'>
        {error?.message || '请刷新页面重试'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className='px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
      >
        刷新页面
      </button>
    </div>
  </div>
);

const createLazyComponent = (importFn) => {
  const LazyComponent = lazy(importFn);

  const WrappedComponent = (props) => (
    <ErrorBoundary fallback={<RouteError />}>
      <Suspense fallback={<RouteLoading />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `Lazy(${importFn.name || 'Component'})`;
  return WrappedComponent;
};

const UserList = createLazyComponent(() => import('./pages/UserList'));
const UserDetail = createLazyComponent(() => import('./pages/UserDetail'));
const RuleList = createLazyComponent(() => import('./pages/RuleList'));
const RankRuleList = createLazyComponent(() => import('./pages/RankRuleList'));
const CategoryList = createLazyComponent(() => import('./pages/CategoryList'));
const TimeRuleList = createLazyComponent(() => import('./pages/TimeRuleList'));
const DeviceManagement = createLazyComponent(() => import('./pages/DeviceManagement'));
const Analysis = createLazyComponent(() => import('./pages/Analysis'));
const MQTTDebug = createLazyComponent(() => import('./pages/MQTTDebug'));
const OperationLogs = createLazyComponent(() => import('./pages/OperationLogs'));
const Notifications = createLazyComponent(() => import('./pages/Notifications'));
const Approvals = createLazyComponent(() => import('./pages/Approvals'));
const Settings = createLazyComponent(() => import('./pages/Settings'));
const HelpCenter = createLazyComponent(() => import('./pages/HelpCenter'));
const Profile = createLazyComponent(() => import('./pages/Profile'));
const PermissionManagement = createLazyComponent(() => import('./pages/PermissionManagement'));
const UserManagement = createLazyComponent(() => import('./pages/UserManagement'));
const Dashboard = createLazyComponent(() => import('./pages/Dashboard'));
const FirmwareManagement = createLazyComponent(() => import('./pages/FirmwareManagement'));
const ExamManagement = createLazyComponent(() => import('./pages/ExamManagement'));
const ScoreEntry = createLazyComponent(() => import('./pages/ScoreEntry'));
const ScoreRecords = createLazyComponent(() => import('./pages/ScoreRecords'));
const ScoreAnalysis = createLazyComponent(() => import('./pages/ScoreAnalysis'));

function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const adminStr = localStorage.getItem('admin');
  const admin = adminStr ? JSON.parse(adminStr) : null;

  if (!admin) {
    return <Navigate to='/login' state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role)) {
    return <Navigate to='/' replace />;
  }

  return children;
}

function AppLayout() {
  const { showToast } = useToast();
  useGlobalKeyboardShortcuts(showToast);

  return (
    <div className='flex min-h-screen bg-gray-50 dark:bg-slate-900'>
      <Sidebar />
      <div className='flex-1 flex flex-col bg-white dark:bg-slate-800'>
        <Header />
        <main className='flex-1 p-6 bg-gray-50 dark:bg-slate-900'>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

function DashboardLayout() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-purple-50/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900'>
      <Outlet />
      <ToastContainer />
    </div>
  );
}

function GlobalToastProvider({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

function App() {
  return (
    <ThemeProvider>
      <GlobalToastProvider>
        <ErrorBoundary fallback={<RouteError />}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              <Route path='/login' element={<Login />} />
              <Route
                path='/dashboard'
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
              </Route>
              <Route path='/' element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path='users' element={<UserList />} />
                <Route path='users/:id' element={<UserDetail />} />
                <Route path='rules' element={<RuleList />} />
                <Route path='rank-rules' element={<RankRuleList />} />
                <Route path='categories' element={<CategoryList />} />
                <Route path='time-rules' element={<TimeRuleList />} />
                <Route path='devices' element={<DeviceManagement />} />
                <Route path='device-monitor' element={<Navigate to='/devices' replace />} />
                <Route path='firmware' element={<FirmwareManagement />} />
                <Route path='analysis' element={<Analysis />} />
                <Route path='mqtt' element={<MQTTDebug />} />
                <Route path='operation-logs' element={<OperationLogs />} />
                <Route path='notifications' element={<Notifications />} />
                <Route path='approvals' element={<Approvals />} />
                <Route path='settings' element={<Settings />} />
                <Route path='help' element={<HelpCenter />} />
                <Route path='profile' element={<Profile />} />
                <Route path='permission' element={<PermissionManagement />} />
                <Route path='user-management' element={<UserManagement />} />
                <Route path='exams' element={<ExamManagement />} />
                <Route path='score-entry' element={<ScoreEntry />} />
                <Route path='score-records' element={<ScoreRecords />} />
                <Route path='score-analysis' element={<ScoreAnalysis />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <DevTools />
        </ErrorBoundary>
      </GlobalToastProvider>
    </ThemeProvider>
  );
}

export default App;
