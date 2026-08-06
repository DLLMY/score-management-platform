/**
 * 仪表盘页面组件
 * 展示系统概览、用户排名、设备状态等核心数据
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, memo } from 'react';
import {
  Trophy,
  Smartphone,
  Bell,
  Clock,
  Users,
  ArrowUp,
  Activity,
  RefreshCw,
  Building2,
  Award,
  Target,
  Flame,
  Star,
  Crown,
  CheckCircle,
  Wifi,
  TrendingDown as TrendingDownIcon,
  Radio,
} from 'lucide-react';
import api from '../services/api';
import { DashboardSkeleton } from '../components';
import { User, Device, Notification, ID, AlgorithmStatistics, WarningData } from '../types';
import { useThrottledCallback } from '../hooks';
import { useWebSocketStore } from '../stores';

interface DashboardStatistics {
  totalUsers: number;
  totalRecords: number;
  totalScore: number;
  onlineDevices: number;
}

interface AlgorithmData {
  statistics: AlgorithmStatistics | null;
  clusters: ClusterData | null;
  warnings: WarningData | null;
}

interface DashboardState {
  users: User[];
  records: unknown[];
  devices: Device[];
  notifications: Notification[];
  statistics: DashboardStatistics;
  algorithmData: AlgorithmData;
  loading: boolean;
  isRefreshing: boolean;
  lastUpdateTime: Date | null;
  showUpdateIndicator: boolean;
}

interface ClusterStudent {
  user_id: number;
  cluster_name: string;
}

interface ClusterData {
  students?: ClusterStudent[];
}

type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_RECORDS'; payload: unknown[] }
  | { type: 'SET_DEVICES'; payload: Device[] }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_STATISTICS'; payload: Partial<DashboardStatistics> }
  | { type: 'SET_ALGORITHM_DATA'; payload: AlgorithmData }
  | { type: 'SET_LAST_UPDATE'; payload: Date }
  | { type: 'SET_UPDATE_INDICATOR'; payload: boolean };

const initialState: DashboardState = {
  users: [],
  records: [],
  devices: [],
  notifications: [],
  statistics: {
    totalUsers: 0,
    totalRecords: 0,
    totalScore: 0,
    onlineDevices: 0,
  },
  algorithmData: {
    statistics: null,
    clusters: null,
    warnings: null,
  },
  loading: true,
  isRefreshing: false,
  lastUpdateTime: null,
  showUpdateIndicator: false,
};

function dataReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_RECORDS':
      return { ...state, records: action.payload };
    case 'SET_DEVICES':
      return { ...state, devices: action.payload };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'SET_STATISTICS':
      return { ...state, statistics: { ...state.statistics, ...action.payload } };
    case 'SET_ALGORITHM_DATA':
      return { ...state, algorithmData: action.payload };
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdateTime: action.payload };
    case 'SET_UPDATE_INDICATOR':
      return { ...state, showUpdateIndicator: action.payload };
    default:
      return state;
  }
}

const AnimatedNumber = memo(({ value, className = '', decimals = 0 }: { value: number; className?: string; decimals?: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const duration = 300;
    const startTime = Date.now();
    const startValue = displayValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (value - startValue) * easeOut;
      setDisplayValue(Math.round(currentValue * Math.pow(10, decimals)) / Math.pow(10, decimals));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, decimals]);

  return (
    <span className={className}>
      {typeof displayValue === 'number' 
        ? displayValue.toLocaleString(undefined, { maximumFractionDigits: decimals })
        : '0'}
    </span>
  );
});

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  subValue?: string;
  trend?: number;
  gradient: string;
  description?: string;
  isAlgorithm?: boolean;
  'aria-label'?: string;
}

const StatCard = memo(
  ({ icon: Icon, label, value, subValue, trend, gradient, description, isAlgorithm = false, 'aria-label': ariaLabel }: StatCardProps) => {
    return (
      <div
        className={`group relative overflow-hidden rounded-xl p-3 bg-white border border-gray-200/60 shadow-sm hover:shadow-md transition-colors duration-150 ${
          isAlgorithm ? 'border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/40 to-transparent' : ''
        }`}
        role="listitem"
        aria-label={ariaLabel}
      >
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient}`} />

        <div className='relative z-10'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}
              >
                <Icon className='w-4.5 h-4.5 text-white' />
              </div>
              <div className='flex flex-col'>
                <span className='text-sm font-semibold text-gray-800 whitespace-nowrap'>{label}</span>
                {description && <span className='text-[11px] text-gray-500'>{description}</span>}
              </div>
            </div>
            <div className='flex items-center gap-2.5'>
              <span className='text-xl font-bold text-gray-900'>
                <AnimatedNumber value={typeof value === 'number' ? value : 0} />
              </span>
              {trend && (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                    trend > 0
                      ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 border border-green-500/30'
                      : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-700 border border-red-500/30'
                  }`}
                >
                  {trend > 0 ? (
                    <ArrowUp className='w-3 h-3' />
                  ) : (
                    <TrendingDownIcon className='w-3 h-3' />
                  )}
                  {Math.abs(trend)}%
                </div>
              )}
            </div>
          </div>
          {subValue && (
            <div className='mt-2 flex items-center gap-1.5'>
              <span className='w-1.5 h-1.5 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full' />
              <span className='text-[11px] text-gray-500 font-medium'>{subValue}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

function Dashboard(): React.ReactElement {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classList, setClassList] = useState<{ id: number; name: string }[]>([]);
  const stateRef = useRef(state);
  const currentTimeRef = useRef(new Date());

  const { initSocket, isConnected, deviceStatuses, scoreUpdates, subscribe } = useWebSocketStore();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    initSocket();
    subscribe('dashboard');
  }, [initSocket, subscribe]);

  useEffect(() => {
    if (Object.keys(deviceStatuses).length > 0) {
      dispatch({
        type: 'SET_DEVICES',
        payload: state.devices.map((device) => {
          const updatedStatus = deviceStatuses[device.device_id];
          if (updatedStatus) {
            return { ...device, is_online: updatedStatus === 'online' };
          }
          return device;
        }),
      });
    }
  }, [deviceStatuses]);

  useEffect(() => {
    if (scoreUpdates.length > 0) {
      const latestUpdate = scoreUpdates[0];
      dispatch({
        type: 'SET_USERS',
        payload: state.users.map((user) => {
          if (Number(user.id) === latestUpdate.user_id) {
            return {
              ...user,
              score: (user.score || 0) + latestUpdate.score_change,
            };
          }
          return user;
        }),
      });
      dispatch({
        type: 'SET_STATISTICS',
        payload: {
          totalScore: state.statistics.totalScore + latestUpdate.score_change,
        },
      });
    }
  }, [scoreUpdates]);

  useEffect(() => {
    const timer = setInterval(() => {
      currentTimeRef.current = new Date();
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const data = await api.classes.getAll() as unknown;
        const classesData = Array.isArray(data) ? data : ((data as { classes?: { id: number; name: string }[] }).classes || []);
        setClassList(classesData);
      } catch (error) {
        console.error('获取班级列表失败:', error);
      }
    };
    fetchClasses();
  }, []);

  const filteredUsers = useMemo(() => {
    if (selectedClass) {
      return state.users
        .filter((u) => u.class_name === selectedClass)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    return [...state.users].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [state.users, selectedClass]);

  const classes = useMemo(() => {
    return classList.map(c => c.name).sort();
  }, [classList]);

  const classGroups = useMemo(() => {
    const groups: Record<string, User[]> = {};
    state.users.forEach((user) => {
      const className = user.class_name || '未分班';
      if (!groups[className]) {
        groups[className] = [];
      }
      groups[className].push(user);
    });
    return Object.entries(groups)
      .map(([class_name, students]) => ({
        class_name,
        students,
      }))
      .sort((a, b) => a.class_name.localeCompare(b.class_name));
  }, [state.users]);

  const REFRESH_INTERVAL = 600000;

  const fetchUsers = useCallback(async (): Promise<User[]> => {
    try {
      const usersData = await api.users.getAll({ per_page: 100 });
      return Array.isArray(usersData) ? usersData : ((usersData as { users?: User[] })?.users || []);
    } catch (e) {
      console.error('获取用户数据失败:', e);
      return [];
    }
  }, []);

  const fetchRecords = useCallback(async (): Promise<unknown[]> => {
    try {
      const recordsData = await api.records.getAll({ per_page: 20 });
      return Array.isArray(recordsData) ? recordsData : ((recordsData as { records?: unknown[] })?.records || []);
    } catch (e) {
      console.error('获取记录数据失败:', e);
      return [];
    }
  }, []);

  const fetchDevices = useCallback(async (): Promise<Device[] | null> => {
    try {
      const deviceData = await api.devices.getAll();
      const devices = (deviceData as { devices?: Device[] }).devices || deviceData;
      return Array.isArray(devices) ? devices : [];
    } catch (e) {
      console.error('获取设备数据失败:', e);
      return null;
    }
  }, []);

  const fetchNotifications = useCallback(async (): Promise<Notification[] | null> => {
    try {
      const notificationsData = await api.notifications.getAll({ per_page: 5 });
      return Array.isArray(notificationsData)
        ? notificationsData
        : ((notificationsData as { notifications?: Notification[] })?.notifications || []);
    } catch (e) {
      console.error('获取通知数据失败:', e);
      return null;
    }
  }, []);

  const fetchAlgorithmData = useCallback(async (): Promise<AlgorithmData> => {
    try {
      const params = selectedClass ? { class_name: selectedClass } : {};
      const [statsRes, clusterRes, warningRes] = await Promise.all([
        api.algorithm.getStatistics(params).catch(() => null),
        api.algorithm.getClusters(params).catch(() => null),
        api.algorithm.getWarnings(params).catch(() => null),
      ]);

      return {
        statistics: statsRes || null,
        clusters: clusterRes || null,
        warnings: warningRes || null,
      };
    } catch (error) {
      console.error('获取算法数据失败:', error);
      return { statistics: null, clusters: null, warnings: null };
    }
  }, [selectedClass]);

  const fetchDataRef = useRef<((manualRefresh?: boolean) => Promise<void>) | null>(null);
  const lastFetchTimeRef = useRef(0);
  const timeoutIdsRef = useRef<number[]>([]);
  const mountedRef = useRef(true);
  
  // 使用节流限制刷新频率（最少间隔 1 秒）
  const throttledRefresh = useThrottledCallback(
    async () => {
      if (fetchDataRef.current) {
        await fetchDataRef.current(true);
      }
    },
    1000
  );

  const getOnlineCount = useCallback((devices: Device[] | null): number => {
    if (!devices || !Array.isArray(devices)) {
      return 0;
    }
    return devices.filter((d) => d.is_online || d.status === 'online').length;
  }, []);

  const fetchHighPriorityData = useCallback(async (): Promise<void> => {
      try {
        const [dashboardData, usersList, deviceList] = await Promise.all([
          api.dashboard.getData().catch(() => null),
          fetchUsers(),
          fetchDevices(),
        ]);

        const sortedUsers = [...usersList].sort((a, b) => (b.score || 0) - (a.score || 0));
        dispatch({ type: 'SET_USERS', payload: sortedUsers });

        if (deviceList !== null) {
          dispatch({ type: 'SET_DEVICES', payload: deviceList });
        }

        if (dashboardData) {
          dispatch({
            type: 'SET_STATISTICS',
            payload: {
              totalUsers: dashboardData.total_users,
              totalRecords: dashboardData.today_records,
              totalScore: Math.round(dashboardData.avg_score * dashboardData.total_users),
              onlineDevices: dashboardData.online_devices,
            },
          });
        } else {
          dispatch({
            type: 'SET_STATISTICS',
            payload: {
              totalUsers: usersList.length,
              totalRecords: 0,
              totalScore: usersList.reduce((sum, u) => sum + (u.score || 0), 0),
              onlineDevices: deviceList !== null ? getOnlineCount(deviceList) : 0,
            },
          });
        }

        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_LAST_UPDATE', payload: new Date() });
      } catch (error) {
        console.error('获取高优先级数据失败:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, [fetchUsers, fetchDevices, getOnlineCount]);

    const fetchMediumPriorityData = useCallback(async (): Promise<void> => {
      try {
        const [recordsList, notificationsList] = await Promise.all([
          fetchRecords(),
          fetchNotifications(),
        ]);

        dispatch({ type: 'SET_RECORDS', payload: recordsList });

        if (notificationsList !== null) {
          dispatch({ type: 'SET_NOTIFICATIONS', payload: notificationsList });
        }
      } catch (error) {
        console.error('获取中优先级数据失败:', error);
      }
    }, [fetchRecords, fetchNotifications]);

    const fetchLowPriorityData = useCallback(async (): Promise<void> => {
      try {
        const algorithmData = await fetchAlgorithmData();
        dispatch({ type: 'SET_ALGORITHM_DATA', payload: algorithmData });
      } catch (error) {
        console.error('获取低优先级数据失败:', error);
      }
    }, [fetchAlgorithmData]);

    const clearTimeouts = useCallback(() => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
    }, []);

    const fetchData = useCallback(
      async (manualRefresh = false) => {
        const now = Date.now();
        if (!manualRefresh && now - lastFetchTimeRef.current < REFRESH_INTERVAL) {
          return;
        }
        lastFetchTimeRef.current = now;

        clearTimeouts();

        if (manualRefresh) {
          dispatch({ type: 'SET_REFRESHING', payload: true });
        }

        try {
          await Promise.all([
            fetchHighPriorityData(),
            fetchMediumPriorityData(),
          ]);

          if (mountedRef.current) {
            const lowTimeout = window.setTimeout(() => {
              if (mountedRef.current) {
                fetchLowPriorityData();
              }
            }, 300);
            timeoutIdsRef.current.push(lowTimeout);
          }
        } catch (error) {
          console.error('获取数据失败:', error);
        } finally {
          if (mountedRef.current) {
            dispatch({ type: 'SET_REFRESHING', payload: false });
          }
        }
      },
      [fetchHighPriorityData, fetchMediumPriorityData, fetchLowPriorityData, clearTimeouts]
    );

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // 使用节流刷新，避免频繁点击
  const handleRefresh = useCallback(() => {
    throttledRefresh();
  }, [throttledRefresh]);

  useEffect(() => {
    mountedRef.current = true;

    const doFetch = async () => {
      if (fetchDataRef.current) {
        await fetchDataRef.current();
      }
    };

    doFetch();
    const interval = setInterval(doFetch, REFRESH_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearTimeouts();
    };
  }, [clearTimeouts]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    return `${hours}小时前`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDateFull = (date: Date): string => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const getRankColor = (index: number): string => {
    const colors = [
      'from-yellow-400 via-amber-500 to-orange-500',
      'from-gray-300 via-gray-400 to-gray-500',
      'from-amber-600 via-orange-600 to-amber-700',
      'from-green-400 via-emerald-500 to-green-600',
      'from-blue-400 via-blue-500 to-blue-600',
      'from-purple-400 via-purple-500 to-purple-600',
      'from-pink-400 via-pink-500 to-pink-600',
      'from-cyan-400 via-cyan-500 to-cyan-600',
      'from-red-400 via-red-500 to-red-600',
      'from-indigo-400 via-indigo-500 to-indigo-600',
    ];
    return colors[index] || 'from-slate-500 via-slate-600 to-slate-700';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getLevel = (score: number): { text: string; icon: string; color: string } => {
    if (score >= 95)
      return {
        text: '领航者',
        icon: '🏆',
        color: 'from-yellow-500/40 to-amber-500/30 text-yellow-500 border-yellow-500/50',
      };
    if (score >= 85)
      return {
        text: '自律星',
        icon: '⭐',
        color: 'from-blue-500/40 to-cyan-500/30 text-blue-500 border-blue-500/50',
      };
    if (score >= 75)
      return {
        text: '进取者',
        icon: '🚀',
        color: 'from-green-500/40 to-emerald-500/30 text-green-500 border-green-500/50',
      };
    if (score >= 65)
      return {
        text: '稳定区',
        icon: '📊',
        color: 'from-teal-500/40 to-cyan-500/30 text-teal-500 border-teal-500/50',
      };
    if (score >= 60)
      return {
        text: '安全基准',
        icon: '✅',
        color: 'from-cyan-500/40 to-blue-500/30 text-cyan-500 border-cyan-500/50',
      };
    if (score >= 50)
      return {
        text: '浅观察',
        icon: '⚠️',
        color: 'from-orange-500/40 to-amber-500/30 text-orange-500 border-orange-500/50',
      };
    if (score >= 40)
      return {
        text: '深观察',
        icon: '🔴',
        color: 'from-red-500/40 to-rose-500/30 text-red-500 border-red-500/50',
      };
    if (score >= 30)
      return {
        text: '限行区',
        icon: '🚨',
        color: 'from-pink-500/40 to-rose-500/30 text-pink-500 border-pink-500/50',
      };
    if (score >= 20)
      return {
        text: '重启预备',
        icon: '🔄',
        color: 'from-purple-500/40 to-violet-500/30 text-purple-500 border-purple-500/50',
      };
    if (score >= 10)
      return {
        text: '护航区',
        icon: '🛡️',
        color: 'from-indigo-500/40 to-purple-500/30 text-indigo-500 border-indigo-500/50',
      };
    return {
      text: '重生点',
      icon: '💀',
      color: 'from-gray-500/40 to-slate-500/30 text-gray-500 border-gray-500/50',
    };
  };

  const getUserCluster = (userId: ID): ClusterStudent | undefined => {
    const clusters = state.algorithmData.clusters as ClusterData;
    if (!clusters?.students) return undefined;
    return clusters.students.find((s) => s.user_id === Number(userId));
  };

  const CLUSTER_COLORS: Record<string, { bg: string; text: string; light: string }> = {
    '全面优秀型': { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
    '遵纪但学业吃力型': { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' },
    '聪明但散漫型': { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
    '双困型': { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' },
  };

  const UserCard = memo(({ user, globalIndex }: { user: User; globalIndex: number }) => {
    const level = getLevel(user.score || 0);
    const isTopThree = globalIndex < 3;
    const score = user.score || 0;
    const [isHovered, setIsHovered] = useState(false);
    const cluster = getUserCluster(user.id);
    const clusterColors = cluster ? CLUSTER_COLORS[cluster.cluster_name] : null;

    return (
      <div
        key={user.id}
        className={`relative group rounded-xl p-3.5 transition-all duration-400 ${
          isTopThree
            ? 'bg-white border border-gray-200/60 shadow-md hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-300/60 bg-gradient-to-r from-yellow-50/30 to-transparent'
            : 'bg-white hover:bg-white border border-gray-200/50 hover:border-gray-300/60'
        } ${isHovered ? '-translate-y-1.5' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ animationDelay: `${globalIndex * 50}ms` }}
      >
        {isTopThree && (
          <div className='absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/40'>
            {globalIndex === 0 ? (
              <Crown className='w-4 h-4 text-white' />
            ) : globalIndex === 1 ? (
              <Award className='w-4 h-4 text-white' />
            ) : (
              <Star className='w-4 h-4 text-white' />
            )}
          </div>
        )}

        <div className='flex items-center gap-3.5'>
          <div
            className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${getRankColor(globalIndex)} flex items-center justify-center shadow-md overflow-hidden transition-all duration-300 ${isHovered ? 'scale-110 rotate-3' : ''}`}
          >
            {globalIndex < 3 ? (
              <span className='text-base'>
                {globalIndex === 0 ? '🥇' : globalIndex === 1 ? '🥈' : '🥉'}
              </span>
            ) : (
              <span className='text-sm font-bold text-white'>{globalIndex + 1}</span>
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center justify-between mb-1'>
              <p className='font-semibold text-gray-900 text-sm truncate'>{user.name}</p>
              <span
                className={`text-xl font-bold ${getScoreColor(score)} flex items-center gap-1 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}
              >
                {score}
                <span className='text-xs text-gray-500'>分</span>
              </span>
            </div>
            <div className='flex items-center justify-between mt-1.5'>
              <span className='text-xs text-gray-500 whitespace-nowrap font-medium'>{user.class_name || '未分班'}</span>
              <div className='flex items-center gap-1.5'>
                {clusterColors && cluster && (
                  <span className={`text-xs px-2.5 py-1 rounded-full ${clusterColors.light} ${clusterColors.text} font-medium whitespace-nowrap shadow-sm`}>
                    {cluster.cluster_name}
                  </span>
                )}
                <span
                  className={`text-xs px-2.5 py-1 rounded-full bg-gradient-to-r ${level.color} text-white flex items-center gap-1 transition-all duration-300 ${isHovered ? 'scale-105 shadow-md' : ''} whitespace-nowrap`}
                >
                  <span className='text-xs'>{level.icon}</span>
                  <span className='font-semibold'>{level.text}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });

  const DeviceCard = memo(({ device }: { device: Device }) => {
    const isOnline = device.is_online || device.status === 'online';
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        className={`relative rounded-lg p-3 transition-all duration-300 cursor-pointer bg-white border ${
          isOnline
            ? 'border-green-200/60 hover:border-green-300/70 hover:shadow-md hover:shadow-green-500/10'
            : 'border-red-200/60 hover:border-red-300/70 hover:shadow-md hover:shadow-red-500/10'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${
            isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />

        <div className='flex items-center gap-2.5'>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
              isOnline
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            } ${isHovered ? 'scale-110' : ''}`}
          >
            {isOnline ? <Wifi className='w-5 h-5' /> : <Wifi className='w-5 h-5 opacity-50' />}
          </div>

          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold text-gray-900 truncate'>{device.device_name || device.name || device.device_id}</p>
            <p className='text-xs text-gray-500'>{device.device_id}</p>
          </div>

          <div className='flex items-center gap-2'>
            {isOnline ? (
              <span className='text-xs text-green-500 font-medium'>在线</span>
            ) : (
              <span className='text-xs text-red-500 font-medium'>离线</span>
            )}
          </div>
        </div>
      </div>
    );
  });

  if (state.loading) return <DashboardSkeleton />;

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>仪表盘</h1>
          <p className='text-gray-500 mt-1'>实时监控系统状态和用户数据</p>
        </div>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2 text-sm text-gray-500'>
            <Clock className='w-4 h-4' />
            <span>{formatDateFull(state.lastUpdateTime || new Date())}</span>
            <span className='font-mono font-semibold text-gray-700'>{formatTime(currentTimeRef.current)}</span>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            <Radio className={`w-4 h-4 ${isConnected ? 'animate-pulse' : ''}`} />
            {isConnected ? '实时连接' : '连接断开'}
          </div>
          <button
            onClick={handleRefresh}
            disabled={state.isRefreshing}
            aria-label="刷新数据"
            aria-busy={state.isRefreshing}
            className='flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'
          >
            <RefreshCw className={`w-4 h-4 ${state.isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' role="list" aria-label="统计数据卡片">
        <StatCard
          icon={Users}
          label='总用户数'
          value={state.statistics.totalUsers}
          gradient='from-blue-400 via-blue-500 to-blue-600'
          subValue='名学生'
          aria-label={`总用户数 ${state.statistics.totalUsers}`}
        />
        <StatCard
          icon={Activity}
          label='今日记录'
          value={state.statistics.totalRecords}
          gradient='from-green-400 via-emerald-500 to-green-600'
          subValue='条记录'
          aria-label={`今日记录 ${state.statistics.totalRecords}`}
        />
        <StatCard
          icon={Trophy}
          label='总积分'
          value={state.statistics.totalScore}
          gradient='from-amber-400 via-yellow-500 to-orange-500'
          subValue='积分'
          aria-label={`总积分 ${state.statistics.totalScore}`}
        />
        <StatCard
          icon={Smartphone}
          label='在线设备'
          value={state.statistics.onlineDevices}
          gradient='from-cyan-400 via-teal-500 to-cyan-600'
          subValue={`${state.devices.length} 台设备`}
          aria-label={`在线设备 ${state.statistics.onlineDevices}`}
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-2'>
          <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
            <div className='p-4 border-b border-gray-100 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Flame className='w-5 h-5 text-orange-500' />
                <h2 className='font-semibold text-gray-900'>积分排行榜</h2>
              </div>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                aria-label="筛选班级"
                className='px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部班级</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
            <div className='p-4 space-y-2.5'>
              {filteredUsers.slice(0, 10).map((user, index) => (
                <UserCard key={user.id} user={user} globalIndex={index} />
              ))}
              {filteredUsers.length === 0 && (
                <div className='text-center py-12 text-gray-500' role="status" aria-label="空列表状态">
                  <Users className='w-12 h-12 mx-auto mb-3 text-gray-300' aria-hidden="true" />
                  <p>暂无用户数据</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='space-y-6'>
          <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
            <div className='p-4 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <Smartphone className='w-5 h-5 text-cyan-500' />
                <h2 className='font-semibold text-gray-900'>设备状态</h2>
              </div>
            </div>
            <div className='p-4 space-y-2 max-h-64 overflow-y-auto'>
              {state.devices.slice(0, 5).map((device) => (
                <DeviceCard key={device.id} device={device} />
              ))}
              {state.devices.length === 0 && (
                <div className='text-center py-8 text-gray-500'>
                  <Smartphone className='w-8 h-8 mx-auto mb-2 text-gray-300' />
                  <p className='text-sm'>暂无设备</p>
                </div>
              )}
            </div>
          </div>

          <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
            <div className='p-4 border-b border-gray-100'>
              <div className='flex items-center gap-2'>
                <Bell className='w-5 h-5 text-amber-500' />
                <h2 className='font-semibold text-gray-900'>最新通知</h2>
              </div>
            </div>
            <div className='p-4 space-y-3 max-h-72 overflow-y-auto'>
              {state.notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className='p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors'>
                  <div className='flex items-start gap-2'>
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${notification.priority === 'high' || notification.priority === 'urgent' ? 'bg-red-500' : notification.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-900 truncate'>{notification.title}</p>
                      <p className='text-xs text-gray-500 mt-0.5'>{notification.content}</p>
                      <p className='text-xs text-gray-400 mt-1'>{formatDate(notification.created_at as string)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {state.notifications.length === 0 && (
                <div className='text-center py-8 text-gray-500'>
                  <Bell className='w-8 h-8 mx-auto mb-2 text-gray-300' />
                  <p className='text-sm'>暂无通知</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
          <div className='p-4 border-b border-gray-100'>
            <div className='flex items-center gap-2'>
              <Target className='w-5 h-5 text-purple-500' />
              <h2 className='font-semibold text-gray-900'>算法分析</h2>
              {state.algorithmData.statistics !== null && (
                <span className='ml-auto text-xs text-green-500 flex items-center gap-1'>
                  <CheckCircle className='w-3.5 h-3.5' />
                  数据已更新
                </span>
              )}
            </div>
          </div>
          <div className='p-4'>
            {state.algorithmData.statistics ? (
              <div className='grid grid-cols-3 gap-4'>
                <div className='text-center p-4 bg-purple-50/50 rounded-lg'>
                  <div className='text-2xl font-bold text-purple-600'>
                    {state.algorithmData.statistics?.student_count || 0}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>分析学生</div>
                </div>
                <div className='text-center p-4 bg-blue-50/50 rounded-lg'>
                  <div className='text-2xl font-bold text-blue-600'>
                    {state.algorithmData.statistics?.cluster_count || 0}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>聚类数量</div>
                </div>
                <div className='text-center p-4 bg-orange-50/50 rounded-lg'>
                  <div className='text-2xl font-bold text-orange-600'>
                    {state.algorithmData.warnings?.total_risk_count || 0}
                  </div>
                  <div className='text-xs text-gray-500 mt-1'>风险预警</div>
                </div>
              </div>
            ) : (
              <div className='text-center py-8 text-gray-500'>
                <Target className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p>算法数据加载中...</p>
              </div>
            )}
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-200/60 shadow-sm'>
          <div className='p-4 border-b border-gray-100'>
            <div className='flex items-center gap-2'>
              <Building2 className='w-5 h-5 text-indigo-500' />
              <h2 className='font-semibold text-gray-900'>班级分布</h2>
            </div>
          </div>
          <div className='p-4'>
            {classGroups.length > 0 ? (
              <div className='space-y-3'>
                {classGroups.map((group) => (
                  <div key={group.class_name} className='flex items-center justify-between p-3 bg-gray-50/50 rounded-lg'>
                    <div className='flex items-center gap-2'>
                      <Building2 className='w-4 h-4 text-indigo-400' />
                      <span className='text-sm font-medium text-gray-900'>{group.class_name}</span>
                    </div>
                    <span className='text-sm font-bold text-indigo-600'>{group.students.length} 人</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8 text-gray-500'>
                <Building2 className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                <p>暂无班级数据</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;