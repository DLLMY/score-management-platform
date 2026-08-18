import { useState, useCallback, useMemo, useEffect, memo, MouseEventHandler } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Box,
  Bell,
  ClipboardCheck,
  Home,
  Shield,
  FileKey,
  Activity,
  Sliders,
  ChevronLeft,
  Sparkles,
  Zap,
  History,
  Power,
  Upload,
  Server,
  Calendar,
  Gauge,
  LineChart,
  X,
  Clock,
  LucideIcon,
  Building2,
  RefreshCw,
  Grid3x3,
  ClipboardList,
  Phone,
  BookCheck,
  CalendarCheck,
  Heart,
  PartyPopper,
  Palette,
  Smartphone,
} from 'lucide-react';
import { usePermissionStore } from '../../stores';
import {
  DEFAULT_PERMISSIONS_FOR_TEACHER,
  DEFAULT_PERMISSIONS_FOR_ADMIN,
} from '../../config/permissions';

// 类型定义
interface MenuItemData {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
}

interface MenuGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: MenuItemData[];
  requiresAdmin?: boolean;
  permission?: string;
  permissions?: string[];
}

interface ExpandedGroups {
  main: boolean;
  scoreManagement: boolean;
  academicManagement: boolean;
  teacherWorkbench: boolean;
  examManagement: boolean;
  deviceManagement: boolean;
  notificationCenter: boolean;
  systemAdmin: boolean;
  opsCenter: boolean;
  [key: string]: boolean | undefined;
}

function getCurrentRole(): string | null {
  const admin = localStorage.getItem('admin');
  if (!admin) return null;
  try {
    return JSON.parse(admin).role;
  } catch {
    return null;
  }
}

// MenuItem Props
interface MenuItemProps {
  item: MenuItemData;
  isActive: boolean;
  depth?: number;
  isCollapsed: boolean;
}

const MenuItem = memo<MenuItemProps>(({ item, isActive, depth = 0, isCollapsed }) => {
  const Icon = item.icon;

  return (
    <li key={item.path} className={`${isCollapsed ? 'ml-0' : `ml-${depth * 2}`}`}>
      <Link
        to={item.path}
        className={`relative w-full flex items-center ${
          isCollapsed ? 'justify-center px-1 py-2' : 'gap-2.5 pl-6 pr-3 py-2'
        } rounded-xl transition-colors duration-150 ${
          isActive
            ? isCollapsed
              ? 'bg-primary-500/15 dark:bg-primary-500/20'
              : 'bg-primary-50/80 dark:bg-primary-500/15 text-gray-800 dark:text-slate-200'
            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-slate-300'
        }`}
      >
        <div
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full ${
            isActive && !isCollapsed ? 'bg-primary-500 opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={`relative flex items-center justify-center ${
            isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-md'
          } ${
            isActive
              ? isCollapsed
                ? 'bg-gradient-to-br from-primary-500/80 to-accent-500/80 shadow-md shadow-primary-500/25'
                : 'bg-primary-100/80 dark:bg-primary-500/20'
              : isCollapsed
              ? 'bg-gray-100/60 dark:bg-slate-700/50'
              : 'bg-gray-100/40 dark:bg-slate-700/40'
          }`}
        >
          <Icon
            className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${
              isActive ? 'text-white' : 'text-gray-500 dark:text-slate-400'
            }`}
          />
        </div>

        <span
          className={`relative font-medium flex-1 text-left text-sm ${isCollapsed ? 'hidden' : ''}`}
        >
          {item.label}
        </span>

        {isActive && !isCollapsed && (
          <div className='relative w-5 h-5 flex items-center justify-center rounded-md bg-primary-100/80 dark:bg-primary-500/20'>
            <ChevronRight className='w-3.5 h-3.5 text-primary-600' />
          </div>
        )}
      </Link>
    </li>
  );
});

// GroupHeader Props
interface GroupHeaderProps {
  group: MenuGroup;
  hasActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
}

const GroupHeader = memo<GroupHeaderProps>(
  ({ group, hasActive, isExpanded, onToggle, isCollapsed }) => {
    const GroupIcon = group.icon;

    return (
      <button
        onClick={onToggle}
        className={`relative w-full flex items-center justify-center ${
          isCollapsed ? 'px-1 py-2.5' : 'gap-3 px-3 py-3'
        } rounded-2xl transition-colors duration-150 group overflow-hidden ${
          hasActive || isExpanded
            ? 'text-gray-800 dark:text-slate-200'
            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
        }`}
      >
        <div
          className={`absolute inset-0 rounded-2xl ${
            hasActive
              ? isCollapsed
                ? 'bg-gradient-to-br from-primary-500/20 to-accent-500/10'
                : 'bg-gradient-to-r from-primary-500/10 via-blue-500/5 to-transparent'
              : isExpanded
              ? 'bg-gray-100/60 dark:bg-slate-700/50'
              : 'bg-gray-50/50 dark:bg-slate-800/50'
          }`}
        />

        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full z-10 ${
            hasActive && !isCollapsed
              ? 'bg-gradient-to-b from-primary-500 to-accent-500 opacity-100'
              : 'opacity-0'
          }`}
        />

        <div
          className={`relative flex items-center justify-center z-10 ${
            isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-9 h-9 rounded-xl'
          } ${
            hasActive
              ? isCollapsed
                ? 'bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/35 scale-110'
                : 'bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/30 scale-110'
              : isCollapsed
              ? 'bg-gray-100/80 dark:bg-slate-700/60'
              : 'bg-gray-100/70 dark:bg-slate-700/50'
          }`}
        >
          <GroupIcon
            className={`${isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} ${
              hasActive ? 'text-white' : 'text-gray-600 dark:text-slate-300'
            }`}
          />
        </div>

        <span
          className={`relative font-semibold flex-1 text-left text-sm z-10 tracking-wide ${
            isCollapsed ? 'hidden' : ''
          }`}
        >
          {group.label}
        </span>

        <div
          className={`relative w-7 h-7 flex items-center justify-center rounded-xl z-10 ${
            isCollapsed ? 'hidden' : ''
          } ${
            hasActive
              ? 'bg-primary-100/80 dark:bg-primary-500/20 text-primary-600'
              : 'bg-gray-100/50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400'
          }`}
        >
          {isExpanded ? (
            <ChevronDown className='w-4.5 h-4.5' />
          ) : (
            <ChevronRight className='w-4.5 h-4.5' />
          )}
        </div>
      </button>
    );
  }
);

interface SidebarProps {
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

function Sidebar({ isMobileMenuOpen: externalMobileMenuOpen, onCloseMobileMenu }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const role = useMemo<string | null>(() => getCurrentRole(), []);
  const {
    hasPermission,
    hasAnyPermission,
    isAdmin: isSuperAdmin,
    permissions,
    isLoading,
  } = usePermissionStore();

  const isAdmin = useMemo<boolean>(() => role === 'admin' || isSuperAdmin, [role, isSuperAdmin]);

  useEffect(() => {
    const adminStr = localStorage.getItem('admin');
    if (adminStr && isLoading) {
      try {
        const admin = JSON.parse(adminStr);
        usePermissionStore.getState().loadPermissions(admin.id);
      } catch {
        // 权限加载失败静默：PermissionGuard 会兜底渲染受限视图
      }
    }
  }, [isLoading]);
  const [expandedGroups, setExpandedGroups] = useState<ExpandedGroups>({
    main: true,
    scoreManagement: false,
    academicManagement: false,
    teacherWorkbench: false,
    examManagement: false,
    deviceManagement: false,
    notificationCenter: false,
    systemAdmin: false,
    opsCenter: false,
  });
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState<boolean>(false);

  const isMobileMenuOpen = externalMobileMenuOpen ?? internalMobileMenuOpen;

  const closeMobileMenu = useCallback(() => {
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    } else {
      setInternalMobileMenuOpen(false);
    }
  }, [onCloseMobileMenu]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
        closeMobileMenu();
      } else {
        setIsCollapsed(false);
        closeMobileMenu();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeMobileMenu]);

  // L5: 监听 Header 汉堡触发的全局事件，打开移动端抽屉
  useEffect(() => {
    const openFromHeader = () => setInternalMobileMenuOpen(true);
    window.addEventListener('mobile-menu-open', openFromHeader);
    return () => window.removeEventListener('mobile-menu-open', openFromHeader);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen, closeMobileMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        navigate('/dashboard');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        navigate('/users');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const toggleGroup = useCallback<(groupName: string) => void>((groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  }, []);

  const isItemActive = useCallback<(path: string) => boolean>(
    (path) => {
      return location.pathname === path || (path === '/dashboard' && location.pathname === '/');
    },
    [location.pathname]
  );

  const hasActiveItem = useCallback<(items: MenuItemData[]) => boolean>(
    (items) => {
      return items.some((item) => isItemActive(item.path));
    },
    [isItemActive]
  );

  const menuGroups = useMemo<MenuGroup[]>(
    () => [
      {
        id: 'main',
        label: '首页',
        icon: Home,
        items: [
          { path: '/dashboard', label: '数据概览', icon: Activity, permission: 'score.view' },
          { path: '/users', label: '学生管理', icon: Users, permission: 'student.view' },
          { path: '/analysis', label: '数据分析', icon: BarChart3, permission: 'algorithm.view' },
          {
            path: '/class-compare',
            label: '班级对比',
            icon: BarChart3,
            permission: 'algorithm.view',
          },
        ],
      },
      {
        id: 'scoreManagement',
        label: '积分管理',
        icon: Trophy,
        items: [
          { path: '/rules', label: '积分规则', icon: FileKey, permission: 'rule.view' },
          { path: '/rank-rules', label: '排名规则', icon: Trophy, permission: 'rule.view' },
          { path: '/categories', label: '分类管理', icon: Tags, permission: 'rule.view' },
          {
            path: '/nlp-management',
            label: '智能评分',
            icon: Sparkles,
            permission: 'algorithm.view',
          },
        ],
      },
      {
        id: 'academicManagement',
        label: '教务管理',
        icon: GraduationCap,
        items: [
          {
            path: '/class-management',
            label: '班级管理',
            icon: Building2,
            permission: 'class.view',
          },
          {
            path: '/subject-management',
            label: '科目管理',
            icon: BookOpen,
            permission: 'subject.view',
          },
          {
            path: '/course-schedule',
            label: '课程表管理',
            icon: Calendar,
            permission: 'schedule.view',
          },
          {
            path: '/class-time-settings',
            label: '时间规则设置',
            icon: Clock,
            permission: 'schedule.view',
          },
          {
            path: '/class-period-settings',
            label: '课程节次管理',
            icon: Clock,
            permission: 'period.view',
          },
        ],
      },
      {
        id: 'teacherWorkbench',
        label: '班主任工作台',
        icon: Users,
        items: [
          { path: '/seating-chart', label: '座次表', icon: Grid3x3, permission: 'class.view' },
          {
            path: '/duty-roster',
            label: '值日生表',
            icon: ClipboardList,
            permission: 'class.view',
          },
          { path: '/committee', label: '班委名单', icon: Users, permission: 'class.view' },
          { path: '/parent-contact', label: '家长联系', icon: Phone, permission: 'class.view' },
          {
            path: '/homework-check',
            label: '作业检查',
            icon: BookCheck,
            permission: 'homework.view',
          },
          {
            path: '/attendance',
            label: '考勤管理',
            icon: CalendarCheck,
            permission: 'attendance.view',
          },
          { path: '/study-groups', label: '学习小组', icon: Users, permission: 'class.view' },
          { path: '/mental-health', label: '心理健康', icon: Heart, permission: 'class.view' },
          { path: '/activity', label: '文体活动', icon: PartyPopper, permission: 'class.view' },
          { path: '/culture', label: '班级文化', icon: Palette, permission: 'class.view' },
          {
            path: '/study-guide',
            label: '学法指导',
            icon: GraduationCap,
            permission: 'class.view',
          },
          {
            path: '/phonebox-policy',
            label: '手机箱开箱策略',
            icon: Smartphone,
            permission: 'phonebox.unlock.manage',
          },
        ],
      },
      {
        id: 'examManagement',
        label: '成绩管理',
        icon: ClipboardCheck,
        items: [
          { path: '/exams', label: '考试管理', icon: ClipboardCheck, permission: 'exam.view' },
          { path: '/score-entry', label: '成绩录入', icon: FileKey, permission: 'score.entry' },
          { path: '/score-records', label: '成绩档案', icon: BookOpen, permission: 'score.view' },
          {
            path: '/score-analysis',
            label: '成绩分析',
            icon: BarChart3,
            permission: 'algorithm.view',
          },
          {
            path: '/algorithm-analysis',
            label: '算法分析',
            icon: Sparkles,
            permission: 'algorithm.view',
          },
        ],
      },
      {
        id: 'deviceManagement',
        label: '设备管理',
        icon: Box,
        items: [
          { path: '/devices', label: '设备管理', icon: Box, permission: 'device.view' },
          { path: '/device-groups', label: '设备分组', icon: Server, permission: 'device.view' },
          { path: '/firmware', label: '固件管理', icon: Upload, permission: 'firmware.manage' },
        ],
      },
      {
        id: 'notificationCenter',
        label: '通知中心',
        icon: Bell,
        items: [
          {
            path: '/notifications',
            label: '通知管理',
            icon: Bell,
            permission: 'notification.view',
          },
          {
            path: '/approvals',
            label: '审批管理',
            icon: ClipboardCheck,
            permission: 'score.approve',
          },
          {
            path: '/remote-notify',
            label: '远程通知',
            icon: Bell,
            permission: 'notification.send',
          },
          { path: '/wake-on-lan', label: '远程开机', icon: Power, permission: 'device.edit' },
        ],
      },
      {
        id: 'systemAdmin',
        label: '系统管理',
        icon: Settings,
        permission: 'system.settings',
        items: [
          { path: '/settings', label: '系统设置', icon: Sliders, permission: 'system.settings' },
          { path: '/permission', label: '权限管理', icon: Shield, permission: 'system.roles' },

          { path: '/data-sync', label: '数据同步', icon: RefreshCw, permission: 'system.settings' },
        ],
      },
      {
        id: 'opsCenter',
        label: '运维中心',
        icon: Server,
        permission: 'ops_center.view',
        items: [
          { path: '/ops-center', label: '运维总览', icon: Activity, permission: 'ops_center.view' },
          {
            path: '/ops-center/telemetry',
            label: '前端遥测',
            icon: Gauge,
            permission: 'ops_center.view',
          },
          {
            path: '/ops-center/metrics',
            label: '系统指标趋势',
            icon: LineChart,
            permission: 'ops_center.view',
          },
          { path: '/diagnostics', label: '系统诊断', icon: Server, permission: 'device.view' },
          {
            path: '/security-audit',
            label: '安全审计',
            icon: Shield,
            permission: 'system.settings',
          },
          { path: '/operation-logs', label: '操作日志', icon: History, permission: 'system.logs' },
        ],
      },
    ],
    []
  );

  const filteredMenuGroups = useMemo<MenuGroup[]>(() => {
    const shouldUseFallback = isLoading || permissions.length === 0;
    const fallbackPermissions =
      role === 'admin' ? DEFAULT_PERMISSIONS_FOR_ADMIN : DEFAULT_PERMISSIONS_FOR_TEACHER;

    const checkPermission = (permissionCode?: string): boolean => {
      if (!permissionCode) return true;
      if (shouldUseFallback) {
        return fallbackPermissions.includes(permissionCode) || fallbackPermissions.includes('all');
      }
      return hasPermission(permissionCode);
    };

    const checkAnyPermission = (permissionCodes?: string[]): boolean => {
      if (!permissionCodes || permissionCodes.length === 0) return true;
      if (shouldUseFallback) {
        return (
          permissionCodes.some((code) => fallbackPermissions.includes(code)) ||
          fallbackPermissions.includes('all')
        );
      }
      return hasAnyPermission(permissionCodes);
    };

    return menuGroups.filter((group) => {
      if (group.requiresAdmin && !isAdmin) return false;
      if (group.permission && !checkPermission(group.permission)) return false;

      const filteredItems = group.items.filter((item) => {
        if (item.permission && !checkPermission(item.permission)) return false;
        if (item.permissions && !checkAnyPermission(item.permissions)) return false;
        return true;
      });

      return filteredItems.length > 0;
    });
  }, [menuGroups, isAdmin, hasPermission, hasAnyPermission, permissions, isLoading, role]);

  const handleLogout: MouseEventHandler<HTMLButtonElement> = useCallback(() => {
    localStorage.removeItem('admin');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  }, [navigate]);

  return (
    <>
      <button
        onClick={() => setInternalMobileMenuOpen(true)}
        className={`fixed top-4 left-4 z-[60] md:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 bg-white/90 dark:bg-slate-800/90 shadow-lg shadow-black/10 dark:shadow-black/30 backdrop-blur-sm hover:scale-110 active:scale-95 text-gray-600 dark:text-slate-300 no-tap-highlight`}
        aria-label='打开菜单'
      >
        <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M4 6h16M4 12h16M4 18h16'
          />
        </svg>
      </button>

      <aside
        className={`
          relative bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200
          flex flex-col shadow-lg border-r border-gray-200/50 dark:border-slate-700/50
          shrink-0
          ${isCollapsed ? 'w-16 md:w-16' : 'w-64 md:w-64'}
        `}
      >
        <div
          className={`p-3 border-b border-gray-200/50 dark:border-slate-700/50 relative z-10 ${
            isCollapsed
              ? 'bg-gradient-to-b from-primary-50/50 to-white dark:from-primary-500/10 dark:to-slate-800'
              : 'bg-gray-50/50 dark:bg-slate-700/30'
          } ${
            isCollapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between'
          }`}
        >
          <div
            className={`flex items-center gap-3 ${
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}
          >
            <div className='relative w-10 h-10 rounded-xl overflow-hidden'>
              <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500' />
              <div className='relative w-full h-full flex items-center justify-center'>
                <GraduationCap className='w-6 h-6 text-white' />
              </div>
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
            className={`relative w-12 h-12 rounded-2xl overflow-hidden ${
              !isCollapsed
                ? 'hidden'
                : 'flex items-center justify-center shadow-lg shadow-primary-500/20'
            }`}
          >
            <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500' />
            <GraduationCap className='relative w-6 h-6 text-white' />
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-150 hover:scale-110 active:scale-95 ${
              isCollapsed
                ? 'bg-white/80 dark:bg-slate-700/80 shadow-md shadow-black/5 text-gray-600 dark:text-slate-300 hover:shadow-lg'
                : 'bg-gray-200/50 dark:bg-slate-700/50 hover:bg-gray-300/50 dark:hover:bg-slate-600/50 text-gray-600 dark:text-slate-300'
            }`}
            title={`${isCollapsed ? '展开侧边栏' : '收起侧边栏'} (Ctrl+B)`}
          >
            {isCollapsed ? (
              <ChevronRight className='w-5 h-5' />
            ) : (
              <ChevronLeft className='w-5 h-5' />
            )}
          </button>
        </div>

        <nav className='flex-1 px-3 py-3 relative z-10 overflow-y-auto overflow-x-hidden scrollbar-thin scroll-smooth'>
          <ul className='space-y-1'>
            {filteredMenuGroups.map((group) => {
              const hasActive = hasActiveItem(group.items);
              const isExpanded = expandedGroups[group.id];

              return (
                <li key={group.id} className='relative'>
                  <GroupHeader
                    group={group}
                    hasActive={hasActive}
                    isExpanded={isExpanded ?? false}
                    onToggle={() => toggleGroup(group.id)}
                    isCollapsed={isCollapsed}
                  />

                  <ul
                    className={`overflow-hidden transition-max-height duration-200 ease-in-out ${
                      isExpanded && !isCollapsed
                        ? 'max-h-[500px] opacity-100 mt-1'
                        : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
                    {group.items.map((item) => (
                      <div
                        key={item.path}
                        onMouseEnter={() => setHoveredItem(item.path)}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={closeMobileMenu}
                      >
                        <MenuItem
                          item={item}
                          isActive={isItemActive(item.path)}
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/60 hover:text-gray-800 dark:hover:text-slate-200 transition-colors duration-150 ${
              isCollapsed ? 'justify-center' : ''
            }`}
            onMouseEnter={() => setHoveredItem('/help')}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={closeMobileMenu}
          >
            <div className='relative w-8 h-8 rounded-lg bg-gray-100/50 dark:bg-slate-700/50 flex items-center justify-center'>
              <HelpCircle className='w-4.5 h-4.5' />
            </div>
            {!isCollapsed && <span className='font-medium text-sm'>帮助中心</span>}
          </Link>

          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50/80 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors duration-150 ${
              isCollapsed ? 'justify-center' : ''
            }`}
            onMouseEnter={() => setHoveredItem('logout')}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={handleLogout}
          >
            <div className='relative w-8 h-8 rounded-lg bg-danger-500/20 flex items-center justify-center'>
              <LogOut className='w-4.5 h-4.5' />
            </div>
            {!isCollapsed && <span className='font-medium text-sm'>退出登录</span>}
          </button>
        </div>

        {isCollapsed && hoveredItem && (
          <div className='fixed left-16 top-1/2 -translate-y-1/2 px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl shadow-elevated z-50'>
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
            </div>
          </div>
        )}
      </aside>

      {isMobileMenuOpen && (
        <>
          <div
            className='fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden'
            onClick={closeMobileMenu}
          />
          <aside className='fixed inset-y-0 left-0 w-80 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 flex flex-col shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-out animate-slide-in-left safe-area-top'>
            <div className='p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-primary-50/50 to-white dark:from-primary-500/10 dark:to-slate-800'>
              <div className='flex items-center gap-3'>
                <div className='relative w-10 h-10 rounded-xl overflow-hidden'>
                  <div className='absolute inset-0 bg-gradient-to-br from-primary-500 via-blue-500 to-accent-500' />
                  <div className='relative w-full h-full flex items-center justify-center'>
                    <GraduationCap className='w-6 h-6 text-white' />
                  </div>
                </div>
                <div>
                  <h1 className='text-base font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 dark:from-slate-200 dark:via-slate-300 dark:to-slate-400 bg-clip-text text-transparent'>
                    积分管理平台
                  </h1>
                  <p className='text-xs text-gray-500 dark:text-slate-400'>Student Score System</p>
                </div>
              </div>
              <button
                onClick={closeMobileMenu}
                className='w-9 h-9 rounded-xl flex items-center justify-center bg-gray-200/50 dark:bg-slate-700/50 hover:bg-gray-300/50 dark:hover:bg-slate-600/50 text-gray-600 dark:text-slate-300 transition-all duration-150 hover:scale-110 active:scale-95'
                aria-label='关闭菜单'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <nav className='flex-1 px-3 py-3 overflow-y-auto overflow-x-hidden scroll-smooth'>
              <ul className='space-y-1'>
                {filteredMenuGroups.map((group) => {
                  const hasActive = hasActiveItem(group.items);
                  const isExpanded = expandedGroups[group.id];

                  return (
                    <li key={group.id} className='relative'>
                      <GroupHeader
                        group={group}
                        hasActive={hasActive}
                        isExpanded={isExpanded ?? false}
                        onToggle={() => toggleGroup(group.id)}
                        isCollapsed={false}
                      />

                      <ul
                        className={`overflow-hidden transition-max-height duration-200 ease-in-out ${
                          isExpanded ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
                        }`}
                      >
                        {group.items.map((item) => (
                          <div key={item.path} onClick={closeMobileMenu}>
                            <MenuItem
                              item={item}
                              isActive={isItemActive(item.path)}
                              isCollapsed={false}
                            />
                          </div>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className='px-3 py-3 border-t border-gray-200/50 dark:border-slate-700/50 space-y-2 bg-gray-50/30 dark:bg-slate-700/30 safe-area-bottom'>
              <Link
                to='/help'
                className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/60 hover:text-gray-800 dark:hover:text-slate-200 transition-colors duration-150'
                onClick={closeMobileMenu}
              >
                <div className='relative w-8 h-8 rounded-lg bg-gray-100/50 dark:bg-slate-700/50 flex items-center justify-center'>
                  <HelpCircle className='w-4.5 h-4.5' />
                </div>
                <span className='font-medium text-sm'>帮助中心</span>
              </Link>

              <button
                className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50/80 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors duration-150'
                onClick={handleLogout}
              >
                <div className='relative w-8 h-8 rounded-lg bg-danger-500/20 flex items-center justify-center'>
                  <LogOut className='w-4.5 h-4.5' />
                </div>
                <span className='font-medium text-sm'>退出登录</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export default Sidebar;
