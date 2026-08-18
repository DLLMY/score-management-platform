import { lazy, Suspense, useEffect, ComponentType } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import {
  Sidebar,
  Header,
  ErrorBoundary,
  DevTools,
  GlobalLoading,
  GlobalErrorBoundary,
  NetworkStatusIndicator,
  PreloadProvider,
  PermissionGuard,
} from './components';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcut';
import { fetchCsrfToken } from './services/api';
import { preloadService } from './services/preloadService';
import { useWebSocketStore, initStores } from './stores';
import { ToastProvider } from './context/ToastContext';
import { GlobalStateProvider } from './context/GlobalStateContext';

interface RouteErrorProps {
  error?: Error | null;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

interface LazyComponentProps {
  preload?: () => Promise<ComponentType>;
}

const RouteLoading: React.FC = () => (
  <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900'>
    <div className='text-center'>
      <div className='w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3'></div>
      <p className='text-sm text-gray-500 dark:text-slate-400'>加载中...</p>
    </div>
  </div>
);

const RouteError: React.FC<RouteErrorProps> = ({ error }) => (
  <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4'>
    <div className='text-center max-w-md'>
      <div className='text-red-400 text-4xl mb-3'>⚠️</div>
      <h2 className='text-lg font-bold text-gray-800 dark:text-white mb-2'>页面加载失败</h2>
      <p className='text-gray-500 dark:text-slate-400 mb-4 text-sm'>
        {error?.message || '请刷新页面重试'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className='px-5 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm'
      >
        刷新页面
      </button>
    </div>
  </div>
);

const createLazyComponent = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importFn: () => Promise<{ default: React.ComponentType<any> }>,
  preload: boolean = false
): React.FC & LazyComponentProps => {
  const LazyComponent = lazy(importFn);

  if (preload) {
    importFn();
  }

  const WrappedComponent: React.FC = (props) => (
    <ErrorBoundary fallback={<RouteError />}>
      <Suspense fallback={<RouteLoading />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `Lazy(${importFn.name || 'Component'})`;
  (WrappedComponent as React.FC & LazyComponentProps).preload =
    importFn as unknown as () => Promise<ComponentType>;
  return WrappedComponent as React.FC & LazyComponentProps;
};

const UserList = createLazyComponent(() => import('./pages/UserList'));
const UserDetail = createLazyComponent(() => import('./pages/UserDetail'));
const RuleList = createLazyComponent(() => import('./pages/RuleList'));
const RankRuleList = createLazyComponent(() => import('./pages/RankRuleList'));
const CategoryList = createLazyComponent(() => import('./pages/CategoryList'));
const TimeRuleList = createLazyComponent(() => import('./pages/TimeRuleList'));
const PhoneBoxPolicy = createLazyComponent(() => import('./pages/PhoneBoxPolicy'));
const ClassPeriodSettings = createLazyComponent(() => import('./pages/ClassPeriodSettings'));
const ClassManagement = createLazyComponent(() => import('./pages/ClassManagement'));
const SubjectManagement = createLazyComponent(() => import('./pages/SubjectManagement'));
const DeviceManagement = createLazyComponent(() => import('./pages/DeviceManagement'));
const DeviceGroup = createLazyComponent(() => import('./pages/DeviceGroup'));
const Analysis = createLazyComponent(() => import('./pages/Analysis'));

const OperationLogs = createLazyComponent(() => import('./pages/OperationLogs'));
const Notifications = createLazyComponent(() => import('./pages/Notifications'));
const Approvals = createLazyComponent(() => import('./pages/Approvals'));
const Settings = createLazyComponent(() => import('./pages/Settings'));
const HelpCenter = createLazyComponent(() => import('./pages/HelpCenter'));
const Profile = createLazyComponent(() => import('./pages/Profile'));
const PermissionManagement = createLazyComponent(() => import('./pages/PermissionManagement'));
const Dashboard = createLazyComponent(() => import('./pages/Dashboard'));
const FirmwareManagement = createLazyComponent(() => import('./pages/FirmwareManagement'));
const ExamManagement = createLazyComponent(() => import('./pages/ExamManagement'));
const ScoreEntry = createLazyComponent(() => import('./pages/ScoreEntry'));
const ScoreRecords = createLazyComponent(() => import('./pages/ScoreRecords'));
const SemesterReport = createLazyComponent(() => import('./pages/SemesterReport'));
const RankBoard = createLazyComponent(() => import('./pages/RankBoard'));
const ScoreAnalysis = createLazyComponent(() => import('./pages/ScoreAnalysis'));

const AlgorithmAnalysis = createLazyComponent(() => import('./pages/AlgorithmAnalysis'));
const Diagnostics = createLazyComponent(() => import('./pages/Diagnostics'));
const ClassCompare = createLazyComponent(() => import('./pages/ClassCompare'));

const WakeOnLan = createLazyComponent(() => import('./pages/WakeOnLan'));
const RemoteNotify = createLazyComponent(() => import('./pages/RemoteNotify'));
const NLPManagement = createLazyComponent(() => import('./pages/NLPManagement'));
const DataSyncPage = createLazyComponent(() => import('./pages/DataSyncPage'));
const CourseSchedule = createLazyComponent(() => import('./pages/CourseSchedule'));

const ImportConfigManagement = createLazyComponent(() => import('./pages/ImportConfigManagement'));

const SeatingChart = createLazyComponent(() => import('./pages/SeatingChart'));
const DutyRoster = createLazyComponent(() => import('./pages/DutyRoster'));
const CommitteeList = createLazyComponent(() => import('./pages/CommitteeList'));
const ParentContact = createLazyComponent(() => import('./pages/ParentContact'));
const HomeworkCheck = createLazyComponent(() => import('./pages/HomeworkCheck'));
const AttendanceManage = createLazyComponent(() => import('./pages/AttendanceManage'));
const StudyGroups = createLazyComponent(() => import('./pages/StudyGroups'));
const MentalHealth = createLazyComponent(() => import('./pages/MentalHealth'));
const ActivityManage = createLazyComponent(() => import('./pages/ActivityManage'));
const CultureBoard = createLazyComponent(() => import('./pages/CultureBoard'));
const StudyGuide = createLazyComponent(() => import('./pages/StudyGuide'));
const OpsCenter = createLazyComponent(() => import('./pages/OpsCenter'));
const SecurityAudit = createLazyComponent(() => import('./pages/SecurityAudit'));
const FrontendTelemetry = createLazyComponent(() => import('./pages/FrontendTelemetry'));
const SystemMetrics = createLazyComponent(() => import('./pages/SystemMetrics'));

const Login = createLazyComponent(() => import('./pages/Login'), true);
const StudentLogin = createLazyComponent(() => import('./pages/StudentLogin'));
const StudentPortal = createLazyComponent(() => import('./pages/StudentPortal'));
const NotFound = createLazyComponent(() => import('./pages/NotFound'));

const preloadConfigs = [
  {
    route: '/users',
    component: UserList,
    priority: 'high' as const,
    preloadOnHover: true,
    preloadOnVisit: true,
  },
  {
    route: '/devices',
    component: DeviceManagement,
    priority: 'high' as const,
    preloadOnHover: true,
    preloadOnVisit: true,
  },
  {
    route: '/rules',
    component: RuleList,
    priority: 'high' as const,
    preloadOnHover: true,
    preloadOnVisit: true,
  },

  {
    route: '/users/:id',
    component: UserDetail,
    priority: 'medium' as const,
    preloadOnHover: true,
    dependencies: ['/users'],
  },
  { route: '/analysis', component: Analysis, priority: 'medium' as const, preloadOnHover: true },
  {
    route: '/score-records',
    component: ScoreRecords,
    priority: 'medium' as const,
    preloadOnHover: true,
  },
  {
    route: '/operation-logs',
    component: OperationLogs,
    priority: 'medium' as const,
    preloadOnHover: true,
  },

  { route: '/settings', component: Settings, priority: 'low' as const, preloadOnVisit: true },
  { route: '/profile', component: Profile, priority: 'low' as const, preloadOnVisit: true },
  { route: '/help', component: HelpCenter, priority: 'low' as const, preloadOnVisit: true },
  {
    route: '/firmware',
    component: FirmwareManagement,
    priority: 'low' as const,
    preloadOnHover: true,
  },
];

let initializedOnce = false;
let preloadStarted = false;

if (!initializedOnce) {
  preloadConfigs.forEach((config) => preloadService.register(config));
  initializedOnce = true;
}

interface AdminInfo {
  id: number;
  username: string;
  role: string;
}

function ProtectedRoute({ children, allowedRoles = [] }: ProtectedRouteProps) {
  const location = useLocation();
  const adminStr = localStorage.getItem('admin');
  const admin: AdminInfo | null = adminStr ? JSON.parse(adminStr) : null;

  if (!admin) {
    return <Navigate to='/login' state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role)) {
    return <Navigate to='/' replace />;
  }

  return <>{children}</>;
}

function StudentProtectedRoute({ children }: { children: React.ReactNode }) {
  const studentStr = localStorage.getItem('student');
  if (!studentStr) {
    return <Navigate to='/student/login' replace />;
  }
  return <>{children}</>;
}

function AppLayout() {
  const initSocket = useWebSocketStore((state) => state.initSocket);
  const disconnectSocket = useWebSocketStore((state) => state.disconnectSocket);

  useGlobalKeyboardShortcuts();

  useEffect(() => {
    let mounted = true;

    const startSocketAndCache = async () => {
      const adminStr = localStorage.getItem('admin');
      if (!adminStr) return;

      initSocket('');

      const storedToken = localStorage.getItem('csrf_token');
      if (!storedToken) {
        try {
          await fetchCsrfToken();
        } catch {
          // ignore
        }
      }

      if ('requestIdleCallback' in window) {
        (
          window as unknown as {
            requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
          }
        ).requestIdleCallback(
          () => {
            if (!mounted) return;
            import('./services/cacheWarmupService')
              .then(({ cacheWarmupService }) => {
                cacheWarmupService.warmup().catch(() => {});
              })
              .catch(() => {});
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(async () => {
          if (!mounted) return;
          try {
            const { cacheWarmupService } = await import('./services/cacheWarmupService');
            await cacheWarmupService.warmup();
          } catch {
            // ignore
          }
        }, 3000);
      }
    };

    startSocketAndCache();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [initSocket, disconnectSocket]);

  return (
    <div className='flex min-h-screen bg-gray-50 dark:bg-slate-900'>
      <NetworkStatusIndicator />
      <Sidebar />
      <div className='flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-800'>
        <Header />
        <main className='flex-1 p-4 md:p-6 bg-gray-50 dark:bg-slate-900 safe-area-bottom'>
          <Outlet />
        </main>
      </div>
      {/* 顶部红色 toast 已移除：ToastContext 内部已正确按 type 渲染 toast（右下角），
          旧的 ToastContainer.tsx 强制把 info/warning/error 全部映射成 #ef4444 红色背景，
          与 ToastContext 共享 useToast() 状态，导致一次 showToast 同时弹出两条相同信息。 */}
    </div>
  );
}

function App() {
  useEffect(() => {
    initStores();

    if (!preloadStarted) {
      preloadStarted = true;
      const doPreload = () => {
        preloadService.preloadPriorityRoutes().catch(() => {});
      };

      if ('requestIdleCallback' in window) {
        (
          window as unknown as {
            requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
          }
        ).requestIdleCallback(doPreload, { timeout: 8000 });
      } else {
        setTimeout(doPreload, 3000);
      }
    }
  }, []);

  return (
    <GlobalStateProvider>
      <ToastProvider>
        <ErrorBoundary fallback={<RouteError />}>
          <HashRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <PreloadProvider />
            <Routes>
              <Route path='/login' element={<Login />} />
              <Route path='/student/login' element={<StudentLogin />} />
              <Route
                path='/student'
                element={
                  <StudentProtectedRoute>
                    <StudentPortal />
                  </StudentProtectedRoute>
                }
              />
              <Route
                path='/'
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={
                    <PermissionGuard requiredPermission='score.view'>
                      <Dashboard />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='dashboard'
                  element={
                    <PermissionGuard requiredPermission='score.view'>
                      <Dashboard />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='users'
                  element={
                    <PermissionGuard requiredPermission='student.view'>
                      <UserList />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='users/:id'
                  element={
                    <PermissionGuard requiredPermission='student.view'>
                      <UserDetail />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='rules'
                  element={
                    <PermissionGuard requiredPermission='rule.view'>
                      <RuleList />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='rank-rules'
                  element={
                    <PermissionGuard requiredPermission='rule.view'>
                      <RankRuleList />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='categories'
                  element={
                    <PermissionGuard requiredPermission='rule.view'>
                      <CategoryList />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='class-time-settings'
                  element={
                    <PermissionGuard requiredPermission='schedule.view'>
                      <TimeRuleList />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='phonebox-policy'
                  element={
                    <PermissionGuard requiredPermission='phonebox.unlock.manage'>
                      <PhoneBoxPolicy />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='class-period-settings'
                  element={
                    <PermissionGuard requiredPermission='period.view'>
                      <ClassPeriodSettings />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='class-management'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <ClassManagement />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='subject-management'
                  element={
                    <PermissionGuard requiredPermission='subject.view'>
                      <SubjectManagement />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='course-schedule'
                  element={
                    <PermissionGuard requiredPermission='schedule.view'>
                      <CourseSchedule />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='devices'
                  element={
                    <PermissionGuard requiredPermission='device.view'>
                      <DeviceManagement />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='device-groups'
                  element={
                    <PermissionGuard requiredPermission='device.view'>
                      <DeviceGroup />
                    </PermissionGuard>
                  }
                />
                <Route path='device-monitor' element={<Navigate to='/devices' replace />} />
                <Route
                  path='firmware'
                  element={
                    <PermissionGuard requiredPermission='firmware.manage'>
                      <FirmwareManagement />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='analysis'
                  element={
                    <PermissionGuard requiredPermission='algorithm.view'>
                      <Analysis />
                    </PermissionGuard>
                  }
                />

                <Route
                  path='operation-logs'
                  element={
                    <PermissionGuard requiredPermission='system.logs'>
                      <OperationLogs />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='notifications'
                  element={
                    <PermissionGuard requiredPermission='notification.view'>
                      <Notifications />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='approvals'
                  element={
                    <PermissionGuard requiredPermission='score.approve'>
                      <Approvals />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='settings'
                  element={
                    <PermissionGuard requiredPermission='system.settings'>
                      <Settings />
                    </PermissionGuard>
                  }
                />
                <Route path='help' element={<HelpCenter />} />
                <Route path='profile' element={<Profile />} />
                <Route
                  path='permission'
                  element={
                    <PermissionGuard requiredPermission='system.roles'>
                      <PermissionManagement />
                    </PermissionGuard>
                  }
                />

                <Route
                  path='class-compare'
                  element={
                    <PermissionGuard requiredPermission='algorithm.view'>
                      <ClassCompare />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='exams'
                  element={
                    <PermissionGuard requiredPermission='exam.view'>
                      <ExamManagement />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='score-entry'
                  element={
                    <PermissionGuard requiredPermission='score.entry'>
                      <ScoreEntry />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='semester-report'
                  element={
                    <PermissionGuard requiredPermission='score.view'>
                      <SemesterReport />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='rank-board'
                  element={
                    <PermissionGuard requiredPermission='score.view'>
                      <RankBoard />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='score-records'
                  element={
                    <PermissionGuard requiredPermission='score.view'>
                      <ScoreRecords />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='score-analysis'
                  element={
                    <PermissionGuard requiredPermission='algorithm.view'>
                      <ScoreAnalysis />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='algorithm-analysis'
                  element={
                    <PermissionGuard requiredPermission='algorithm.view'>
                      <AlgorithmAnalysis />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='diagnostics'
                  element={
                    <PermissionGuard requiredPermission='device.view'>
                      <Diagnostics />
                    </PermissionGuard>
                  }
                />

                <Route
                  path='wake-on-lan'
                  element={
                    <PermissionGuard requiredPermission='device.edit'>
                      <WakeOnLan />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='remote-notify'
                  element={
                    <PermissionGuard requiredPermission='notification.send'>
                      <RemoteNotify />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='nlp-management'
                  element={
                    <PermissionGuard requiredPermission='algorithm.view'>
                      <NLPManagement />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='data-sync'
                  element={
                    <PermissionGuard requiredPermission='system.settings'>
                      <DataSyncPage />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='import-config'
                  element={
                    <PermissionGuard requiredPermission='system.settings'>
                      <ImportConfigManagement />
                    </PermissionGuard>
                  }
                />

                {/* 班主任工作台 - 班级日常管理 */}
                <Route
                  path='seating-chart'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <SeatingChart />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='duty-roster'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <DutyRoster />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='committee'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <CommitteeList />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='parent-contact'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <ParentContact />
                    </PermissionGuard>
                  }
                />

                {/* 班主任工作台 - 教学与考勤管理 */}
                <Route
                  path='homework-check'
                  element={
                    <PermissionGuard requiredPermission='homework.view'>
                      <HomeworkCheck />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='attendance'
                  element={
                    <PermissionGuard requiredPermission='attendance.view'>
                      <AttendanceManage />
                    </PermissionGuard>
                  }
                />

                {/* 班主任工作台 - 学习与心理管理 */}
                <Route
                  path='study-groups'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <StudyGroups />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='mental-health'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <MentalHealth />
                    </PermissionGuard>
                  }
                />

                {/* 班主任工作台 - 特色工作 */}
                <Route
                  path='activity'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <ActivityManage />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='culture'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <CultureBoard />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='study-guide'
                  element={
                    <PermissionGuard requiredPermission='class.view'>
                      <StudyGuide />
                    </PermissionGuard>
                  }
                />

                {/* 运维中心 - 系统运维聚合总览 */}
                <Route
                  path='ops-center'
                  element={
                    <PermissionGuard requiredPermission='ops_center.view'>
                      <OpsCenter />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='ops-center/telemetry'
                  element={
                    <PermissionGuard requiredPermission='ops_center.view'>
                      <FrontendTelemetry />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='ops-center/metrics'
                  element={
                    <PermissionGuard requiredPermission='ops_center.view'>
                      <SystemMetrics />
                    </PermissionGuard>
                  }
                />
                <Route
                  path='security-audit'
                  element={
                    <PermissionGuard requiredPermission='system.settings'>
                      <SecurityAudit />
                    </PermissionGuard>
                  }
                />
              </Route>
              {/* S1: 404 兜底，任何未匹配路径展示 NotFound 而非白屏 */}
              <Route path='*' element={<NotFound />} />
            </Routes>
          </HashRouter>
          <DevTools />
          <GlobalLoading />
          <GlobalErrorBoundary />
          <NetworkStatusIndicator />
        </ErrorBoundary>
      </ToastProvider>
    </GlobalStateProvider>
  );
}

export default App;
